import { ApiError } from '../errors.js';
import {
  computeCost,
  createAnthropicCore,
  defaultCreateClient,
  FALLBACK_BETA,
  responseText,
  round4,
} from './anthropic.js';

// 既有測試 / 呼叫端從這裡 import 這些工具,維持相容
export {
  computeCost,
  getPricing,
  PRICING,
  round4,
  taipeiDayStart,
  taipeiMonthStart,
} from './anthropic.js';

/**
 * AI 復盤:把比例計算的輸入與 App 算出的結果交給 Claude 獨立重算、檢查,
 * 回傳結構化的 review。
 *
 * - client 建立、價目、日 / 月額度、ai_usage 寫入共用 ./anthropic.js
 *   (未設定金鑰 → 503 ai_unavailable;額度用完 → 429 ai_quota_exceeded,與線上查詢共用額度)
 * - 只要拿到回應(含 refusal / 不符 schema)就寫一筆 ai_usage(purpose 'review',已計費);
 *   API 丟錯則沒有用量可記,直接轉 502 ai_failed
 * - 開 server-side refusal fallback(beta server-side-fallback-2026-07-01 + fallbacks:'default');
 *   成本依實際服務的模型計價,usage.iterations 非空時逐 iteration 加總
 * - claude-opus-5-5:thinking 永遠開(不送 thinking 參數),深度只用 output_config.effort 控制
 */

const MAX_TOKENS = 8000;
const EFFORT = 'medium';

export const SYSTEM_PROMPT = `你是犬隻鮮食營養檢查員。使用者會提供一份 JSON:寵物資料、單餐目標熱量、各食材每 100 g 生重的營養值與占比,以及 App 依這些輸入算出的結果(appResult 與各食材的 gramsPerMeal)。你的工作是用下列同一套規則獨立重算,逐項核對 App 的結果是否正確,並評估這份配方的營養是否合理。

## 計算規則(與 App 相同)
1. 食材每公克熱量 = calories ÷ 100。type 為 "veg" 的蔬菜,熱量、蛋白質、脂肪一律以 0 計;鈣、磷照常計算。其他 type(含水果)照常計算。
2. 每餐總重 W(g)= mealTarget ÷ Σ(pct/100 × 該食材每公克熱量)。
3. 每項食材每餐克數 = W × pct/100。
4. 每餐營養 = Σ(該食材每餐克數 ÷ 100 × 每 100 g 含量):熱量 kcal、蛋白質 g、脂肪 g、鈣 mg、磷 mg(蔬菜的熱量、蛋白質、脂肪仍以 0 計)。
5. 鈣磷比 = 每餐鈣 ÷ 每餐磷;磷為 0 時無法計算(App 會給 null)。建議範圍 1.0–2.0。
6. 每餐上限建議(同類食材每餐克數加總後比較):蔬菜(type "veg")≤ 50 g、內臟(subtype "organ")≤ 12 g、高脂魚(subtype "fatty_fish")≤ 65 g。超過時 App 應在 capWarnings 提出警告。
7. App 的取位:每項每餐克數取一位小數、每餐總重與熱量取整數,營養以取位後的克數計算。與你重算的差異在取位誤差範圍內(克數 ±0.5 g、熱量與營養 ±2%)視為正確。

## 判定
- verdict "fail":App 的計算結果與你依上述規則重算的結果不符(超出取位誤差),或該警告的上限沒有警告。
- verdict "warn":計算正確,但營養有疑慮,例如鈣磷比不在 1.0–2.0、超過每餐上限、脂肪或蛋白質比例明顯偏離一般成犬鮮食的合理範圍。
- verdict "pass":計算正確且營養合理。

## 輸出
- 全部以繁體中文撰寫。
- summary:一段總評,200 字以內。
- checks:3–12 項核對,依序涵蓋每餐總重、各食材每餐克數(食材多時可合併成一項並在 note 說明)、每餐熱量、蛋白質 / 脂肪 / 鈣 / 磷、鈣磷比、每餐上限。每項的 expected 寫你重算的值(含單位),actual 寫 App 的值(含單位),ok 表示是否相符或合理,note 簡短說明(沒有可留空字串)。
- suggestions:0–5 條具體、可執行的建議(例如調整哪項食材的占比到多少);沒有就給空陣列。

## 原則
- 只依使用者提供的數據判斷與計算,不要假設或編造任何未提供的營養數據、食材資訊或寵物健康狀況。
- 資料不足以判斷某項時,在該項 note 說明,不要猜測。
- 你是計算與營養合理性的檢查員,不是獸醫;不要做醫療診斷。`;

/** Claude structured output 的 JSON schema(長度 / 數量限制不被支援,改在 parseReview 檢查)。 */
export const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'summary', 'checks', 'suggestions'],
  properties: {
    verdict: { type: 'string', enum: ['pass', 'warn', 'fail'] },
    summary: { type: 'string' },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'expected', 'actual', 'ok', 'note'],
        properties: {
          label: { type: 'string' },
          expected: { type: 'string' },
          actual: { type: 'string' },
          ok: { type: 'boolean' },
          note: { type: 'string' },
        },
      },
    },
    suggestions: { type: 'array', items: { type: 'string' } },
  },
};

const VERDICTS = ['pass', 'warn', 'fail'];
// prompt 要求 ≤ 200 字;模型偶爾超出,這裡留寬到 400 字才截斷(並補「…」),避免句子被切半
const SUMMARY_MAX = 400;
const CHECKS_MAX = 12;
const SUGGESTIONS_MAX = 5;

const isStr = (v) => typeof v === 'string';

/**
 * 驗證模型回應;形狀 / 型別不符回傳 null。
 * 長度上限(summary 200 字、checks 12 項、suggestions 5 條)超過時截斷而非失敗,
 * 因為 structured output 無法強制長度;至少要有 1 項 check。
 */
export const parseReview = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { verdict, summary, checks, suggestions } = raw;
  if (!VERDICTS.includes(verdict) || !isStr(summary)) return null;
  if (!Array.isArray(checks) || checks.length === 0) return null;
  if (!Array.isArray(suggestions) || !suggestions.every(isStr)) return null;
  const okCheck = (c) =>
    c &&
    typeof c === 'object' &&
    ['label', 'expected', 'actual', 'note'].every((k) => isStr(c[k])) &&
    typeof c.ok === 'boolean';
  if (!checks.every(okCheck)) return null;
  return {
    verdict,
    summary:
      [...summary].length > SUMMARY_MAX
        ? `${[...summary].slice(0, SUMMARY_MAX - 1).join('')}…`
        : summary,
    checks: checks.slice(0, CHECKS_MAX).map((c) => ({
      label: c.label,
      expected: c.expected,
      actual: c.actual,
      ok: c.ok,
      note: c.note,
    })),
    suggestions: suggestions.slice(0, SUGGESTIONS_MAX),
  };
};

const aiFailed = () => new ApiError(502, 'ai_failed', 'AI 復盤失敗,請稍後再試');

/**
 * @param {{ db: import('better-sqlite3').Database, config: object,
 *           createClient?: (apiKey: string) => object,
 *           now?: () => Date, log?: object }} deps
 */
export function createAiReview({
  db,
  config,
  createClient = defaultCreateClient,
  now = () => new Date(),
  log = null,
}) {
  const core = createAnthropicCore({
    db,
    config,
    createClient,
    now,
    log,
    unavailableMessage: 'AI 復盤未設定',
    quotaLabel: 'AI 復盤',
  });
  const { model, getClient, assertQuota, usageState, roundedUsage } = core;

  const recordUsage = (servedModel, totals, verdict) =>
    core.recordUsage(servedModel, totals, { purpose: 'review', verdict });

  const status = () => ({
    configured: Boolean(config.ai?.apiKey),
    model: model(),
    ...roundedUsage(usageState()),
  });

  /** @param {object} input 已通過 route body schema 驗證的請求內容 */
  async function review(input) {
    const anthropic = getClient();
    assertQuota(now());

    let response;
    try {
      response = await anthropic.beta.messages.create({
        model: model(),
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `請依規則復盤以下比例計算資料:\n\n${JSON.stringify(input, null, 2)}`,
          },
        ],
        output_config: {
          effort: EFFORT,
          format: { type: 'json_schema', schema: REVIEW_SCHEMA },
        },
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
      });
    } catch (err) {
      log?.error?.(
        { status: err?.status, name: err?.name, message: err?.message },
        'ai review: anthropic call failed',
      );
      throw aiFailed();
    }

    const servedModel = response?.model || model();
    const totals = computeCost(servedModel, response?.usage ?? {}, log);

    let result = null;
    let failure = null;
    if (response?.stop_reason === 'refusal') {
      failure = {
        reason: 'refusal',
        category: response.stop_details?.category ?? null,
      };
    } else if (response?.stop_reason === 'max_tokens') {
      failure = { reason: 'max_tokens' };
    } else {
      const text = responseText(response);
      try {
        result = parseReview(JSON.parse(text));
      } catch {
        result = null;
      }
      if (!result) failure = { reason: 'invalid_response' };
    }

    recordUsage(servedModel, totals, result?.verdict ?? null);
    if (failure) {
      log?.error?.(
        { ...failure, model: servedModel },
        'ai review: unusable response',
      );
      throw aiFailed();
    }

    return {
      review: result,
      model: servedModel,
      costUsd: round4(totals.costUsd),
      usage: roundedUsage(usageState()),
    };
  }

  return { review, status };
}

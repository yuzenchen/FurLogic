import Anthropic from '@anthropic-ai/sdk';
import { ApiError } from '../errors.js';

/**
 * AI 復盤:把比例計算的輸入與 App 算出的結果交給 Claude 獨立重算、檢查,
 * 回傳結構化的 review。
 *
 * - 金鑰只從 config.ai.apiKey(env ANTHROPIC_API_KEY)讀;未設定 → 503 ai_unavailable
 * - SDK client 延遲建立(第一次呼叫才建立),金鑰變更時重建;createClient 可注入(測試)
 * - 呼叫前檢查日 / 月額度(USD,Asia/Taipei 日界 / 月界)→ 429 ai_quota_exceeded
 * - 只要拿到回應(含 refusal / 不符 schema)就寫一筆 ai_usage(已計費);
 *   API 丟錯則沒有用量可記,直接轉 502 ai_failed
 * - 開 server-side refusal fallback(beta server-side-fallback-2026-07-01 + fallbacks:'default');
 *   成本依實際服務的模型計價,usage.iterations 非空時逐 iteration 加總
 * - claude-opus-5-5:thinking 永遠開(不送 thinking 參數),深度只用 output_config.effort 控制
 */

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const MAX_TOKENS = 8000;
const EFFORT = 'medium';
const REQUEST_TIMEOUT_MS = 60_000;
const TAIPEI_OFFSET_MS = 8 * 3600 * 1000; // 台灣無日光節約時間

/**
 * 價目(USD / 百萬 tokens)。來源:claude-api 技能內建模型表(cached 2026-10-06)
 * 與 shared/prompt-caching.md:cache write(5 分鐘 TTL)= 1.25 × input;
 * cache read 依各模型公告值(Opus 5.5 / Sonnet 5.5 為 $0.20,其餘 0.1 × input)。
 * claude-opus-5 / claude-opus-4-8 是 refusal fallback 可能改由其服務的模型。
 * Haiku 5.5 為 prompt ≤ 100K tokens 的價格(本功能的 prompt 遠小於此)。
 */
export const PRICING = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-sonnet-5-5': {
    input: 2,
    output: 10,
    cacheWrite: 2.5,
    cacheRead: 0.2,
  },
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
  },
  'claude-opus-5': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
};

const MOST_EXPENSIVE = Object.values(PRICING).reduce((max, p) =>
  p.input + p.output > max.input + max.output ? p : max,
);

/** 依模型取價目;未知模型以表中最貴者計價並 log warn。 */
export const getPricing = (model, log = null) => {
  if (PRICING[model]) return PRICING[model];
  log?.warn?.(
    { model },
    'ai review: unknown model for pricing, using most expensive',
  );
  return MOST_EXPENSIVE;
};

const tok = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

const priceTokens = (model, usage, log) => {
  const p = getPricing(model, log);
  return (
    (tok(usage.input_tokens) * p.input +
      tok(usage.output_tokens) * p.output +
      tok(usage.cache_creation_input_tokens) * p.cacheWrite +
      tok(usage.cache_read_input_tokens) * p.cacheRead) /
    1e6
  );
};

/**
 * 單次呼叫的 token 合計與成本(USD)。thinking tokens 已含在 output_tokens。
 * usage.iterations 非空(server-side fallback 等)時,被拒那一跳的 token 只出現在
 * iterations 裡,改以 iterations 逐筆加總(各用該筆 model 計價,沒有 model 的用
 * responseModel),且不再加 top-level,避免重複計算。
 */
export const computeCost = (responseModel, usage = {}, log = null) => {
  const its = Array.isArray(usage?.iterations) ? usage.iterations : [];
  const rows = its.length
    ? its.map((it) => ({ model: it?.model || responseModel, usage: it ?? {} }))
    : [{ model: responseModel, usage: usage ?? {} }];
  const totals = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
  };
  for (const row of rows) {
    totals.inputTokens += tok(row.usage.input_tokens);
    totals.outputTokens += tok(row.usage.output_tokens);
    totals.cacheReadTokens += tok(row.usage.cache_read_input_tokens);
    totals.cacheWriteTokens += tok(row.usage.cache_creation_input_tokens);
    totals.costUsd += priceTokens(row.model, row.usage, log);
  }
  return totals;
};

export const round4 = (n) => Math.round((Number(n) || 0) * 1e4) / 1e4;

/** 台北時間當日 00:00 的 UTC ISO 字串。 */
export const taipeiDayStart = (now) => {
  const t = new Date(now.getTime() + TAIPEI_OFFSET_MS);
  t.setUTCHours(0, 0, 0, 0);
  return new Date(t.getTime() - TAIPEI_OFFSET_MS).toISOString();
};

/** 台北時間當月 1 日 00:00 的 UTC ISO 字串。 */
export const taipeiMonthStart = (now) => {
  const t = new Date(now.getTime() + TAIPEI_OFFSET_MS);
  t.setUTCDate(1);
  t.setUTCHours(0, 0, 0, 0);
  return new Date(t.getTime() - TAIPEI_OFFSET_MS).toISOString();
};

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

const defaultCreateClient = (apiKey) =>
  new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });

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
  const ai = () => config.ai ?? {};
  const model = () => ai().model || 'claude-opus-5-5';
  const limits = () => ({
    dailyLimitUsd: Number.isFinite(ai().dailyUsd) ? ai().dailyUsd : 1,
    monthlyLimitUsd: Number.isFinite(ai().monthlyUsd) ? ai().monthlyUsd : 10,
  });

  let client = null;
  let clientKey = null;
  const getClient = () => {
    const apiKey = ai().apiKey;
    if (!apiKey) {
      throw new ApiError(503, 'ai_unavailable', 'AI 復盤未設定');
    }
    if (!client || clientKey !== apiKey) {
      client = createClient(apiKey);
      clientKey = apiKey;
    }
    return client;
  };

  const sumSince = db.prepare(
    'SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_usage WHERE created_at >= ?',
  );
  const insertUsage = db.prepare(`
    INSERT INTO ai_usage (created_at, model, input_tokens, output_tokens,
      cache_read_tokens, cache_write_tokens, cost_usd, verdict)
    VALUES (@createdAt, @model, @inputTokens, @outputTokens,
      @cacheReadTokens, @cacheWriteTokens, @costUsd, @verdict)
  `);

  /** 目前日 / 月用量(未取位)與上限。 */
  const usageState = (at = now()) => ({
    dailyUsd: sumSince.get(taipeiDayStart(at)).total,
    monthlyUsd: sumSince.get(taipeiMonthStart(at)).total,
    ...limits(),
  });

  const roundedUsage = (state) => ({
    dailyUsd: round4(state.dailyUsd),
    dailyLimitUsd: round4(state.dailyLimitUsd),
    monthlyUsd: round4(state.monthlyUsd),
    monthlyLimitUsd: round4(state.monthlyLimitUsd),
  });

  const assertQuota = (at) => {
    const s = usageState(at);
    const nums = (used, limit) => `(USD ${round4(used)} / ${round4(limit)})`;
    if (s.monthlyUsd >= s.monthlyLimitUsd) {
      throw new ApiError(
        429,
        'ai_quota_exceeded',
        `本月 AI 復盤額度已用完 ${nums(s.monthlyUsd, s.monthlyLimitUsd)},下個月 1 日(台北時間)恢復`,
      );
    }
    if (s.dailyUsd >= s.dailyLimitUsd) {
      throw new ApiError(
        429,
        'ai_quota_exceeded',
        `今日 AI 復盤額度已用完 ${nums(s.dailyUsd, s.dailyLimitUsd)},明天(台北時間 00:00)恢復`,
      );
    }
  };

  const recordUsage = (servedModel, totals, verdict) => {
    try {
      insertUsage.run({
        createdAt: now().toISOString(),
        model: servedModel,
        ...totals,
        verdict,
      });
    } catch (err) {
      // 已付費的回應不丟棄;記錄失敗會讓額度少算,記 error 方便追查。
      log?.error?.({ err: err?.message }, 'ai review: failed to record usage');
    }
  };

  const status = () => ({
    configured: Boolean(ai().apiKey),
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
      const text = (Array.isArray(response?.content) ? response.content : [])
        .filter((b) => b?.type === 'text')
        .map((b) => b.text)
        .join('');
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

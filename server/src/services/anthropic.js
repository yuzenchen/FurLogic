import Anthropic from '@anthropic-ai/sdk';
import { ApiError } from '../errors.js';

/**
 * AI 復盤與線上食材查詢共用的 Anthropic 基礎:
 * - SDK client 延遲建立(第一次呼叫才建立),金鑰變更時重建;createClient 可注入(測試)
 * - 金鑰只從 config.ai.apiKey(env ANTHROPIC_API_KEY)讀;未設定 → 503 ai_unavailable
 * - 價目 / 成本計算(usage.iterations 非空時逐 iteration 加總)
 * - 日 / 月額度(USD,Asia/Taipei 日界 / 月界)兩個功能共用,以 ai_usage.cost_usd 加總
 * - ai_usage 寫入(purpose:'review' | 'food_lookup';舊資料 NULL 視為 review)
 */

/** server-side refusal fallback(搭配 fallbacks: 'default')。 */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
export const DEFAULT_MODEL = 'claude-opus-5-5';
const REQUEST_TIMEOUT_MS = 60_000;
const TAIPEI_OFFSET_MS = 8 * 3600 * 1000; // 台灣無日光節約時間

/**
 * 價目(USD / 百萬 tokens)。來源:claude-api 技能內建模型表(cached 2026-10-06)
 * 與 shared/prompt-caching.md:cache write(5 分鐘 TTL)= 1.25 × input;
 * cache read 依各模型公告值(Opus 5.5 / Sonnet 5.5 為 $0.20,其餘 0.1 × input)。
 * claude-opus-5 / claude-opus-4-8 是 refusal fallback 可能改由其服務的模型。
 * Haiku 5.5 為 prompt ≤ 100K tokens 的價格(本專案的 prompt 遠小於此)。
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
    'anthropic: unknown model for pricing, using most expensive',
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

/** 回應中所有 text block 串起來(structured output 的 JSON 字串)。 */
export const responseText = (response) =>
  (Array.isArray(response?.content) ? response.content : [])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text)
    .join('');

export const defaultCreateClient = (apiKey) =>
  new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });

/**
 * @param {{ db: import('better-sqlite3').Database, config: object,
 *           createClient?: (apiKey: string) => object,
 *           now?: () => Date, log?: object,
 *           unavailableMessage?: string, quotaLabel?: string }} deps
 *   unavailableMessage:未設定金鑰時 503 的訊息;quotaLabel:額度用完訊息中的功能名稱
 */
export function createAnthropicCore({
  db,
  config,
  createClient = defaultCreateClient,
  now = () => new Date(),
  log = null,
  unavailableMessage = 'AI 功能未設定',
  quotaLabel = 'AI ',
}) {
  const ai = () => config.ai ?? {};
  const model = () => ai().model || DEFAULT_MODEL;
  const limits = () => ({
    dailyLimitUsd: Number.isFinite(ai().dailyUsd) ? ai().dailyUsd : 1,
    monthlyLimitUsd: Number.isFinite(ai().monthlyUsd) ? ai().monthlyUsd : 10,
  });

  let client = null;
  let clientKey = null;
  const getClient = () => {
    const apiKey = ai().apiKey;
    if (!apiKey) {
      throw new ApiError(503, 'ai_unavailable', unavailableMessage);
    }
    if (!client || clientKey !== apiKey) {
      client = createClient(apiKey);
      clientKey = apiKey;
    }
    return client;
  };

  // 額度不分 purpose:AI 復盤與線上查詢共用同一份日 / 月上限。
  const sumSince = db.prepare(
    'SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_usage WHERE created_at >= ?',
  );
  const insertUsage = db.prepare(`
    INSERT INTO ai_usage (created_at, model, input_tokens, output_tokens,
      cache_read_tokens, cache_write_tokens, cost_usd, verdict, purpose)
    VALUES (@createdAt, @model, @inputTokens, @outputTokens,
      @cacheReadTokens, @cacheWriteTokens, @costUsd, @verdict, @purpose)
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

  const assertQuota = (at = now()) => {
    const s = usageState(at);
    const nums = (used, limit) => `(USD ${round4(used)} / ${round4(limit)})`;
    if (s.monthlyUsd >= s.monthlyLimitUsd) {
      throw new ApiError(
        429,
        'ai_quota_exceeded',
        `本月 ${quotaLabel}額度已用完 ${nums(s.monthlyUsd, s.monthlyLimitUsd)},下個月 1 日(台北時間)恢復`,
      );
    }
    if (s.dailyUsd >= s.dailyLimitUsd) {
      throw new ApiError(
        429,
        'ai_quota_exceeded',
        `今日 ${quotaLabel}額度已用完 ${nums(s.dailyUsd, s.dailyLimitUsd)},明天(台北時間 00:00)恢復`,
      );
    }
  };

  /** 已計費的回應一律記錄;寫入失敗只記 error,不丟棄回應。 */
  const recordUsage = (servedModel, totals, { purpose, verdict = null }) => {
    try {
      insertUsage.run({
        createdAt: now().toISOString(),
        model: servedModel,
        ...totals,
        verdict,
        purpose,
      });
    } catch (err) {
      // 記錄失敗會讓額度少算,記 error 方便追查。
      log?.error?.(
        { err: err?.message, purpose },
        'anthropic: failed to record usage',
      );
    }
  };

  return {
    model,
    getClient,
    assertQuota,
    usageState,
    roundedUsage,
    recordUsage,
  };
}

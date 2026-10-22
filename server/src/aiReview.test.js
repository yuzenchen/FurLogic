import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import {
  computeCost,
  getPricing,
  PRICING,
  REVIEW_SCHEMA,
  SYSTEM_PROMPT,
  taipeiDayStart,
  taipeiMonthStart,
} from './services/aiReview.js';

const API_KEY = 'test-anthropic-key';

const baseConfig = {
  port: 0,
  host: '127.0.0.1',
  dataDir: '.',
  allowedOrigins: ['http://localhost:3000'],
  ai: { apiKey: null, model: 'claude-opus-5-5', dailyUsd: 1, monthlyUsd: 10 },
};

const validBody = () => ({
  pet: { name: 'Mochi', weight: 12 },
  mealTarget: 400,
  mealsCount: 14,
  mealsPerDay: 2,
  items: [
    {
      name: '雞胸肉',
      type: 'protein',
      subtype: null,
      calories: 120,
      protein: 22.5,
      fat: 2.6,
      ca: 5,
      p: 210,
      pct: 70,
      gramsPerMeal: 291.3,
    },
    {
      name: '花椰菜',
      type: 'veg',
      subtype: null,
      calories: 34,
      protein: 2.8,
      fat: 0.4,
      ca: 47,
      p: 66,
      pct: 30,
      gramsPerMeal: 124.8,
    },
  ],
  appResult: {
    totalGramsPerMeal: 416,
    perMealKcal: 350,
    protein: 65.5,
    fat: 7.6,
    ca: 73,
    p: 694,
    caPRatio: 0.11,
    capWarnings: ['蔬菜每餐 124.8 g,超過建議上限 50 g'],
  },
});

const goodReview = {
  verdict: 'warn',
  summary: '計算正確,但鈣磷比偏低,蔬菜超過每餐上限。',
  checks: [
    {
      label: '每餐總重',
      expected: '416 g',
      actual: '416 g',
      ok: true,
      note: '',
    },
    {
      label: '每餐熱量',
      expected: '350 kcal',
      actual: '350 kcal',
      ok: true,
      note: '',
    },
    {
      label: '鈣磷比',
      expected: '0.11',
      actual: '0.11',
      ok: false,
      note: '低於 1.0',
    },
  ],
  suggestions: ['加入蛋殼粉補鈣'],
};

const makeResponse = (overrides = {}) => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  stop_reason: 'end_turn',
  content: [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'text', text: JSON.stringify(goodReview) },
  ],
  usage: {
    input_tokens: 1000,
    output_tokens: 2000,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  },
  ...overrides,
});

/** 假 Anthropic client:beta.messages.create 依序回傳 / 拋出 queue 中的項目。 */
const makeClient = (queue = []) => {
  const items = [...queue];
  const create = vi.fn(async () => {
    const next = items.shift();
    if (!next) throw new Error('no mock left');
    if (next instanceof Error) throw next;
    return next;
  });
  return { beta: { messages: { create } } };
};

describe('AI 復盤 API', () => {
  let app;

  const setup = async ({ ai = {}, client = makeClient() } = {}) => {
    const factory = vi.fn(() => client);
    app = await buildApp({
      dbPath: ':memory:',
      config: { ...baseConfig, ai: { ...baseConfig.ai, ...ai } },
      createAnthropicClient: factory,
    });
    return { client, factory };
  };

  const review = async (payload = validBody()) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/review',
      payload,
    });
    return { status: res.statusCode, body: res.json() };
  };

  const usageRows = () =>
    app.db.prepare('SELECT * FROM ai_usage ORDER BY id').all();

  const insertCost = (createdAt, costUsd) =>
    app.db
      .prepare(
        `INSERT INTO ai_usage (created_at, model, cost_usd, verdict)
         VALUES (?, 'claude-opus-5-5', ?, 'pass')`,
      )
      .run(createdAt, costUsd);

  afterEach(async () => {
    vi.useRealTimers();
    await app?.close();
    app = null;
  });

  it('returns 503 ai_unavailable when ANTHROPIC_API_KEY is not set', async () => {
    const { client, factory } = await setup();
    const res = await review();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: 'ai_unavailable',
      message: 'AI 復盤未設定',
    });
    expect(factory).not.toHaveBeenCalled();
    expect(client.beta.messages.create).not.toHaveBeenCalled();
  });

  it('validates the body strictly (400)', async () => {
    const { client } = await setup({ ai: { apiKey: API_KEY } });
    const bad = [
      { ...validBody(), extra: 1 },
      { ...validBody(), items: [] },
      { ...validBody(), mealsPerDay: 5 },
      { ...validBody(), mealTarget: 0 },
      { ...validBody(), pet: { name: '', weight: 12 } },
      (() => {
        const b = validBody();
        b.items[0].subtype = 'bone';
        return b;
      })(),
      (() => {
        const b = validBody();
        b.items[0].pct = 101;
        return b;
      })(),
      (() => {
        const b = validBody();
        b.items[0].unknown = true;
        return b;
      })(),
      (() => {
        const b = validBody();
        b.appResult.capWarnings = Array(11).fill('x');
        return b;
      })(),
      (() => {
        const b = validBody();
        delete b.appResult.caPRatio;
        return b;
      })(),
    ];
    // 限流(5 次/分)在 body 驗證之前,每批 5 筆重建 app
    for (let i = 0; i < bad.length; i += 1) {
      if (i > 0 && i % 5 === 0) {
        await app.close();
        await setup({ ai: { apiKey: API_KEY }, client });
      }
      const res = await review(bad[i]);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    }
    expect(client.beta.messages.create).not.toHaveBeenCalled();
  });

  it('returns the review, records usage and sends the expected request', async () => {
    const { client, factory } = await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([makeResponse()]),
    });
    const res = await review();
    expect(res.status).toBe(200);
    // 1000 × $4 + 2000 × $20 per MTok = 0.004 + 0.04
    expect(res.body).toEqual({
      review: goodReview,
      model: 'claude-opus-5-5',
      costUsd: 0.044,
      usage: {
        dailyUsd: 0.044,
        dailyLimitUsd: 1,
        monthlyUsd: 0.044,
        monthlyLimitUsd: 10,
      },
    });

    expect(factory).toHaveBeenCalledWith(API_KEY);
    const [request] = client.beta.messages.create.mock.calls[0];
    expect(request.model).toBe('claude-opus-5-5');
    expect(request.system).toBe(SYSTEM_PROMPT);
    expect(request.thinking).toBeUndefined();
    expect(request.output_config).toEqual({
      effort: 'medium',
      format: { type: 'json_schema', schema: REVIEW_SCHEMA },
    });
    expect(request.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(request.fallbacks).toBe('default');
    expect(request.messages[0].content).toContain('"雞胸肉"');

    const rows = usageRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: 'claude-opus-5-5',
      input_tokens: 1000,
      output_tokens: 2000,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      verdict: 'warn',
      purpose: 'review',
    });
    expect(rows[0].cost_usd).toBeCloseTo(0.044, 10);
  });

  it('reuses the client and rebuilds it when the key changes', async () => {
    const { factory } = await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([makeResponse(), makeResponse()]),
    });
    expect((await review()).status).toBe(200);
    expect(factory).toHaveBeenCalledTimes(1);
    app.config.ai.apiKey = 'rotated-key';
    expect((await review()).status).toBe(200);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenLastCalledWith('rotated-key');
  });

  it('truncates over-long summary / checks / suggestions', async () => {
    const long = {
      ...goodReview,
      summary: '字'.repeat(450),
      checks: Array(15).fill(goodReview.checks[0]),
      suggestions: Array(7).fill('建議'),
    };
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([
        makeResponse({
          content: [{ type: 'text', text: JSON.stringify(long) }],
        }),
      ]),
    });
    const res = await review();
    expect(res.status).toBe(200);
    expect([...res.body.review.summary]).toHaveLength(400);
    expect(res.body.review.summary.endsWith('…')).toBe(true);
    expect(res.body.review.checks).toHaveLength(12);
    expect(res.body.review.suggestions).toHaveLength(5);
  });

  it('returns 429 ai_quota_exceeded when the daily quota is used up', async () => {
    const { client } = await setup({ ai: { apiKey: API_KEY, dailyUsd: 0.5 } });
    insertCost(new Date().toISOString(), 0.5);
    const res = await review();
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('ai_quota_exceeded');
    expect(res.body.message).toContain('今日');
    expect(client.beta.messages.create).not.toHaveBeenCalled();
  });

  it('returns 429 ai_quota_exceeded when the monthly quota is used up', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 台北 2026-10-15 12:00;同月較早日期的用量只算月額度
    vi.setSystemTime(new Date('2026-10-15T04:00:00.000Z'));
    const { client } = await setup({ ai: { apiKey: API_KEY, monthlyUsd: 2 } });
    insertCost('2026-10-02T03:00:00.000Z', 1.5);
    insertCost('2026-10-10T03:00:00.000Z', 0.5);
    // 上個月(台北 9/30 23:00)不計入本月
    insertCost('2026-09-30T15:00:00.000Z', 5);
    const res = await review();
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('ai_quota_exceeded');
    expect(res.body.message).toContain('本月');
    expect(client.beta.messages.create).not.toHaveBeenCalled();
  });

  it('returns 502 ai_failed when the client throws (no usage recorded)', async () => {
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([new Error('connection reset')]),
    });
    const res = await review();
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('ai_failed');
    expect(usageRows()).toHaveLength(0);
  });

  it('returns 502 ai_failed for a response missing fields (usage still recorded)', async () => {
    const { verdict, ...missing } = goodReview;
    expect(verdict).toBe('warn');
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([
        makeResponse({
          content: [{ type: 'text', text: JSON.stringify(missing) }],
        }),
        makeResponse({ content: [{ type: 'text', text: 'not json' }] }),
        makeResponse({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ...goodReview, checks: [] }),
            },
          ],
        }),
      ]),
    });
    for (let i = 0; i < 3; i += 1) {
      const res = await review();
      expect(res.status).toBe(502);
      expect(res.body.error).toBe('ai_failed');
    }
    const rows = usageRows();
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.verdict === null)).toBe(true);
  });

  it('returns 502 ai_failed on refusal or max_tokens', async () => {
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([
        makeResponse({
          stop_reason: 'refusal',
          stop_details: { type: 'refusal', category: 'bio', explanation: null },
          content: [],
        }),
        makeResponse({ stop_reason: 'max_tokens' }),
      ]),
    });
    expect((await review()).status).toBe(502);
    expect((await review()).status).toBe(502);
    expect(usageRows()).toHaveLength(2);
  });

  it('rate-limits the 6th review within a minute', async () => {
    await setup();
    for (let i = 0; i < 5; i += 1) {
      expect((await review()).status).toBe(503);
    }
    const res = await review();
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
  });

  it('GET /api/ai/status reports configuration and usage', async () => {
    await setup();
    let res = await app.inject('/api/ai/status');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      configured: false,
      model: 'claude-opus-5-5',
      dailyUsd: 0,
      dailyLimitUsd: 1,
      monthlyUsd: 0,
      monthlyLimitUsd: 10,
    });
    await app.close();

    await setup({ ai: { apiKey: API_KEY, model: 'claude-sonnet-5-5' } });
    insertCost(new Date().toISOString(), 0.123456);
    res = await app.inject('/api/ai/status');
    expect(res.json()).toEqual({
      configured: true,
      model: 'claude-sonnet-5-5',
      dailyUsd: 0.1235,
      dailyLimitUsd: 1,
      monthlyUsd: 0.1235,
      monthlyLimitUsd: 10,
    });
  });
});

describe('AI 復盤成本 / 時間界', () => {
  it('prices every token type per model', () => {
    const cost = computeCost('claude-sonnet-5-5', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    });
    expect(cost.costUsd).toBeCloseTo(2 + 10 + 0.2 + 2.5, 10);
    expect(cost).toMatchObject({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });
    expect(
      computeCost('claude-haiku-5-5', {
        input_tokens: 1_000_000,
        output_tokens: 1_000_000,
      }).costUsd,
    ).toBeCloseTo(0.6, 10);
  });

  it('sums usage.iterations per model instead of top-level usage', () => {
    const cost = computeCost('claude-opus-5', {
      input_tokens: 999,
      output_tokens: 999,
      iterations: [
        {
          type: 'message',
          model: 'claude-opus-5-5',
          input_tokens: 1000,
          output_tokens: 100,
        },
        {
          type: 'fallback_message',
          model: 'claude-opus-5',
          input_tokens: 1000,
          output_tokens: 1000,
        },
      ],
    });
    // opus-5-5: 0.004 + 0.002;opus-5: 0.005 + 0.025
    expect(cost.costUsd).toBeCloseTo(0.036, 10);
    expect(cost.inputTokens).toBe(2000);
    expect(cost.outputTokens).toBe(1100);
  });

  it('prices unknown models at the most expensive rate and warns', () => {
    const log = { warn: vi.fn() };
    const p = getPricing('claude-mystery-9', log);
    const max = Math.max(...Object.values(PRICING).map((x) => x.output));
    expect(p.output).toBe(max);
    expect(log.warn).toHaveBeenCalled();
  });

  it('computes Asia/Taipei day and month starts', () => {
    // UTC 10/31 17:00 = 台北 11/1 01:00
    const now = new Date('2026-10-31T17:00:00.000Z');
    expect(taipeiDayStart(now)).toBe('2026-10-31T16:00:00.000Z');
    expect(taipeiMonthStart(now)).toBe('2026-10-31T16:00:00.000Z');
    const mid = new Date('2026-10-15T04:00:00.000Z');
    expect(taipeiDayStart(mid)).toBe('2026-10-14T16:00:00.000Z');
    expect(taipeiMonthStart(mid)).toBe('2026-09-30T16:00:00.000Z');
  });
});

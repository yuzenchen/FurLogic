import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { LOOKUP_SCHEMA, SYSTEM_PROMPT } from './services/foodLookup.js';

const API_KEY = 'test-anthropic-key';

const baseConfig = {
  port: 0,
  host: '127.0.0.1',
  dataDir: '.',
  allowedOrigins: ['http://localhost:3000'],
  ai: { apiKey: null, model: 'claude-opus-5-5', dailyUsd: 1, monthlyUsd: 10 },
};

const salmonDraft = (overrides = {}) => ({
  name: '鮭魚',
  nameEn: 'Atlantic salmon',
  type: 'protein',
  recipeRole: 'protein',
  subtype: 'fatty_fish',
  safety: 'safe',
  warning: null,
  description: '富含 Omega-3,務必去刺煮熟。',
  calories: 142.44,
  protein: 19.84,
  fat: 6.34,
  ca: 12,
  p: 200,
  sourceRef: 'USDA SR Legacy 估算',
  ...overrides,
});

const recognizedReply = (draftOverrides = {}, extra = {}) => ({
  recognized: true,
  reason: '',
  draft: salmonDraft(draftOverrides),
  confidence: 'high',
  note: '野生大西洋鮭魚生重。',
  ...extra,
});

const unrecognizedReply = (reason) => ({
  recognized: false,
  reason,
  draft: null,
  confidence: 'low',
  note: '',
});

const makeResponse = (obj, overrides = {}) => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  stop_reason: 'end_turn',
  content: [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) },
  ],
  usage: {
    input_tokens: 2000,
    output_tokens: 500,
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

describe('POST /api/foods/lookup (Claude)', () => {
  let app;

  const setup = async ({ ai = {}, client = makeClient() } = {}) => {
    const factory = vi.fn(() => client);
    app = await buildApp({
      dbPath: ':memory:',
      config: { ...baseConfig, ai: { ...baseConfig.ai, ...ai } },
      createAnthropicClient: factory,
    });
    return { client, factory, create: client.beta.messages.create };
  };

  const lookup = async (query) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/foods/lookup',
      payload: { query },
    });
    return { status: res.statusCode, body: res.json() };
  };

  const usageRows = () =>
    app.db.prepare('SELECT * FROM ai_usage ORDER BY id').all();

  const cacheRow = (key) =>
    app.db.prepare('SELECT * FROM lookup_cache WHERE query = ?').get(key);

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it('returns 503 ai_unavailable when ANTHROPIC_API_KEY is not set', async () => {
    const { factory, create } = await setup();
    const res = await lookup('鮭魚');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('ai_unavailable');
    expect(factory).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('returns a draft in the POST /api/foods format and sends the expected request', async () => {
    const { create, factory } = await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([
        makeResponse(recognizedReply({ name: '大西洋鮭魚' })),
      ]),
    });
    const res = await lookup('  大西洋 鮭魚  ');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      draft: {
        name: '大西洋鮭魚',
        nameEn: 'Atlantic salmon',
        type: 'protein',
        recipeRole: 'protein',
        subtype: 'fatty_fish',
        safety: 'safe',
        warning: null,
        description: '富含 Omega-3,務必去刺煮熟。',
        calories: 142.4,
        protein: 19.8,
        fat: 6.3,
        ca: 12,
        p: 200,
        source: 'ai',
        sourceRef: 'USDA SR Legacy 估算',
      },
      confidence: 'high',
      note: '野生大西洋鮭魚生重。',
      cached: false,
    });

    expect(factory).toHaveBeenCalledWith(API_KEY);
    const [request] = create.mock.calls[0];
    expect(request.model).toBe('claude-opus-5-5');
    expect(request.system).toBe(SYSTEM_PROMPT);
    expect(request.thinking).toBeUndefined();
    expect(request.max_tokens).toBeGreaterThanOrEqual(8000);
    expect(request.output_config).toEqual({
      effort: 'low',
      format: { type: 'json_schema', schema: LOOKUP_SCHEMA },
    });
    expect(request.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(request.fallbacks).toBe('default');
    expect(request.messages[0].content).toContain('<query>大西洋 鮭魚</query>');

    // 草稿可以直接送去建立食材
    const created = await app.inject({
      method: 'POST',
      url: '/api/foods',
      payload: res.body.draft,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: '大西洋鮭魚', source: 'ai' });
  });

  it('passes through medium / low confidence', async () => {
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([
        makeResponse(
          recognizedReply(
            { name: '鴕鳥肉', subtype: null },
            { confidence: 'medium', note: '' },
          ),
        ),
        makeResponse(
          recognizedReply(
            { name: '鹿肉', subtype: null },
            { confidence: 'low' },
          ),
        ),
      ]),
    });
    const a = await lookup('鴕鳥肉');
    expect(a.status).toBe(200);
    expect(a.body.confidence).toBe('medium');
    expect(a.body.note).toBe('');
    const b = await lookup('鹿肉');
    expect(b.body.confidence).toBe('low');
  });

  it('records ai_usage with purpose food_lookup', async () => {
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([makeResponse(recognizedReply())]),
    });
    await lookup('鮭魚');
    const rows = usageRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      purpose: 'food_lookup',
      verdict: 'recognized',
      model: 'claude-opus-5-5',
      input_tokens: 2000,
      output_tokens: 500,
    });
    // 2000 × $4 + 500 × $20 per MTok = 0.008 + 0.01
    expect(rows[0].cost_usd).toBeCloseTo(0.018, 10);
  });

  it('returns 422 food_unrecognized and caches it', async () => {
    const reason = '無法辨識「qwzx」是什麼食材,請輸入正確的食材名稱。';
    const { create } = await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([makeResponse(unrecognizedReply(reason))]),
    });
    const first = await lookup('QW zx');
    expect(first.status).toBe(422);
    expect(first.body).toEqual({ error: 'food_unrecognized', message: reason });
    expect(usageRows()[0]).toMatchObject({
      purpose: 'food_lookup',
      verdict: 'unrecognized',
    });

    // 快取 key:小寫、去空白
    const row = cacheRow('qwzx');
    expect(row.source).toBe('unrecognized');
    expect(JSON.parse(row.response_json)).toEqual({
      v: 2,
      kind: 'unrecognized',
      message: reason,
    });

    const second = await lookup(' qwZX ');
    expect(second.status).toBe(422);
    expect(second.body).toEqual(first.body);
    expect(create).toHaveBeenCalledTimes(1);
    expect(usageRows()).toHaveLength(1);
  });

  it('uses a default message when the unrecognized reason is empty', async () => {
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([makeResponse(unrecognizedReply('  '))]),
    });
    const res = await lookup('那個');
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('「那個」');
  });

  it('serves a cache hit without calling the client (even with no key)', async () => {
    const { create } = await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([makeResponse(recognizedReply())]),
    });
    const first = await lookup('Atlantic Salmon');
    expect(first.body.cached).toBe(false);

    const second = await lookup('atlantic   salmon');
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(second.body.draft).toEqual(first.body.draft);
    expect(second.body.confidence).toBe('high');
    expect(second.body.note).toBe(first.body.note);
    expect(create).toHaveBeenCalledTimes(1);

    app.config.ai.apiKey = null;
    const third = await lookup('ATLANTICSALMON');
    expect(third.status).toBe(200);
    expect(third.body.cached).toBe(true);

    const row = cacheRow('atlanticsalmon');
    expect(row.source).toBe('ai');
    expect(row.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(usageRows()).toHaveLength(1);
  });

  it('ignores an old-format (Gemini / USDA) cache entry and overwrites it', async () => {
    const { create } = await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([makeResponse(recognizedReply())]),
    });
    app.db
      .prepare(
        `INSERT INTO lookup_cache (query, response_json, source, fetched_at)
         VALUES ('鮭魚', ?, 'usda', '2026-01-01T00:00:00.000Z')`,
      )
      .run(
        JSON.stringify({
          draft: { name: '鮭魚', source: 'usda' },
          confidence: 'high',
          cached: false,
        }),
      );
    const res = await lookup('鮭魚');
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.draft.source).toBe('ai');
    expect(create).toHaveBeenCalledTimes(1);
    expect(cacheRow('鮭魚').source).toBe('ai');
  });

  it('returns 429 ai_quota_exceeded sharing the quota with AI review', async () => {
    const { create } = await setup({ ai: { apiKey: API_KEY, dailyUsd: 0.5 } });
    // AI 復盤(purpose NULL = 舊資料)的花費也算進同一份額度
    app.db
      .prepare(
        `INSERT INTO ai_usage (created_at, model, cost_usd, verdict)
         VALUES (?, 'claude-opus-5-5', 0.5, 'pass')`,
      )
      .run(new Date().toISOString());
    const res = await lookup('鮭魚');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('ai_quota_exceeded');
    expect(res.body.message).toContain('今日');
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 502 ai_failed when the client throws (no usage, no cache)', async () => {
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([new Error('connection reset')]),
    });
    const res = await lookup('鮭魚');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('ai_failed');
    expect(JSON.stringify(res.body)).not.toContain(API_KEY);
    expect(usageRows()).toHaveLength(0);
    expect(cacheRow('鮭魚')).toBeUndefined();
  });

  it('returns 502 ai_failed for refusal / max_tokens / schema-invalid responses', async () => {
    const { calories, ...missingCalories } = salmonDraft();
    expect(calories).toBeGreaterThan(0);
    const bad = [
      makeResponse(recognizedReply(), {
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: null, explanation: null },
        content: [],
      }),
      makeResponse(recognizedReply(), { stop_reason: 'max_tokens' }),
      makeResponse('not json'),
      makeResponse({ ...recognizedReply(), draft: missingCalories }),
      makeResponse(recognizedReply({ type: 'meat' })),
      makeResponse(recognizedReply({}, { confidence: 'sure' })),
      makeResponse(recognizedReply({ name: '' })),
      makeResponse(recognizedReply({ name: '字'.repeat(41) })),
      makeResponse(recognizedReply({ description: '字'.repeat(61) })),
    ];
    await setup({ ai: { apiKey: API_KEY }, client: makeClient(bad) });
    // 限流 10 次/分:9 筆在上限內
    for (let i = 0; i < bad.length; i += 1) {
      const res = await lookup(`食材${i}`);
      expect(res.status).toBe(502);
      expect(res.body.error).toBe('ai_failed');
    }
    const rows = usageRows();
    expect(rows).toHaveLength(bad.length);
    expect(rows.every((r) => r.purpose === 'food_lookup')).toBe(true);
    expect(rows.every((r) => r.verdict === null)).toBe(true);
    expect(
      app.db.prepare('SELECT COUNT(*) AS n FROM lookup_cache').get().n,
    ).toBe(0);
  });

  it('returns 502 ai_failed for out-of-range nutrients', async () => {
    const bad = [
      { calories: 0 },
      { calories: 0.01 }, // 四捨五入後為 0
      { calories: 950 },
      { protein: -1 },
      { fat: 120 },
      { ca: 50000 },
      { p: 25000 },
      { protein: '20' },
      { safety: 'caution', warning: null }, // caution 必須有提醒
    ];
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient(bad.map((o) => makeResponse(recognizedReply(o)))),
    });
    for (let i = 0; i < bad.length; i += 1) {
      const res = await lookup(`越界${i}`);
      expect(res.status).toBe(502);
      expect(res.body.error).toBe('ai_failed');
    }
  });

  it('corrects inconsistent type / recipeRole / safety and logs a warning', async () => {
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([
        makeResponse(
          recognizedReply({
            name: '葡萄',
            nameEn: 'Grapes',
            type: 'fruit',
            recipeRole: 'plant',
            subtype: 'organ',
            safety: 'toxic',
            warning: '致死風險:急性腎衰竭',
            calories: 69,
          }),
        ),
        makeResponse(
          recognizedReply({
            name: '雞腿肉',
            subtype: null,
            recipeRole: 'excluded',
            safety: 'safe',
            warning: '去皮',
          }),
        ),
      ]),
    });
    const warn = vi.spyOn(app.log, 'warn');
    const grape = await lookup('葡萄');
    expect(grape.status).toBe(200);
    expect(grape.body.draft).toMatchObject({
      safety: 'toxic',
      recipeRole: 'excluded',
      subtype: null,
      warning: '致死風險:急性腎衰竭',
    });
    const chicken = await lookup('雞腿肉');
    expect(chicken.body.draft).toMatchObject({
      safety: 'safe',
      recipeRole: 'protein',
      warning: null,
    });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('normalizes empty nameEn / sourceRef to null', async () => {
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([
        makeResponse(recognizedReply({ nameEn: '  ', sourceRef: '' })),
      ]),
    });
    const res = await lookup('鮭魚');
    expect(res.body.draft.nameEn).toBeNull();
    expect(res.body.draft.sourceRef).toBeNull();
  });

  it('does not create a food row', async () => {
    await setup({
      ai: { apiKey: API_KEY },
      client: makeClient([makeResponse(recognizedReply())]),
    });
    const count = () =>
      app.db.prepare('SELECT COUNT(*) AS n FROM foods').get().n;
    const before = count();
    const res = await lookup('鮭魚');
    expect(res.status).toBe(200);
    expect(count()).toBe(before);
  });

  it('rate-limits the 11th request within a minute', async () => {
    await setup();
    for (let i = 0; i < 10; i += 1) {
      const res = await lookup(`food ${i}`);
      expect(res.status).toBe(503);
    }
    const res = await lookup('food 10');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
  });

  it('rejects an empty or whitespace-only query with 400', async () => {
    await setup();
    for (const query of ['', '   ']) {
      const res = await lookup(query);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    }
    const extra = await app.inject({
      method: 'POST',
      url: '/api/foods/lookup',
      payload: { query: 'x', foo: 1 },
    });
    expect(extra.statusCode).toBe(400);
  });

  it('does not clash with /api/foods/:id routes', async () => {
    await setup();
    const put = await app.inject({
      method: 'PUT',
      url: '/api/foods/lookup',
      payload: { name: 'x' },
    });
    expect(put.statusCode).toBe(400); // :id 必須是整數
    const list = await app.inject({ method: 'GET', url: '/api/foods' });
    expect(list.statusCode).toBe(200);
  });
});

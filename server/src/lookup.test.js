import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';

const baseConfig = {
  port: 0,
  host: '127.0.0.1',
  dataDir: '.',
  allowedOrigins: ['http://localhost:3000'],
  geminiApiKey: null,
  usdaApiKey: null,
  geminiModel: 'gemini-2.5-flash',
};

const GEMINI_KEY = 'test-gemini-key';
const USDA_KEY = 'test-usda-key';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const geminiReply = (obj) =>
  jsonResponse({
    candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
  });

const classification = (overrides = {}) => ({
  nameZh: '鮭魚',
  nameEn: 'salmon atlantic raw',
  type: 'protein',
  recipeRole: 'protein',
  safety: 'safe',
  warning: null,
  description: '富含 Omega-3 的魚肉。',
  ...overrides,
});

const nutrient = (nutrientId, nutrientNumber, value, unitName) => ({
  nutrientId,
  nutrientNumber,
  value,
  unitName,
});

const salmonFood = {
  fdcId: 175167,
  dataType: 'SR Legacy',
  description: 'Fish, salmon, Atlantic, wild, raw',
  foodNutrients: [
    nutrient(1008, '208', 142.4, 'KCAL'),
    nutrient(1062, '268', 594, 'kJ'),
    nutrient(1003, '203', 19.84, 'G'),
    nutrient(1004, '204', 6.34, 'G'),
    nutrient(1301, '301', 12.4, 'MG'),
    nutrient(1305, '305', 200.4, 'MG'),
  ],
};

/** 依 URL 分流的假 fetch;handlers 回傳 Response 或拋錯。 */
const makeFetch = ({ gemini = [], usda = [] } = {}) => {
  const queues = { gemini: [...gemini], usda: [...usda] };
  return vi.fn(async (url) => {
    const kind = String(url).includes('generativelanguage')
      ? 'gemini'
      : String(url).includes('api.nal.usda.gov')
        ? 'usda'
        : null;
    if (!kind) throw new Error(`unexpected url ${url}`);
    const next = queues[kind].shift();
    if (!next) throw new Error(`no mock left for ${kind}`);
    return typeof next === 'function' ? next() : next;
  });
};

const callsTo = (fetchMock, host) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes(host));

describe('POST /api/foods/lookup', () => {
  let app;

  const setup = async (configOverrides = {}, fetchMock = makeFetch()) => {
    app = await buildApp({
      dbPath: ':memory:',
      config: { ...baseConfig, ...configOverrides },
      fetch: fetchMock,
    });
    return fetchMock;
  };

  const lookup = async (query) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/foods/lookup',
      payload: { query },
    });
    return { status: res.statusCode, body: res.json() };
  };

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it('returns 503 lookup_unavailable when no keys are configured', async () => {
    const fetchMock = await setup();
    const res = await lookup('鮭魚');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('lookup_unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Gemini + USDA happy path returns a high-confidence USDA draft', async () => {
    const fetchMock = await setup(
      { geminiApiKey: GEMINI_KEY, usdaApiKey: USDA_KEY },
      makeFetch({
        gemini: [geminiReply(classification())],
        usda: [jsonResponse({ foods: [salmonFood] })],
      }),
    );
    const res = await lookup('  鮭魚  ');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      draft: {
        name: '鮭魚',
        nameEn: 'salmon atlantic raw',
        type: 'protein',
        recipeRole: 'protein',
        safety: 'safe',
        warning: null,
        description: '富含 Omega-3 的魚肉。',
        calories: 142,
        protein: 19.8,
        fat: 6.3,
        ca: 12,
        p: 200,
        source: 'usda',
        sourceRef: 'FDC 175167',
      },
      confidence: 'high',
      cached: false,
    });

    const [geminiUrl, geminiInit] = callsTo(fetchMock, 'generativelanguage')[0];
    expect(geminiUrl).toContain('gemini-2.5-flash:generateContent');
    expect(geminiUrl).not.toContain(GEMINI_KEY);
    const geminiBody = JSON.parse(geminiInit.body);
    expect(geminiBody.generationConfig.responseMimeType).toBe(
      'application/json',
    );
    expect(geminiBody.generationConfig.responseSchema).toBeTruthy();
    expect(geminiInit.signal).toBeInstanceOf(AbortSignal);

    const [usdaUrl, usdaInit] = callsTo(fetchMock, 'api.nal.usda.gov')[0];
    expect(usdaUrl).toBe(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}`,
    );
    expect(usdaInit.method).toBe('POST');
    expect(JSON.parse(usdaInit.body)).toEqual({
      query: 'salmon atlantic raw',
      dataType: ['Foundation', 'SR Legacy'],
      pageSize: 10,
    });
    expect(usdaInit.signal).toBeInstanceOf(AbortSignal);
  });

  it('prefers a Foundation food and parses Atwater-only energy (2047)', async () => {
    const foundation = {
      fdcId: 2346393,
      dataType: 'Foundation',
      foodNutrients: [
        nutrient(2047, '957', 120.6, 'KCAL'),
        nutrient(1003, '203', 22.55, 'G'),
        nutrient(1004, '204', 2.62, 'G'),
        // 缺鈣、磷 → 0
      ],
    };
    const noEnergyFoundation = {
      fdcId: 1,
      dataType: 'Foundation',
      foodNutrients: [nutrient(1003, '203', 30, 'G')],
    };
    await setup(
      { geminiApiKey: GEMINI_KEY, usdaApiKey: USDA_KEY },
      makeFetch({
        gemini: [
          geminiReply(classification({ nameZh: '雞胸肉', nameEn: 'chicken' })),
        ],
        usda: [
          jsonResponse({ foods: [salmonFood, noEnergyFoundation, foundation] }),
        ],
      }),
    );
    const res = await lookup('雞胸肉');
    expect(res.status).toBe(200);
    expect(res.body.draft).toMatchObject({
      calories: 121,
      protein: 22.6,
      fat: 2.6,
      ca: 0,
      p: 0,
      source: 'usda',
      sourceRef: 'FDC 2346393',
    });
  });

  it('falls back to a Gemini estimate when USDA finds nothing', async () => {
    const fetchMock = await setup(
      { geminiApiKey: GEMINI_KEY, usdaApiKey: USDA_KEY },
      makeFetch({
        gemini: [
          geminiReply(
            classification({ nameZh: '鴕鳥肉', nameEn: 'ostrich meat' }),
          ),
          geminiReply({
            calories: 116.6,
            protein: 21.94,
            fat: 2.65,
            ca: 6.4,
            p: 211.5,
          }),
        ],
        usda: [jsonResponse({ foods: [] })],
      }),
    );
    const res = await lookup('鴕鳥肉');
    expect(res.status).toBe(200);
    expect(res.body.confidence).toBe('low');
    expect(res.body.draft).toMatchObject({
      name: '鴕鳥肉',
      nameEn: 'ostrich meat',
      calories: 117,
      protein: 21.9,
      fat: 2.7,
      ca: 6,
      p: 212,
      source: 'ai',
      sourceRef: 'gemini-2.5-flash',
    });
    expect(callsTo(fetchMock, 'generativelanguage')).toHaveLength(2);
  });

  it('USDA key only uses the query as search term and default classification', async () => {
    const fetchMock = await setup(
      { usdaApiKey: USDA_KEY },
      makeFetch({ usda: [jsonResponse({ foods: [salmonFood] })] }),
    );
    const res = await lookup('Salmon   Raw');
    expect(res.status).toBe(200);
    expect(res.body.draft).toMatchObject({
      name: 'Salmon Raw',
      nameEn: 'Salmon Raw',
      type: 'veg',
      recipeRole: 'plant',
      safety: 'caution',
      warning: '未經 AI 判定安全性,請自行確認',
      source: 'usda',
    });
    expect(res.body.confidence).toBe('high');
    const [, init] = callsTo(fetchMock, 'api.nal.usda.gov')[0];
    expect(JSON.parse(init.body).query).toBe('Salmon Raw');
    expect(callsTo(fetchMock, 'generativelanguage')).toHaveLength(0);
  });

  it('serves a second identical lookup from cache without calling fetch', async () => {
    const fetchMock = await setup(
      { geminiApiKey: GEMINI_KEY, usdaApiKey: USDA_KEY },
      makeFetch({
        gemini: [geminiReply(classification())],
        usda: [jsonResponse({ foods: [salmonFood] })],
      }),
    );
    const first = await lookup('鮭魚');
    expect(first.body.cached).toBe(false);
    const callsAfterFirst = fetchMock.mock.calls.length;

    const second = await lookup(' 鮭魚 ');
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(second.body.draft).toEqual(first.body.draft);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);

    const row = app.db
      .prepare('SELECT * FROM lookup_cache WHERE query = ?')
      .get('鮭魚');
    expect(row.source).toBe('usda');
    expect(row.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('maps a Gemini HTTP 500 to 502 lookup_failed without leaking keys', async () => {
    await setup(
      { geminiApiKey: GEMINI_KEY, usdaApiKey: USDA_KEY },
      makeFetch({ gemini: [jsonResponse({ error: 'boom' }, 500)] }),
    );
    const res = await lookup('鮭魚');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('lookup_failed');
    expect(JSON.stringify(res.body)).not.toContain(GEMINI_KEY);
  });

  it('maps a timeout to 502 lookup_failed', async () => {
    await setup(
      { usdaApiKey: USDA_KEY },
      makeFetch({
        usda: [
          () => {
            throw new DOMException(
              'The operation was aborted due to timeout',
              'TimeoutError',
            );
          },
        ],
      }),
    );
    const res = await lookup('salmon');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('lookup_failed');
    expect(JSON.stringify(res.body)).not.toContain(USDA_KEY);
  });

  it('returns 404 lookup_not_found when USDA-only search finds nothing', async () => {
    await setup(
      { usdaApiKey: USDA_KEY },
      makeFetch({ usda: [jsonResponse({ foods: [] })] }),
    );
    const res = await lookup('unobtainium');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('lookup_not_found');
  });

  it('forces recipeRole excluded for foods toxic to dogs', async () => {
    await setup(
      { geminiApiKey: GEMINI_KEY, usdaApiKey: USDA_KEY },
      makeFetch({
        gemini: [
          geminiReply(
            classification({
              nameZh: '葡萄',
              nameEn: 'grapes raw',
              type: 'fruit',
              recipeRole: 'plant',
              safety: 'toxic',
              warning: '可能導致急性腎衰竭',
            }),
          ),
        ],
        usda: [jsonResponse({ foods: [salmonFood] })],
      }),
    );
    const res = await lookup('葡萄');
    expect(res.body.draft.safety).toBe('toxic');
    expect(res.body.draft.recipeRole).toBe('excluded');
  });

  it('does not create a food row', async () => {
    await setup(
      { geminiApiKey: GEMINI_KEY, usdaApiKey: USDA_KEY },
      makeFetch({
        gemini: [geminiReply(classification())],
        usda: [jsonResponse({ foods: [salmonFood] })],
      }),
    );
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

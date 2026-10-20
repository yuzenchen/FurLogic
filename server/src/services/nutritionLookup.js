import { ApiError } from '../errors.js';

/**
 * 線上營養查詢:Gemini 判定分類/安全性 → USDA FoodData Central 取實測營養
 * → 查不到時再請 Gemini 估算。結果寫入 lookup_cache,不會寫入 foods。
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const USDA_SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const TIMEOUT_MS = 10_000;

const FOOD_TYPES = ['protein', 'veg', 'fruit', 'starch', 'snack'];
const RECIPE_ROLES = ['protein', 'plant', 'excluded'];
const SAFETY = ['safe', 'caution', 'toxic'];
const FOOD_SUBTYPES = ['organ', 'fatty_fish'];

const DEFAULT_CLASSIFICATION = {
  nameZh: null,
  type: 'veg',
  recipeRole: 'plant',
  subtype: null,
  safety: 'caution',
  warning: '未經 AI 判定安全性,請自行確認',
  description: null,
};

const CLASSIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nameZh: { type: 'STRING' },
    nameEn: { type: 'STRING' },
    type: { type: 'STRING', enum: FOOD_TYPES },
    recipeRole: { type: 'STRING', enum: RECIPE_ROLES },
    subtype: { type: 'STRING', enum: FOOD_SUBTYPES, nullable: true },
    safety: { type: 'STRING', enum: SAFETY },
    warning: { type: 'STRING', nullable: true },
    description: { type: 'STRING' },
  },
  required: [
    'nameZh',
    'nameEn',
    'type',
    'recipeRole',
    'subtype',
    'safety',
    'warning',
    'description',
  ],
};

const ESTIMATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    calories: { type: 'NUMBER', minimum: 0 },
    protein: { type: 'NUMBER', minimum: 0 },
    fat: { type: 'NUMBER', minimum: 0 },
    ca: { type: 'NUMBER', minimum: 0 },
    p: { type: 'NUMBER', minimum: 0 },
  },
  required: ['calories', 'protein', 'fat', 'ca', 'p'],
};

/** USDA nutrientId / nutrientNumber 對照。 */
const NUTRIENTS = {
  energy: { ids: [1008], numbers: ['208'] },
  atwaterGeneral: { ids: [2047], numbers: ['957'] },
  atwaterSpecific: { ids: [2048], numbers: ['958'] },
  protein: { ids: [1003], numbers: ['203'] },
  fat: { ids: [1004], numbers: ['204'] },
  ca: { ids: [1301], numbers: ['301'] },
  p: { ids: [1305], numbers: ['305'] },
};

const normalizeQuery = (query) => String(query).trim().replace(/\s+/g, ' ');

const hasCjk = (s) => /[㐀-鿿豈-﫿]/.test(s);

const round = (n, digits = 0) => {
  const f = 10 ** digits;
  return Math.round((Number(n) || 0) * f) / f;
};

const lookupFailed = () =>
  new ApiError(502, 'lookup_failed', '線上查詢失敗,請稍後再試');

const pickEnum = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

const cleanString = (value) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const findNutrient = (foodNutrients, spec, unit) => {
  const hit = foodNutrients.find((n) => {
    const idMatch = spec.ids.includes(Number(n.nutrientId));
    const numMatch = spec.numbers.includes(String(n.nutrientNumber ?? ''));
    if (!idMatch && !numMatch) return false;
    if (unit && String(n.unitName ?? '').toUpperCase() !== unit) return false;
    return typeof n.value === 'number' && Number.isFinite(n.value);
  });
  return hit ? hit.value : null;
};

/** 從 USDA 單筆 food 取每 100 g 營養;沒有 kcal 熱量時回傳 null。 */
export const parseUsdaFood = (food) => {
  const list = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  const calories =
    findNutrient(list, NUTRIENTS.energy, 'KCAL') ??
    findNutrient(list, NUTRIENTS.atwaterGeneral, 'KCAL') ??
    findNutrient(list, NUTRIENTS.atwaterSpecific, 'KCAL');
  if (calories === null) return null;
  return {
    calories,
    protein: findNutrient(list, NUTRIENTS.protein) ?? 0,
    fat: findNutrient(list, NUTRIENTS.fat) ?? 0,
    ca: findNutrient(list, NUTRIENTS.ca) ?? 0,
    p: findNutrient(list, NUTRIENTS.p) ?? 0,
  };
};

const pickUsdaFood = (foods) => {
  for (const dataType of ['Foundation', 'SR Legacy']) {
    for (const food of foods) {
      if (food?.dataType !== dataType) continue;
      const nutrients = parseUsdaFood(food);
      if (nutrients) return { fdcId: food.fdcId, nutrients };
    }
  }
  return null;
};

/**
 * @param {{ db: import('better-sqlite3').Database, config: object,
 *           fetch?: typeof fetch, now?: () => Date, log?: object }} deps
 */
export function createNutritionLookup({
  db,
  config,
  fetch = globalThis.fetch,
  now = () => new Date(),
  log = null,
}) {
  const model = config.geminiModel || 'gemini-2.5-flash';
  const getCache = db.prepare(
    'SELECT response_json FROM lookup_cache WHERE query = ?',
  );
  const putCache = db.prepare(`
    INSERT INTO lookup_cache (query, response_json, source, fetched_at)
    VALUES (@query, @response_json, @source, @fetched_at)
    ON CONFLICT (query) DO UPDATE SET
      response_json = excluded.response_json,
      source = excluded.source,
      fetched_at = excluded.fetched_at
  `);

  const fail = (service, detail) => {
    log?.error?.({ service, detail }, 'nutrition lookup failed');
    return lookupFailed();
  };

  /** 呼叫外部 JSON API;任何網路/逾時/HTTP/JSON 錯誤都轉成 502。 */
  const postJson = async (service, url, body, headers = {}) => {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw fail(service, `${err?.name ?? 'Error'}: ${err?.message ?? ''}`);
    }
    if (!res.ok) throw fail(service, `HTTP ${res.status}`);
    try {
      return await res.json();
    } catch (err) {
      throw fail(service, `bad JSON: ${err?.message ?? ''}`);
    }
  };

  const askGemini = async (prompt, schema) => {
    const data = await postJson(
      'gemini',
      `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      },
      { 'x-goog-api-key': config.geminiApiKey },
    );
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') throw fail('gemini', 'empty response');
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('not object');
      return parsed;
    } catch (err) {
      throw fail('gemini', `non-JSON response: ${err?.message ?? ''}`);
    }
  };

  const classify = async (query) => {
    const raw = await askGemini(
      `你是狗狗鮮食營養助理。使用者輸入了一個食材名稱:「${query}」。
請判斷這個食材並以 JSON 回答:
- nameZh:繁體中文常用短名。
- nameEn:用於 USDA FoodData Central 搜尋的英文詞(生的、未調味,例如 "chicken breast raw")。
- type:protein|veg|fruit|starch|snack 之一。
- recipeRole:protein(肉/蛋/魚等蛋白質主食)、plant(蔬果澱粉)、excluded(不適合入菜)。
- subtype:內臟類(肝、心、腎、胗、綜合內臟)→ organ;高脂魚類(鮭魚、鯖魚、秋刀魚、沙丁魚)→ fatty_fish;其餘 null。
- safety:對狗狗的安全性 safe|caution|toxic。
- warning:繁體中文注意事項,沒有就 null。
- description:繁體中文一句話簡介。
對狗有毒(toxic)的食材 recipeRole 必須是 excluded。`,
      CLASSIFY_SCHEMA,
    );
    const safety = pickEnum(raw.safety, SAFETY, 'caution');
    return {
      nameZh: cleanString(raw.nameZh),
      nameEn: cleanString(raw.nameEn) ?? query,
      type: pickEnum(raw.type, FOOD_TYPES, 'veg'),
      recipeRole:
        safety === 'toxic'
          ? 'excluded'
          : pickEnum(raw.recipeRole, RECIPE_ROLES, 'plant'),
      subtype: pickEnum(raw.subtype, FOOD_SUBTYPES, null),
      safety,
      warning: cleanString(raw.warning),
      description: cleanString(raw.description),
    };
  };

  const searchUsda = async (term) => {
    const data = await postJson(
      'usda',
      `${USDA_SEARCH}?api_key=${encodeURIComponent(config.usdaApiKey)}`,
      { query: term, dataType: ['Foundation', 'SR Legacy'], pageSize: 10 },
    );
    const foods = Array.isArray(data?.foods) ? data.foods : [];
    return pickUsdaFood(foods);
  };

  const estimate = async (query, nameEn) => {
    const raw = await askGemini(
      `請估算食材「${query}」(英文:${nameEn})每 100 公克生重的營養成分,以 JSON 回答:
calories(kcal)、protein(g)、fat(g)、ca(鈣 mg)、p(磷 mg),皆為 ≥ 0 的數字。`,
      ESTIMATE_SCHEMA,
    );
    const keys = ['calories', 'protein', 'fat', 'ca', 'p'];
    const valid = keys.every(
      (k) =>
        typeof raw[k] === 'number' && Number.isFinite(raw[k]) && raw[k] >= 0,
    );
    if (!valid || raw.calories <= 0) return null;
    return Object.fromEntries(keys.map((k) => [k, raw[k]]));
  };

  /** 使用者原始輸入為主;只有輸入不含中文、而 Gemini 給了中文名時才採用。 */
  const pickName = (query, nameZh) => {
    const name = nameZh && !hasCjk(query) && hasCjk(nameZh) ? nameZh : query;
    return name.slice(0, 40);
  };

  async function lookup(rawQuery) {
    const query = normalizeQuery(rawQuery);
    const cacheKey = query.toLowerCase();

    const hit = getCache.get(cacheKey);
    if (hit) {
      try {
        return { ...JSON.parse(hit.response_json), cached: true };
      } catch {
        // 快取壞掉就當作沒命中,重新查詢後覆寫。
      }
    }

    const hasGemini = Boolean(config.geminiApiKey);
    const hasUsda = Boolean(config.usdaApiKey);
    if (!hasGemini && !hasUsda) {
      throw new ApiError(503, 'lookup_unavailable', '線上查詢未設定');
    }

    const info = hasGemini
      ? await classify(query)
      : { ...DEFAULT_CLASSIFICATION, nameEn: query };

    let nutrients = null;
    let source = null;
    let sourceRef = null;
    let confidence = null;

    if (hasUsda) {
      const found = await searchUsda(info.nameEn);
      if (found) {
        nutrients = found.nutrients;
        source = 'usda';
        sourceRef = `FDC ${found.fdcId}`;
        confidence = 'high';
      }
    }
    if (!nutrients && hasGemini) {
      nutrients = await estimate(query, info.nameEn);
      if (nutrients) {
        source = 'ai';
        sourceRef = model;
        confidence = 'low';
      }
    }
    if (!nutrients) {
      throw new ApiError(404, 'lookup_not_found', `查無「${query}」的營養資料`);
    }

    const response = {
      draft: {
        name: pickName(query, info.nameZh),
        nameEn: info.nameEn,
        type: info.type,
        recipeRole: info.recipeRole,
        subtype: info.subtype ?? null,
        safety: info.safety,
        warning: info.warning,
        description: info.description,
        calories: round(nutrients.calories),
        protein: round(nutrients.protein, 1),
        fat: round(nutrients.fat, 1),
        ca: round(nutrients.ca),
        p: round(nutrients.p),
        source,
        sourceRef,
      },
      confidence,
      cached: false,
    };

    putCache.run({
      query: cacheKey,
      response_json: JSON.stringify(response),
      source,
      fetched_at: now().toISOString(),
    });
    return response;
  }

  return { lookup };
}

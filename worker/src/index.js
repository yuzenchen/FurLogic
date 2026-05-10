/**
 * FurLogic Vision Worker
 *
 * Proxies a single image (base64 dataURL) to Google Gemini and returns
 * a list of pet-safe ingredients identified in the photo, mapped to the
 * client-supplied food database. The Worker holds the API key so it
 * never leaks to the browser.
 *
 * Endpoints:
 *   POST /analyze   { image: "data:image/...;base64,...", catalog: [{id, name}] }
 *     → { items: [{ id?, name, confidence }] }
 *   GET  /health    → { ok: true }
 *
 * CORS is restricted to ALLOWED_ORIGINS (see wrangler.toml).
 */

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB cap to stay within Gemini limits
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description:
              'The catalog id this item maps to. Omit if the item is unknown to the catalog.',
            nullable: true,
          },
          name: {
            type: 'string',
            description:
              'Short display name in Traditional Chinese, e.g. "雞胸肉".',
          },
          confidence: {
            type: 'number',
            description: '0–1 confidence score.',
          },
        },
        required: ['name', 'confidence'],
      },
    },
  },
  required: ['items'],
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = parseOrigins(env.ALLOWED_ORIGINS);
    const corsHeaders = buildCorsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true }, 200, corsHeaders);
    }
    if (request.method !== 'POST' || url.pathname !== '/analyze') {
      return json({ error: 'not_found' }, 404, corsHeaders);
    }

    if (origin && !allowed.has(origin)) {
      return json({ error: 'origin_not_allowed' }, 403, corsHeaders);
    }
    if (!env.GEMINI_API_KEY) {
      return json({ error: 'server_misconfigured' }, 500, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_json' }, 400, corsHeaders);
    }

    const { image, catalog } = body ?? {};
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return json({ error: 'image_required' }, 400, corsHeaders);
    }
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return json({ error: 'catalog_required' }, 400, corsHeaders);
    }

    const parsed = parseDataUrl(image);
    if (!parsed) {
      return json({ error: 'invalid_image' }, 400, corsHeaders);
    }
    if (parsed.byteLength > MAX_IMAGE_BYTES) {
      return json({ error: 'image_too_large' }, 413, corsHeaders);
    }

    try {
      const items = await callGemini({
        env,
        mimeType: parsed.mimeType,
        base64: parsed.base64,
        catalog,
      });
      return json({ items }, 200, corsHeaders);
    } catch (err) {
      console.error('gemini error', err);
      return json(
        { error: 'analysis_failed', detail: err?.message ?? 'unknown' },
        502,
        corsHeaders,
      );
    }
  },
};

function parseOrigins(raw) {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function buildCorsHeaders(origin, allowed) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowed.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const [, mimeType, base64] = m;
  // Approximate byte length without decoding: 3/4 of base64 length.
  const byteLength = Math.floor((base64.length * 3) / 4);
  return { mimeType, base64, byteLength };
}

async function callGemini({ env, mimeType, base64, catalog }) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const catalogList = catalog
    .slice(0, 200)
    .map((c) => `${c.id}. ${c.name}`)
    .join('\n');

  const prompt = `你是一個寵物鮮食食材辨識助理。看這張照片,從下方資料庫中挑出「圖片內可見」的食材並輸出 JSON。

規則:
- 只回應確實看得到的食材;看不清楚或不確定就不要列。
- 優先匹配資料庫中的條目(回傳對應 id)。完全不在資料庫中的可省略 id 欄位。
- name 用繁體中文短名(例:"雞胸肉"、"南瓜")。
- confidence 為 0~1。
- 不要列出對毛孩不安全的食材的 id(例如巧克力、葡萄、洋蔥),除非你需要警告使用者其存在 — 但本工具用於配餐,所以乾脆略過 toxic 條目。

資料庫:
${catalogList}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gemini HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('empty response');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('non-JSON response');
  }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];

  // Sanitize: keep id only if it matches the catalog
  const validIds = new Set(catalog.map((c) => c.id));
  return items
    .map((it) => ({
      id: validIds.has(it.id) ? it.id : undefined,
      name: typeof it.name === 'string' ? it.name : '',
      confidence:
        typeof it.confidence === 'number'
          ? Math.max(0, Math.min(1, it.confidence))
          : 0.5,
    }))
    .filter((it) => it.name.length > 0);
}

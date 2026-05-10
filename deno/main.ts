/**
 * FurLogic Vision — Deno Deploy entry point.
 *
 * Proxies a single image to Google Gemini and returns a list of
 * pet-safe ingredients identified in the photo, mapped to the
 * client-supplied food database. The API key never reaches the browser.
 *
 * Endpoints:
 *   POST /analyze   { image: "data:image/...;base64,...", catalog: [{id, name}] }
 *     → { items: [{ id?, name, confidence }] }
 *   GET  /health    → { ok: true }
 *
 * Env vars (set in the Deno Deploy dashboard):
 *   GEMINI_API_KEY    (required)  — https://aistudio.google.com/apikey
 *   ALLOWED_ORIGINS   (optional)  — CSV; defaults to the GH Pages origin
 *   GEMINI_MODEL      (optional)  — defaults to gemini-2.5-flash
 */

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description:
              "The catalog id this item maps to. Omit if the item is unknown to the catalog.",
            nullable: true,
          },
          name: {
            type: "string",
            description: 'Short display name in Traditional Chinese, e.g. "雞胸肉".',
          },
          confidence: { type: "number", description: "0–1 confidence score." },
        },
        required: ["name", "confidence"],
      },
    },
  },
  required: ["items"],
};

const DEFAULT_ORIGINS =
  "https://yuzenchen.github.io,http://localhost:3000";

interface CatalogEntry {
  id: number;
  name: string;
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = parseOrigins(
    Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS,
  );
  const corsHeaders = buildCorsHeaders(origin, allowed);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true }, 200, corsHeaders);
  }
  if (request.method !== "POST" || url.pathname !== "/analyze") {
    return json({ error: "not_found" }, 404, corsHeaders);
  }

  if (origin && !allowed.has(origin)) {
    return json({ error: "origin_not_allowed" }, 403, corsHeaders);
  }
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json({ error: "server_misconfigured" }, 500, corsHeaders);
  }

  let body: { image?: unknown; catalog?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, corsHeaders);
  }

  const image = body.image;
  const catalog = body.catalog;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return json({ error: "image_required" }, 400, corsHeaders);
  }
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return json({ error: "catalog_required" }, 400, corsHeaders);
  }

  const parsed = parseDataUrl(image);
  if (!parsed) return json({ error: "invalid_image" }, 400, corsHeaders);
  if (parsed.byteLength > MAX_IMAGE_BYTES) {
    return json({ error: "image_too_large" }, 413, corsHeaders);
  }

  try {
    const items = await callGemini({
      apiKey,
      model: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash",
      mimeType: parsed.mimeType,
      base64: parsed.base64,
      catalog: catalog as CatalogEntry[],
    });
    return json({ items }, 200, corsHeaders);
  } catch (err) {
    console.error("gemini error", err);
    return json(
      {
        error: "analysis_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      502,
      corsHeaders,
    );
  }
});

function parseOrigins(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function buildCorsHeaders(
  origin: string,
  allowed: Set<string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowed.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function parseDataUrl(
  dataUrl: string,
): { mimeType: string; base64: string; byteLength: number } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const [, mimeType, base64] = m;
  const byteLength = Math.floor((base64.length * 3) / 4);
  return { mimeType, base64, byteLength };
}

interface GeminiCallArgs {
  apiKey: string;
  model: string;
  mimeType: string;
  base64: string;
  catalog: CatalogEntry[];
}

interface IdentifiedItem {
  id?: number;
  name: string;
  confidence: number;
}

async function callGemini(args: GeminiCallArgs): Promise<IdentifiedItem[]> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${args.apiKey}`;

  const catalogList = args.catalog
    .slice(0, 200)
    .map((c) => `${c.id}. ${c.name}`)
    .join("\n");

  const prompt =
    `你是一個寵物鮮食食材辨識助理。看這張照片,從下方資料庫中挑出「圖片內可見」的食材並輸出 JSON。

規則:
- 只回應確實看得到的食材;看不清楚或不確定就不要列。
- 優先匹配資料庫中的條目(回傳對應 id)。完全不在資料庫中的可省略 id 欄位。
- name 用繁體中文短名(例:"雞胸肉"、"南瓜")。
- confidence 為 0~1。
- 略過 toxic 條目(資料庫已過濾,不在清單中)。

資料庫:
${catalogList}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: args.mimeType, data: args.base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gemini HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty response");

  let parsed: { items?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("non-JSON response");
  }
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];

  const validIds = new Set(args.catalog.map((c) => c.id));
  return (rawItems as Array<Partial<IdentifiedItem>>)
    .map((it) => ({
      id: typeof it.id === "number" && validIds.has(it.id) ? it.id : undefined,
      name: typeof it.name === "string" ? it.name : "",
      confidence: typeof it.confidence === "number"
        ? Math.max(0, Math.min(1, it.confidence))
        : 0.5,
    }))
    .filter((it) => it.name.length > 0);
}

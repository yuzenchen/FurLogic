/**
 * FurLogic API client(契約見 docs/API.md)
 * VITE_API_URL 留空 ⇒ 同源 /api(開發時由 Vite proxy 轉到 8787)
 */
const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** 組 query string,略過 undefined / null / '' */
const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.append(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
};

export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const init = { method, headers, signal };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', '連不上伺服器');
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error ?? 'http_error',
      data?.message ?? `伺服器錯誤 (${res.status})`,
    );
  }
  return data;
}

const enc = encodeURIComponent;

// === Health ===
export const getHealth = (opts) => apiFetch('/health', opts);

// === Pets ===
export const getPets = (opts) => apiFetch('/pets', opts);
/** patch: 部分 { name, weight, isNeutered, activityLevel, mealsPerDay } */
export const updatePet = (id, patch, opts) =>
  apiFetch(`/pets/${enc(id)}`, { ...opts, method: 'PUT', body: patch });
/** payload: { petProfile: { name, weight, isNeutered, activityLevel } } */
export const importLegacyPet = (payload, opts) =>
  apiFetch('/import/local-storage', { ...opts, method: 'POST', body: payload });

// === Foods ===
export const listFoods = ({ q, source } = {}, opts) =>
  apiFetch(`/foods${buildQuery({ q, source })}`, opts);
export const createFood = (food, opts) =>
  apiFetch('/foods', { ...opts, method: 'POST', body: food });
export const updateFood = (id, patch, opts) =>
  apiFetch(`/foods/${enc(id)}`, { ...opts, method: 'PUT', body: patch });
export const deleteFood = (id, opts) =>
  apiFetch(`/foods/${enc(id)}`, { ...opts, method: 'DELETE' });
/** → { draft, confidence, cached } */
export const lookupFood = (query, opts) =>
  apiFetch('/foods/lookup', { ...opts, method: 'POST', body: { query } });

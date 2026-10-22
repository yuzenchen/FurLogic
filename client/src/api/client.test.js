import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  deleteFood,
  getAiStatus,
  getPets,
  listFoods,
  lookupFood,
  reviewCalc,
  updatePet,
} from './client';

const mockFetch = (impl) => {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
};
const jsonResponse = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('builds query strings and skips empty values', async () => {
    const fetchFn = mockFetch(async () => jsonResponse(200, []));
    await listFoods({ q: '雞', source: '' });
    expect(fetchFn.mock.calls[0][0]).toBe(
      `/api/foods?q=${encodeURIComponent('雞')}`,
    );
    await listFoods();
    expect(fetchFn.mock.calls[1][0]).toBe('/api/foods');
  });

  it('sends JSON bodies with the given method', async () => {
    const fetchFn = mockFetch(async () => jsonResponse(200, { id: 'p1' }));
    await updatePet('p1', { weight: 5 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/pets/p1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ weight: 5 });
  });

  it('returns null for 204', async () => {
    mockFetch(async () => new Response(null, { status: 204 }));
    await expect(deleteFood(7)).resolves.toBeNull();
  });

  it('throws ApiError with server code and message', async () => {
    mockFetch(async () =>
      jsonResponse(400, { error: 'validation_error', message: '體重錯誤' }),
    );
    const err = await getPets().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 400,
      code: 'validation_error',
      message: '體重錯誤',
    });
  });

  it('maps network failures to network_error', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await getPets().catch((e) => e);
    expect(err).toMatchObject({
      status: 0,
      code: 'network_error',
      message: '連不上伺服器',
    });
  });
});
describe('ai api', () => {
  it('GETs /api/ai/status', async () => {
    const status = {
      configured: true,
      model: 'm',
      dailyUsd: 0.01,
      dailyLimitUsd: 1,
      monthlyUsd: 0.1,
      monthlyLimitUsd: 10,
    };
    const fetchFn = mockFetch(async () => jsonResponse(200, status));
    await expect(getAiStatus()).resolves.toEqual(status);
    expect(fetchFn.mock.calls[0][0]).toBe('/api/ai/status');
    expect(fetchFn.mock.calls[0][1].method).toBe('GET');
  });

  it('POSTs the payload to /api/ai/review', async () => {
    const body = { review: { verdict: 'pass' }, model: 'm', costUsd: 0.002 };
    const fetchFn = mockFetch(async () => jsonResponse(200, body));
    await expect(reviewCalc({ mealTarget: 450 })).resolves.toEqual(body);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/ai/review');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ mealTarget: 450 });
  });

  it.each([
    [503, 'ai_unavailable'],
    [429, 'ai_quota_exceeded'],
    [502, 'ai_failed'],
    [429, 'rate_limited'],
  ])('surfaces %i %s as ApiError', async (status, code) => {
    mockFetch(async () => jsonResponse(status, { error: code, message: 'x' }));
    const err = await reviewCalc({}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status, code, message: 'x' });
  });
});

describe('food lookup api', () => {
  it('POSTs { query } to /api/foods/lookup', async () => {
    const body = {
      draft: { name: '冬瓜' },
      confidence: 'medium',
      note: '',
      cached: false,
    };
    const fetchFn = mockFetch(async () => jsonResponse(200, body));
    await expect(lookupFood('冬瓜')).resolves.toEqual(body);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/foods/lookup');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ query: '冬瓜' });
  });

  it.each([
    [422, 'food_unrecognized'],
    [503, 'ai_unavailable'],
    [429, 'ai_quota_exceeded'],
    [429, 'rate_limited'],
    [502, 'ai_failed'],
  ])('surfaces %i %s as ApiError', async (status, code) => {
    mockFetch(async () => jsonResponse(status, { error: code, message: 'x' }));
    const err = await lookupFood('q').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status, code, message: 'x' });
  });
});

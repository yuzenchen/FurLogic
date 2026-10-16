import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, deleteFood, getPets, listFoods, updatePet } from './client';

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

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const config = {
  port: 0,
  host: '127.0.0.1',
  dataDir: '.',
  allowedOrigins: ['http://localhost:3000'],
  geminiApiKey: null,
  usdaApiKey: null,
  geminiModel: 'gemini-2.5-flash',
};

const customFood = (overrides = {}) => ({
  name: '鮭魚排',
  nameEn: 'Salmon fillet',
  type: 'protein',
  recipeRole: 'protein',
  calories: 208,
  protein: 20,
  fat: 13,
  ca: 9,
  p: 240,
  source: 'manual',
  ...overrides,
});

const item = (overrides = {}) => ({
  foodId: 1,
  name: '雞胸肉',
  recipeRole: 'protein',
  calories: 105,
  protein: 23,
  fat: 1,
  ca: 5,
  p: 200,
  grams: 200,
  ...overrides,
});

const sweetPotato = (grams = 80) =>
  item({
    foodId: 5,
    name: '地瓜',
    recipeRole: 'plant',
    calories: 86,
    protein: 1.6,
    fat: 0.1,
    ca: 30,
    p: 47,
    grams,
  });

describe('FurLogic API', () => {
  let app;

  const req = async (method, url, payload) => {
    const res = await app.inject({ method, url, payload });
    return {
      status: res.statusCode,
      body: res.body ? res.json() : null,
      headers: res.headers,
    };
  };

  const postMeal = (overrides = {}) =>
    req('POST', '/api/meals', {
      petId: 1,
      label: 'dinner',
      eatenAt: '2026-10-16T23:30:00+08:00',
      items: [item(), sweetPotato()],
      ...overrides,
    });

  beforeEach(async () => {
    app = await buildApp({ dbPath: ':memory:', config });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('health + errors', () => {
    it('GET /api/health', async () => {
      const res = await req('GET', '/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, db: 'ok' });
    });

    it('unknown route → 404 json', async () => {
      const res = await req('GET', '/api/nope');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
      expect(typeof res.body.message).toBe('string');
    });

    it('invalid JSON body → 400 validation_error', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/pets/1',
        headers: { 'content-type': 'application/json' },
        payload: '{bad',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('validation_error');
    });

    it('CORS: allowed origin echoed, unknown origin not', async () => {
      const ok = await app.inject({
        method: 'GET',
        url: '/api/health',
        headers: { origin: 'http://localhost:3000' },
      });
      expect(ok.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
      const bad = await app.inject({
        method: 'GET',
        url: '/api/health',
        headers: { origin: 'http://evil.example' },
      });
      expect(bad.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('pets', () => {
    it('GET /api/pets returns default Mochi', async () => {
      const res = await req('GET', '/api/pets');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: 1,
        name: 'Mochi',
        weight: 12,
        isNeutered: true,
        activityLevel: 'normal',
        mealsPerDay: 2,
      });
    });

    it('PUT /api/pets/:id partial update', async () => {
      const res = await req('PUT', '/api/pets/1', {
        weight: 10.5,
        mealsPerDay: 3,
        isNeutered: false,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: 'Mochi',
        weight: 10.5,
        mealsPerDay: 3,
        isNeutered: false,
      });
    });

    it('PUT /api/pets/:id validation errors', async () => {
      const five = await req('PUT', '/api/pets/1', { mealsPerDay: 5 });
      expect(five.status).toBe(400);
      expect(five.body.error).toBe('validation_error');

      const extra = await req('PUT', '/api/pets/1', { color: 'brown' });
      expect(extra.status).toBe(400);

      const heavy = await req('PUT', '/api/pets/1', { weight: 151 });
      expect(heavy.status).toBe(400);
    });

    it('PUT unknown pet → 404', async () => {
      const res = await req('PUT', '/api/pets/99', { weight: 5 });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });

  describe('foods', () => {
    it('GET /api/foods returns 37 builtin foods ordered by id', async () => {
      const res = await req('GET', '/api/foods');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(37);
      const ids = res.body.map((f) => f.id);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
      expect(res.body[0]).toMatchObject({
        id: 1,
        name: '雞胸肉',
        source: 'builtin',
        isBuiltin: true,
        description: '低脂優質蛋白,鮮食基底。',
        nameEn: null,
      });
    });

    it('q filter matches name or nameEn case-insensitively', async () => {
      const byName = await req(
        'GET',
        `/api/foods?q=${encodeURIComponent('雞')}`,
      );
      expect(byName.body.length).toBeGreaterThan(0);
      byName.body.forEach((f) => expect(f.name).toContain('雞'));

      await req('POST', '/api/foods', customFood());
      const byEn = await req('GET', '/api/foods?q=SALMON');
      expect(byEn.body.map((f) => f.name)).toEqual(['鮭魚排']);
    });

    it('source filter (custom / builtin)', async () => {
      await req('POST', '/api/foods', customFood());
      await req(
        'POST',
        '/api/foods',
        customFood({ name: '鴨肉', nameEn: 'Duck', source: 'usda' }),
      );
      const custom = await req('GET', '/api/foods?source=custom');
      expect(custom.body.map((f) => f.name)).toEqual(['鮭魚排', '鴨肉'].sort());
      const usda = await req('GET', '/api/foods?source=usda');
      expect(usda.body.map((f) => f.name)).toEqual(['鴨肉']);
      const builtin = await req('GET', '/api/foods?source=builtin');
      expect(builtin.body).toHaveLength(37);
      const all = await req('GET', '/api/foods');
      expect(all.body).toHaveLength(39);
      expect(all.body.slice(0, 37).every((f) => f.isBuiltin)).toBe(true);
    });

    it('POST /api/foods → 201 with id ≥ 1000 and default safety', async () => {
      const res = await req('POST', '/api/foods', customFood());
      expect(res.status).toBe(201);
      expect(res.body.id).toBeGreaterThanOrEqual(1000);
      expect(res.body).toMatchObject({
        name: '鮭魚排',
        safety: 'safe',
        isBuiltin: false,
        source: 'manual',
      });
    });

    it('POST /api/foods duplicate name → 409', async () => {
      await req('POST', '/api/foods', customFood());
      const dup = await req('POST', '/api/foods', customFood());
      expect(dup.status).toBe(409);
      expect(dup.body.error).toBe('duplicate_name');
      const dupBuiltin = await req(
        'POST',
        '/api/foods',
        customFood({ name: '雞胸肉' }),
      );
      expect(dupBuiltin.status).toBe(409);
    });

    it('POST /api/foods validation (calories 0, source builtin)', async () => {
      const zero = await req('POST', '/api/foods', customFood({ calories: 0 }));
      expect(zero.status).toBe(400);
      const builtin = await req(
        'POST',
        '/api/foods',
        customFood({ source: 'builtin' }),
      );
      expect(builtin.status).toBe(400);
    });

    it('PUT/DELETE builtin → 403', async () => {
      const put = await req('PUT', '/api/foods/1', { calories: 1 });
      expect(put.status).toBe(403);
      expect(put.body.error).toBe('builtin_readonly');
      const del = await req('DELETE', '/api/foods/1');
      expect(del.status).toBe(403);
      expect(del.body.error).toBe('builtin_readonly');
    });

    it('PUT custom food updates; renaming onto existing name → 409', async () => {
      const { body: food } = await req('POST', '/api/foods', customFood());
      const put = await req('PUT', `/api/foods/${food.id}`, {
        calories: 200,
        warning: '去骨',
      });
      expect(put.status).toBe(200);
      expect(put.body).toMatchObject({ calories: 200, warning: '去骨' });
      const same = await req('PUT', `/api/foods/${food.id}`, {
        name: '鮭魚排',
      });
      expect(same.status).toBe(200);
      const clash = await req('PUT', `/api/foods/${food.id}`, {
        name: '雞胸肉',
      });
      expect(clash.status).toBe(409);
    });

    it('DELETE custom food → 204, then 404', async () => {
      const { body: food } = await req('POST', '/api/foods', customFood());
      const del = await req('DELETE', `/api/foods/${food.id}`);
      expect(del.status).toBe(204);
      const again = await req('DELETE', `/api/foods/${food.id}`);
      expect(again.status).toBe(404);
    });
  });

  describe('meals', () => {
    it('POST /api/meals computes totals, dateKey and item snapshot', async () => {
      const res = await postMeal({ note: '加了一點水' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        petId: 1,
        label: 'dinner',
        dateKey: '2026-10-16',
        eatenAt: '2026-10-16T23:30:00+08:00',
        note: '加了一點水',
      });
      expect(res.body.totals).toEqual({
        calories: 279,
        protein: 47.3,
        fat: 2.1,
        ca: 34,
        p: 438,
        grams: 280,
      });
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toMatchObject({
        foodId: 1,
        name: '雞胸肉',
        calories: 105,
        grams: 200,
      });
      expect(res.body.items[1]).toMatchObject({ foodId: 5, grams: 80 });
    });

    it('defaults eatenAt to now with an offset', async () => {
      const res = await postMeal({ eatenAt: undefined });
      expect(res.status).toBe(201);
      expect(res.body.eatenAt).toMatch(/[+-]\d{2}:\d{2}$/);
      expect(res.body.eatenAt.slice(0, 10)).toBe(res.body.dateKey);
    });

    it('rejects eatenAt without offset', async () => {
      const res = await postMeal({ eatenAt: '2026-10-16T23:30:00' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('drops items with grams ≤ 0', async () => {
      const res = await postMeal({ items: [item(), sweetPotato(0)] });
      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.totals.calories).toBe(210);
    });

    it('toxic foodId → 422 toxic_food', async () => {
      const res = await postMeal({
        items: [
          item(),
          item({ foodId: 8, name: '巧克力', recipeRole: 'excluded' }),
        ],
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('toxic_food');
      const list = await req('GET', '/api/meals');
      expect(list.body).toHaveLength(0);
    });

    it('all-zero grams → 422 empty_meal', async () => {
      const res = await postMeal({
        items: [item({ grams: 0 }), sweetPotato(-5)],
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('empty_meal');
    });

    it('unknown foodId stored as null; unknown petId → 404', async () => {
      const res = await postMeal({ items: [item({ foodId: 4242 })] });
      expect(res.status).toBe(201);
      expect(res.body.items[0].foodId).toBeNull();
      const noPet = await postMeal({ petId: 99 });
      expect(noPet.status).toBe(404);
      expect(noPet.body.error).toBe('not_found');
    });

    it('GET /api/meals from/to filter, newest eatenAt first', async () => {
      await postMeal({ eatenAt: '2026-10-14T08:00:00+08:00' });
      await postMeal({ eatenAt: '2026-10-15T08:00:00+08:00' });
      await postMeal({ eatenAt: '2026-10-15T19:00:00+08:00' });
      await postMeal({ eatenAt: '2026-10-16T08:00:00+08:00' });

      const all = await req('GET', '/api/meals?petId=1');
      expect(all.body).toHaveLength(4);
      expect(all.body.map((m) => m.eatenAt)).toEqual([
        '2026-10-16T08:00:00+08:00',
        '2026-10-15T19:00:00+08:00',
        '2026-10-15T08:00:00+08:00',
        '2026-10-14T08:00:00+08:00',
      ]);
      expect(all.body[0].items).toHaveLength(2);

      const range = await req(
        'GET',
        '/api/meals?petId=1&from=2026-10-15&to=2026-10-15',
      );
      expect(range.body.map((m) => m.dateKey)).toEqual([
        '2026-10-15',
        '2026-10-15',
      ]);
      const fromOnly = await req('GET', '/api/meals?from=2026-10-16');
      expect(fromOnly.body).toHaveLength(1);
      const bad = await req('GET', '/api/meals?from=2026-1-1');
      expect(bad.status).toBe(400);
    });

    it('DELETE /api/meals/:id → 204, then gone', async () => {
      const { body: meal } = await postMeal();
      const del = await req('DELETE', `/api/meals/${meal.id}`);
      expect(del.status).toBe(204);
      const list = await req('GET', '/api/meals');
      expect(list.body).toHaveLength(0);
      const again = await req('DELETE', `/api/meals/${meal.id}`);
      expect(again.status).toBe(404);
    });

    it('item snapshot survives deleting the custom food', async () => {
      const { body: food } = await req('POST', '/api/foods', customFood());
      await postMeal({
        items: [
          item({
            foodId: food.id,
            name: food.name,
            calories: 208,
            grams: 100,
          }),
        ],
      });
      await req('DELETE', `/api/foods/${food.id}`);
      const list = await req('GET', '/api/meals');
      expect(list.body[0].items[0]).toMatchObject({
        foodId: null,
        name: '鮭魚排',
        calories: 208,
        grams: 100,
      });
      expect(list.body[0].totals.calories).toBe(208);
    });
  });

  describe('stats', () => {
    it('GET /api/stats/daily zero-fills a 7-day window', async () => {
      await postMeal();
      await postMeal({ eatenAt: '2026-10-12T08:00:00+08:00', items: [item()] });
      await postMeal({ eatenAt: '2026-10-01T08:00:00+08:00' });

      const res = await req(
        'GET',
        '/api/stats/daily?petId=1&days=7&today=2026-10-16',
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(7);
      expect(res.body[0]).toEqual({
        dateKey: '2026-10-10',
        calories: 0,
        count: 0,
      });
      expect(res.body[2]).toEqual({
        dateKey: '2026-10-12',
        calories: 210,
        count: 1,
      });
      expect(res.body[6]).toEqual({
        dateKey: '2026-10-16',
        calories: 279,
        count: 1,
      });
    });

    it('defaults days=7 and today=server date; validates days range', async () => {
      const res = await req('GET', '/api/stats/daily?petId=1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(7);
      const tooMany = await req('GET', '/api/stats/daily?petId=1&days=91');
      expect(tooMany.status).toBe(400);
      const badDay = await req('GET', '/api/stats/daily?today=2026-02-30');
      expect(badDay.status).toBe(400);
      const noPet = await req('GET', '/api/stats/daily?petId=9');
      expect(noPet.status).toBe(404);
    });
  });

  describe('import', () => {
    it('POST /api/import/local-storage updates the first pet', async () => {
      const res = await req('POST', '/api/import/local-storage', {
        petProfile: {
          name: '豆豆',
          weight: 8.2,
          isNeutered: false,
          activityLevel: 'high',
        },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1,
        name: '豆豆',
        weight: 8.2,
        isNeutered: false,
        activityLevel: 'high',
        mealsPerDay: 2,
      });
      const pets = await req('GET', '/api/pets');
      expect(pets.body[0].name).toBe('豆豆');
    });

    it('rejects an incomplete petProfile', async () => {
      const res = await req('POST', '/api/import/local-storage', {
        petProfile: { name: 'x' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });
  });
});

describe('file-backed database', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'furlogic-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('seed is idempotent and custom ids stay ≥ 1000 across restarts', async () => {
    const dbPath = path.join(dir, 'furlogic.db');

    const first = await buildApp({ dbPath, config });
    const created = await first.inject({
      method: 'POST',
      url: '/api/foods',
      payload: customFood(),
    });
    expect(created.json().id).toBe(1000);
    const before = first.db
      .prepare('SELECT updated_at FROM foods WHERE id = 1')
      .get();
    await first.close();

    const second = await buildApp({ dbPath, config });
    const foods = (await second.inject('/api/foods')).json();
    const pets = (await second.inject('/api/pets')).json();
    expect(foods.filter((f) => f.isBuiltin)).toHaveLength(37);
    expect(foods).toHaveLength(38);
    expect(pets).toHaveLength(1);
    const after = second.db
      .prepare('SELECT updated_at FROM foods WHERE id = 1')
      .get();
    expect(after.updated_at).toBe(before.updated_at);
    const versions = second.db
      .prepare('SELECT version FROM schema_migrations')
      .all();
    expect(versions).toEqual([{ version: 1 }]);
    await second.close();
  });
});

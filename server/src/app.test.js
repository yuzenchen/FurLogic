import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FOOD_DATABASE } from '@furlogic/shared';
import { buildApp } from './app.js';
import { openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';

/** 只含 001 的 migrations 目錄(模擬尚未升級的舊 DB)。 */
const LEGACY_MIGRATIONS_DIR = mkdtempSync(
  path.join(tmpdir(), 'furlogic-legacy-mig-'),
);
copyFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'db/migrations/001_init.sql',
  ),
  path.join(LEGACY_MIGRATIONS_DIR, '001_init.sql'),
);

const config = {
  port: 0,
  host: '127.0.0.1',
  dataDir: '.',
  allowedOrigins: ['http://localhost:3000'],
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
    it('GET /api/foods returns 45 builtin foods ordered by id', async () => {
      const res = await req('GET', '/api/foods');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(45);
      const ids = res.body.map((f) => f.id);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
      expect(res.body[0]).toMatchObject({
        id: 1,
        name: '雞胸肉',
        source: 'builtin',
        isBuiltin: true,
        description: '低脂優質蛋白,鮮食基底。',
        nameEn: null,
        subtype: null,
      });
    });

    it('builtin subtype: 鯖魚 fatty_fish、雞肝 organ、鴨內臟(綜合) organ', async () => {
      const { body } = await req('GET', '/api/foods');
      const byId = new Map(body.map((f) => [f.id, f]));
      expect(byId.get(17)).toMatchObject({
        name: '鯖魚',
        subtype: 'fatty_fish',
      });
      expect(byId.get(6).subtype).toBe('fatty_fish');
      expect(byId.get(15).subtype).toBe('organ');
      expect(byId.get(16).subtype).toBe('organ');
      expect(byId.get(43)).toMatchObject({
        name: '鴨內臟(綜合)',
        subtype: 'organ',
        safety: 'safe',
        calories: 150,
      });
      expect(byId.get(38)).toMatchObject({ name: '白飯(熟)', calories: 130 });
      expect(byId.get(1).subtype).toBeNull();
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
      expect(builtin.body).toHaveLength(45);
      const all = await req('GET', '/api/foods');
      expect(all.body).toHaveLength(47);
      expect(all.body.slice(0, 45).every((f) => f.isBuiltin)).toBe(true);
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

    it('POST/PUT custom food subtype: valid values stored, invalid → 400', async () => {
      const created = await req(
        'POST',
        '/api/foods',
        customFood({ subtype: 'fatty_fish' }),
      );
      expect(created.status).toBe(201);
      expect(created.body.subtype).toBe('fatty_fish');

      const plain = await req(
        'POST',
        '/api/foods',
        customFood({ name: '雞心' }),
      );
      expect(plain.body.subtype).toBeNull();

      const toOrgan = await req('PUT', `/api/foods/${plain.body.id}`, {
        subtype: 'organ',
      });
      expect(toOrgan.status).toBe(200);
      expect(toOrgan.body.subtype).toBe('organ');

      const cleared = await req('PUT', `/api/foods/${plain.body.id}`, {
        subtype: null,
      });
      expect(cleared.status).toBe(200);
      expect(cleared.body.subtype).toBeNull();

      const bad = await req('PUT', `/api/foods/${plain.body.id}`, {
        subtype: 'bone',
      });
      expect(bad.status).toBe(400);
      expect(bad.body.error).toBe('validation_error');
      const badPost = await req(
        'POST',
        '/api/foods',
        customFood({ name: '魚卵', subtype: 'roe' }),
      );
      expect(badPost.status).toBe(400);
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
    expect(foods.filter((f) => f.isBuiltin)).toHaveLength(45);
    expect(foods).toHaveLength(46);
    expect(pets).toHaveLength(1);
    const after = second.db
      .prepare('SELECT updated_at FROM foods WHERE id = 1')
      .get();
    expect(after.updated_at).toBe(before.updated_at);
    const versions = second.db
      .prepare('SELECT version FROM schema_migrations')
      .all();
    expect(versions).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
    ]);
    await second.close();
  });

  it('migration 002 applies to a DB that only has 001, and seed backfills subtype', async () => {
    const dbPath = path.join(dir, 'legacy.db');
    // 模擬舊版 DB:只套用 001,並以舊版 seed(無 subtype 欄位)塞入 37 筆內建食材。
    const legacy = openDatabase(dbPath);
    runMigrations(legacy, LEGACY_MIGRATIONS_DIR);
    const now = '2026-01-01T00:00:00.000Z';
    const insert = legacy.prepare(`
      INSERT INTO foods (id, name, type, recipe_role, safety, warning, description,
        calories, protein, fat, ca, p, source, is_builtin, created_at, updated_at)
      VALUES (@id, @name, @type, @recipeRole, @safety, @warning, @desc,
        @calories, @protein, @fat, @ca, @p, 'builtin', 1, @now, @now)
    `);
    const oldFoods = FOOD_DATABASE.filter((f) => f.id <= 37);
    expect(oldFoods).toHaveLength(37);
    oldFoods.forEach((f) => insert.run({ ...f, now }));
    expect(
      legacy.prepare('SELECT version FROM schema_migrations').all(),
    ).toEqual([{ version: 1 }]);
    expect(
      legacy
        .prepare('PRAGMA table_info(foods)')
        .all()
        .map((c) => c.name),
    ).not.toContain('subtype');
    legacy.close();

    const app = await buildApp({ dbPath, config });
    const versions = app.db
      .prepare('SELECT version FROM schema_migrations')
      .all();
    expect(versions).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
    ]);
    const foods = (await app.inject('/api/foods')).json();
    expect(foods).toHaveLength(45);
    const byId = new Map(foods.map((f) => [f.id, f]));
    expect(byId.get(17).subtype).toBe('fatty_fish');
    expect(byId.get(6).subtype).toBe('fatty_fish');
    expect(byId.get(15).subtype).toBe('organ');
    expect(byId.get(16).subtype).toBe('organ');
    expect(byId.get(43).subtype).toBe('organ');
    // 只有 subtype 變動的 15/16/6/17 會更新 updated_at;內容未變的 1 不動
    expect(byId.get(17).updatedAt).not.toBe(now);
    expect(byId.get(1).updatedAt).toBe(now);
    await app.close();
  });
});

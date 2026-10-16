import {
  FOOD_FIELD_TO_COLUMN,
  foodFromRow,
  pickColumns,
} from '../db/mappers.js';
import { ApiError, notFound } from '../errors.js';
import { idParams, nullableString } from './schemas.js';

const FOOD_TYPES = ['protein', 'veg', 'fruit', 'starch', 'snack'];
const RECIPE_ROLES = ['protein', 'plant', 'excluded'];
const SAFETY = ['safe', 'caution', 'toxic'];
const CUSTOM_SOURCES = ['usda', 'ai', 'manual'];
const QUERY_SOURCES = ['builtin', ...CUSTOM_SOURCES, 'custom'];

const nutrient = { type: 'number', minimum: 0 };

const foodFields = {
  name: { type: 'string', minLength: 1, maxLength: 40 },
  nameEn: nullableString(80),
  type: { type: 'string', enum: FOOD_TYPES },
  recipeRole: { type: 'string', enum: RECIPE_ROLES },
  safety: { type: 'string', enum: SAFETY },
  warning: nullableString(500),
  description: nullableString(500),
  calories: { type: 'number', exclusiveMinimum: 0 },
  protein: nutrient,
  fat: nutrient,
  ca: nutrient,
  p: nutrient,
  source: { type: 'string', enum: CUSTOM_SOURCES },
  sourceRef: nullableString(300),
};

const createBody = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'type',
    'recipeRole',
    'calories',
    'protein',
    'fat',
    'ca',
    'p',
    'source',
  ],
  properties: foodFields,
};

const updateBody = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: foodFields,
};

const listQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', maxLength: 50 },
    source: { type: 'string', enum: QUERY_SOURCES },
  },
};

const duplicateName = (name) =>
  new ApiError(409, 'duplicate_name', `Food name already exists: ${name}`);

const builtinReadonly = (id) =>
  new ApiError(403, 'builtin_readonly', `Builtin food ${id} is read-only`);

const isUniqueNameViolation = (err) =>
  err?.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
  String(err.message).includes('foods.name');

export default async function foodRoutes(app) {
  const { db } = app;
  const listFoods = db.prepare(`
    SELECT * FROM foods
    WHERE (@q IS NULL
           OR instr(lower(name), @q) > 0
           OR instr(lower(coalesce(name_en, '')), @q) > 0)
      AND (@source IS NULL
           OR (@source = 'custom' AND is_builtin = 0)
           OR source = @source)
    ORDER BY is_builtin DESC,
             CASE WHEN is_builtin = 1 THEN id END,
             name
  `);
  const getFood = db.prepare('SELECT * FROM foods WHERE id = ?');
  const findByName = db.prepare('SELECT id FROM foods WHERE name = ?');
  const deleteFood = db.prepare('DELETE FROM foods WHERE id = ?');

  const assertNameFree = (name, selfId = null) => {
    const hit = findByName.get(name);
    if (hit && hit.id !== selfId) throw duplicateName(name);
  };

  const loadCustomFood = (id) => {
    const row = getFood.get(id);
    if (!row) throw notFound(`Food ${id} not found`);
    if (row.is_builtin === 1) throw builtinReadonly(id);
    return row;
  };

  const runWrite = (fn, name) => {
    try {
      return fn();
    } catch (err) {
      if (isUniqueNameViolation(err)) throw duplicateName(name);
      throw err;
    }
  };

  app.get('/foods', { schema: { querystring: listQuery } }, async (request) => {
    const q = request.query.q?.trim().toLowerCase() || null;
    const source = request.query.source ?? null;
    return listFoods.all({ q, source }).map(foodFromRow);
  });

  app.post(
    '/foods',
    { schema: { body: createBody } },
    async (request, reply) => {
      const body = { safety: 'safe', ...request.body };
      assertNameFree(body.name);
      const cols = pickColumns(body, FOOD_FIELD_TO_COLUMN);
      const now = new Date().toISOString();
      const all = { ...cols, is_builtin: 0, created_at: now, updated_at: now };
      const keys = Object.keys(all);
      const info = runWrite(
        () =>
          db
            .prepare(
              `INSERT INTO foods (${keys.join(', ')}) VALUES (${keys
                .map((k) => `@${k}`)
                .join(', ')})`,
            )
            .run(all),
        body.name,
      );
      reply.code(201);
      return foodFromRow(getFood.get(info.lastInsertRowid));
    },
  );

  app.put(
    '/foods/:id',
    { schema: { params: idParams, body: updateBody } },
    async (request) => {
      const { id } = request.params;
      loadCustomFood(id);
      if (request.body.name !== undefined)
        assertNameFree(request.body.name, id);
      const cols = pickColumns(request.body, FOOD_FIELD_TO_COLUMN);
      const sets = Object.keys(cols)
        .map((c) => `${c} = @${c}`)
        .join(', ');
      runWrite(
        () =>
          db
            .prepare(
              `UPDATE foods SET ${sets}, updated_at = @updated_at WHERE id = @id`,
            )
            .run({ ...cols, updated_at: new Date().toISOString(), id }),
        request.body.name,
      );
      return foodFromRow(getFood.get(id));
    },
  );

  app.delete(
    '/foods/:id',
    { schema: { params: idParams } },
    async (request, reply) => {
      loadCustomFood(request.params.id);
      deleteFood.run(request.params.id);
      return reply.code(204).send();
    },
  );

  // POST /foods/lookup 在 routes/lookup.js。
}

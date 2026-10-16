import {
  computeMealTotals,
  toDateKey,
  toLocalIsoString,
} from '@furlogic/shared';
import { mealFromRow } from '../db/mappers.js';
import { ApiError, notFound, validationError } from '../errors.js';
import { dateKeySchema, idParams, nullableString } from './schemas.js';

const MEAL_LABELS = ['breakfast', 'lunch', 'dinner', 'snack'];
const RECIPE_ROLES = ['protein', 'plant', 'excluded'];

// ISO 日期時間且必須帶時區(Z 或 ±HH:MM / ±HHMM)。
const ISO_WITH_OFFSET_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

const nutrient = { type: 'number', minimum: 0 };

const itemSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'recipeRole',
    'calories',
    'protein',
    'fat',
    'ca',
    'p',
    'grams',
  ],
  properties: {
    foodId: { type: ['integer', 'null'] },
    name: { type: 'string', minLength: 1, maxLength: 60 },
    recipeRole: { type: 'string', enum: RECIPE_ROLES },
    calories: nutrient,
    protein: nutrient,
    fat: nutrient,
    ca: nutrient,
    p: nutrient,
    grams: { type: 'number' },
  },
};

const createBody = {
  type: 'object',
  additionalProperties: false,
  required: ['petId', 'label', 'items'],
  properties: {
    petId: { type: 'integer', minimum: 1 },
    label: { type: 'string', enum: MEAL_LABELS },
    eatenAt: { type: 'string', maxLength: 40 },
    note: nullableString(200),
    items: { type: 'array', minItems: 1, maxItems: 50, items: itemSchema },
  },
};

const listQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    petId: { type: 'integer', minimum: 1 },
    from: dateKeySchema,
    to: dateKeySchema,
  },
};

/** '+0800' → '+08:00',讓 SQLite julianday() 可排序。 */
const normalizeOffset = (iso) => iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

/** 驗證並正規化 eatenAt;回傳 { eatenAt, dateKey }。 */
const resolveEatenAt = (input) => {
  const eatenAt =
    input === undefined ? toLocalIsoString(new Date()) : input.trim();
  if (!ISO_WITH_OFFSET_RE.test(eatenAt)) {
    throw validationError(
      'eatenAt must be an ISO date-time with a timezone offset',
    );
  }
  let dateKey;
  try {
    dateKey = toDateKey(eatenAt);
  } catch {
    throw validationError('eatenAt is not a valid date-time');
  }
  return { eatenAt: normalizeOffset(eatenAt), dateKey };
};

export default async function mealRoutes(app) {
  const { db } = app;

  const petExists = db.prepare('SELECT 1 FROM pets WHERE id = ?');
  const getFoodSafety = db.prepare(
    'SELECT id, name, safety FROM foods WHERE id = ?',
  );
  const insertMeal = db.prepare(`
    INSERT INTO meals (pet_id, date_key, eaten_at, label,
      total_calories, total_protein, total_fat, total_ca, total_p, total_grams,
      note, created_at)
    VALUES (@petId, @dateKey, @eatenAt, @label,
      @calories, @protein, @fat, @ca, @p, @grams,
      @note, @createdAt)
  `);
  const insertItem = db.prepare(`
    INSERT INTO meal_items (meal_id, food_id, name, recipe_role,
      calories, protein, fat, ca, p, grams)
    VALUES (@mealId, @foodId, @name, @recipeRole,
      @calories, @protein, @fat, @ca, @p, @grams)
  `);
  const getMeal = db.prepare('SELECT * FROM meals WHERE id = ?');
  const listMeals = db.prepare(`
    SELECT * FROM meals
    WHERE (@petId IS NULL OR pet_id = @petId)
      AND (@from IS NULL OR date_key >= @from)
      AND (@to IS NULL OR date_key <= @to)
    ORDER BY julianday(eaten_at) DESC, id DESC
  `);
  const itemsForMeals = db.prepare(`
    SELECT * FROM meal_items
    WHERE meal_id IN (SELECT value FROM json_each(?))
    ORDER BY meal_id, id
  `);
  const deleteMeal = db.prepare('DELETE FROM meals WHERE id = ?');

  const withItems = (mealRows) => {
    if (mealRows.length === 0) return [];
    const byMeal = new Map();
    itemsForMeals
      .all(JSON.stringify(mealRows.map((m) => m.id)))
      .forEach((item) => {
        const list = byMeal.get(item.meal_id) ?? [];
        list.push(item);
        byMeal.set(item.meal_id, list);
      });
    return mealRows.map((m) => mealFromRow(m, byMeal.get(m.id) ?? []));
  };

  const assertPet = (petId) => {
    if (!petExists.get(petId)) throw notFound(`Pet ${petId} not found`);
  };

  const createMeal = db.transaction((meal, items) => {
    const { lastInsertRowid: mealId } = insertMeal.run(meal);
    items.forEach((item) => insertItem.run({ ...item, mealId }));
    return mealId;
  });

  app.get('/meals', { schema: { querystring: listQuery } }, async (request) => {
    const { petId = null, from = null, to = null } = request.query;
    if (petId !== null) assertPet(petId);
    return withItems(listMeals.all({ petId, from, to }));
  });

  app.post(
    '/meals',
    { schema: { body: createBody } },
    async (request, reply) => {
      const { petId, label, note = null, items: rawItems } = request.body;
      const { eatenAt, dateKey } = resolveEatenAt(request.body.eatenAt);
      assertPet(petId);

      const kept = rawItems.filter((item) => item.grams > 0);
      if (kept.length === 0) {
        throw new ApiError(
          422,
          'empty_meal',
          'Meal must contain at least one item with grams > 0',
        );
      }

      const items = kept.map((item) => {
        let foodId = item.foodId ?? null;
        if (foodId !== null) {
          const food = getFoodSafety.get(foodId);
          if (!food) foodId = null;
          else if (food.safety === 'toxic') {
            throw new ApiError(
              422,
              'toxic_food',
              `Food ${food.id} (${food.name}) is toxic for dogs`,
            );
          }
        }
        return {
          foodId,
          name: item.name,
          recipeRole: item.recipeRole,
          calories: item.calories,
          protein: item.protein,
          fat: item.fat,
          ca: item.ca,
          p: item.p,
          grams: item.grams,
        };
      });

      const totals = computeMealTotals(items);
      const mealId = createMeal(
        {
          petId,
          dateKey,
          eatenAt,
          label,
          ...totals,
          note,
          createdAt: new Date().toISOString(),
        },
        items,
      );
      reply.code(201);
      return withItems([getMeal.get(mealId)])[0];
    },
  );

  app.delete(
    '/meals/:id',
    { schema: { params: idParams } },
    async (request, reply) => {
      const { changes } = deleteMeal.run(request.params.id);
      if (changes === 0) throw notFound(`Meal ${request.params.id} not found`);
      return reply.code(204).send();
    },
  );
}

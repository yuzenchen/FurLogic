import { FOOD_DATABASE } from '@furlogic/shared';

/** id < 1000 保留給內建食材;自訂食材由 AUTOINCREMENT 從 1000 起。 */
export const MAX_BUILTIN_ID = 999;

export const DEFAULT_PET = {
  name: 'Mochi',
  weight: 12,
  isNeutered: true,
  activityLevel: 'normal',
  mealsPerDay: 2,
};

const FOOD_COLUMNS = [
  'name',
  'name_en',
  'type',
  'recipe_role',
  'safety',
  'warning',
  'description',
  'calories',
  'protein',
  'fat',
  'ca',
  'p',
  'source',
  'source_ref',
  'is_builtin',
];

const toFoodParams = (food, now) => ({
  id: food.id,
  name: food.name,
  name_en: food.nameEn ?? null,
  type: food.type ?? null,
  recipe_role: food.recipeRole ?? null,
  safety: food.safety ?? null,
  warning: food.warning ?? null,
  description: food.desc ?? food.description ?? null,
  calories: food.calories ?? null,
  protein: food.protein ?? null,
  fat: food.fat ?? null,
  ca: food.ca ?? null,
  p: food.p ?? null,
  source: 'builtin',
  source_ref: null,
  is_builtin: 1,
  created_at: now,
  updated_at: now,
});

/**
 * 內建食材 upsert(保留 id)+ 沒有寵物時建立預設 Mochi。可重複執行。
 * 只有內容真的變動時才更新 updated_at。
 */
export const seedDatabase = (db, foods = FOOD_DATABASE) => {
  const bad = foods.find(
    (f) => !Number.isInteger(f.id) || f.id < 1 || f.id > MAX_BUILTIN_ID,
  );
  if (bad) {
    throw new Error(
      `Builtin food id must be 1..${MAX_BUILTIN_ID}: ${String(bad.id)}`,
    );
  }

  const upsertFood = db.prepare(`
    INSERT INTO foods (id, ${FOOD_COLUMNS.join(', ')}, created_at, updated_at)
    VALUES (@id, ${FOOD_COLUMNS.map((c) => `@${c}`).join(', ')}, @created_at, @updated_at)
    ON CONFLICT (id) DO UPDATE SET
      ${FOOD_COLUMNS.map((c) => `${c} = excluded.${c}`).join(', ')},
      updated_at = excluded.updated_at
    WHERE ${FOOD_COLUMNS.map((c) => `${c} IS NOT excluded.${c}`).join(' OR ')}
  `);

  const petCount = db.prepare('SELECT COUNT(*) AS n FROM pets');
  const insertPet = db.prepare(`
    INSERT INTO pets (name, weight, is_neutered, activity_level, meals_per_day, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    const now = new Date().toISOString();
    foods.forEach((food) => upsertFood.run(toFoodParams(food, now)));
    if (petCount.get().n === 0) {
      insertPet.run(
        DEFAULT_PET.name,
        DEFAULT_PET.weight,
        DEFAULT_PET.isNeutered ? 1 : 0,
        DEFAULT_PET.activityLevel,
        DEFAULT_PET.mealsPerDay,
        now,
        now,
      );
    }
  })();
};

/** DB row(snake_case)↔ API JSON(camelCase)對應集中在這裡。 */

export const petFromRow = (row) => ({
  id: row.id,
  name: row.name,
  weight: row.weight,
  isNeutered: row.is_neutered === 1,
  activityLevel: row.activity_level,
  mealsPerDay: row.meals_per_day,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const PET_FIELD_TO_COLUMN = {
  name: 'name',
  weight: 'weight',
  isNeutered: 'is_neutered',
  activityLevel: 'activity_level',
  mealsPerDay: 'meals_per_day',
};

export const foodFromRow = (row) => ({
  id: row.id,
  name: row.name,
  nameEn: row.name_en,
  type: row.type,
  recipeRole: row.recipe_role,
  safety: row.safety,
  warning: row.warning,
  description: row.description,
  calories: row.calories,
  protein: row.protein,
  fat: row.fat,
  ca: row.ca,
  p: row.p,
  source: row.source,
  sourceRef: row.source_ref,
  isBuiltin: row.is_builtin === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const FOOD_FIELD_TO_COLUMN = {
  name: 'name',
  nameEn: 'name_en',
  type: 'type',
  recipeRole: 'recipe_role',
  safety: 'safety',
  warning: 'warning',
  description: 'description',
  calories: 'calories',
  protein: 'protein',
  fat: 'fat',
  ca: 'ca',
  p: 'p',
  source: 'source',
  sourceRef: 'source_ref',
};

/** API 值 → DB 值(boolean → 0/1,undefined → null)。 */
export const toDbValue = (value) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value === undefined ? null : value;
};

/**
 * 只取 body 中有出現且有對應欄位的 key,轉成 { column: dbValue }。
 */
export const pickColumns = (body, fieldToColumn) => {
  const out = {};
  Object.entries(fieldToColumn).forEach(([field, column]) => {
    if (Object.hasOwn(body, field)) out[column] = toDbValue(body[field]);
  });
  return out;
};

export const mealItemFromRow = (row) => ({
  id: row.id,
  foodId: row.food_id,
  name: row.name,
  recipeRole: row.recipe_role,
  calories: row.calories,
  protein: row.protein,
  fat: row.fat,
  ca: row.ca,
  p: row.p,
  grams: row.grams,
});

export const mealFromRow = (row, itemRows = []) => ({
  id: row.id,
  petId: row.pet_id,
  dateKey: row.date_key,
  eatenAt: row.eaten_at,
  label: row.label,
  note: row.note,
  totals: {
    calories: row.total_calories,
    protein: row.total_protein,
    fat: row.total_fat,
    ca: row.total_ca,
    p: row.total_p,
    grams: row.total_grams,
  },
  items: itemRows.map(mealItemFromRow),
  createdAt: row.created_at,
});

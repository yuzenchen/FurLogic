/**
 * 記餐草稿的純函式:reducer、食材快照與送出 payload。
 * 草稿形狀 { label, items: [{ food, grams }] }(與 utils/storage 的驗證一致)。
 */
import {
  MEAL_LABELS,
  allocatePortionsForTarget,
  defaultMealLabel,
  toLocalIsoString,
} from '@furlogic/shared';

const RECIPE_ROLES = ['protein', 'plant', 'excluded'];
const BUMP_STEP = 10;

/** 食材快照保留的欄位 */
const SNAPSHOT_KEYS = [
  'id',
  'name',
  'type',
  'recipeRole',
  'safety',
  'warning',
  'calories',
  'protein',
  'fat',
  'ca',
  'p',
  'source',
];

export const emptyMealDraft = (now = new Date()) => ({
  label: defaultMealLabel(now),
  items: [],
});

/** 只保留草稿需要的食材欄位(避免把 description 等大欄位存進 localStorage) */
export const snapshotFood = (food) => {
  const snap = {};
  SNAPSHOT_KEYS.forEach((key) => {
    if (food?.[key] !== undefined) snap[key] = food[key];
  });
  return snap;
};

/** 克數正規化:非有限數 → 0,負數 → 0,取到 0.1g */
const toGrams = (value) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 10) / 10;
};

const sameId = (a, b) => a !== undefined && a !== null && a === b;

const mapItem = (state, id, fn) => ({
  ...state,
  items: state.items.map((item) =>
    sameId(item.food.id, id) ? { ...item, grams: fn(item.grams) } : item,
  ),
});

/**
 * actions:
 * - { type: 'setLabel', label }
 * - { type: 'addFood', food }        重複 id 或有毒食材不加入;預設 0 克
 * - { type: 'removeFood', id }
 * - { type: 'setGrams', id, grams }  ≥ 0;NaN → 0
 * - { type: 'bump', id, delta }      delta 為正 → +10,負 → −10,下限 0
 * - { type: 'applyAllocation', target }
 * - { type: 'clear', label? }        label 省略時依目前時間推測
 */
export function mealDraftReducer(state, action) {
  switch (action?.type) {
    case 'setLabel':
      return MEAL_LABELS[action.label]
        ? { ...state, label: action.label }
        : state;
    case 'addFood': {
      const { food } = action;
      if (!food || typeof food.name !== 'string') return state;
      if (food.safety === 'toxic') return state;
      if (
        food.id !== undefined &&
        state.items.some((item) => sameId(item.food.id, food.id))
      ) {
        return state;
      }
      return {
        ...state,
        items: [...state.items, { food: snapshotFood(food), grams: 0 }],
      };
    }
    case 'removeFood':
      return {
        ...state,
        items: state.items.filter((item) => !sameId(item.food.id, action.id)),
      };
    case 'setGrams':
      return mapItem(state, action.id, () => toGrams(action.grams));
    case 'bump': {
      const step = action.delta < 0 ? -BUMP_STEP : BUMP_STEP;
      return mapItem(state, action.id, (g) => toGrams(g + step));
    }
    case 'applyAllocation': {
      const allocated = allocatePortionsForTarget(
        state.items.map((item) => item.food),
        Number(action.target) || 0,
      );
      return {
        ...state,
        items: state.items.map((item, i) => ({
          ...item,
          grams: toGrams(allocated[i]?.grams),
        })),
      };
    }
    case 'clear':
      return {
        label: MEAL_LABELS[action.label] ? action.label : defaultMealLabel(),
        items: [],
      };
    default:
      return state;
  }
}

/** 草稿 items 攤平成 shared analyzeMeal / computeIntake 用的形狀 */
export const flattenDraftItems = (items = []) =>
  items.map(({ food, grams }) => ({ ...food, grams }));

const nutrient = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * POST /api/meals 的 body。只送 grams > 0 的項目,且每項只含伺服器接受的欄位。
 */
export function buildMealPayload({
  petId,
  label,
  items = [],
  now = new Date(),
}) {
  return {
    petId,
    label,
    eatenAt: toLocalIsoString(now),
    items: items
      .filter((item) => Number.isFinite(item.grams) && item.grams > 0)
      .map(({ food, grams }) => {
        const out = {};
        if (Number.isInteger(food.id) && food.id > 0) out.foodId = food.id;
        out.name = food.name;
        out.recipeRole = RECIPE_ROLES.includes(food.recipeRole)
          ? food.recipeRole
          : 'plant';
        out.calories = nutrient(food.calories);
        out.protein = nutrient(food.protein);
        out.fat = nutrient(food.fat);
        out.ca = nutrient(food.ca);
        out.p = nutrient(food.p);
        out.grams = grams;
        return out;
      }),
  };
}

/**
 * 批次草稿的純函式:reducer 與食材快照。
 * 草稿形狀 { mealsCount: number, mealTargetOverride: number|null, items: [{ food, role, gramsPerMeal }] }
 * (與 utils/storage 的驗證一致)。
 * - mealsCount:製作餐數(整數 1–60)。
 * - mealTargetOverride:本次單餐目標 kcal;null 表示使用毛孩設定。
 * - items[].role:'fixed' 固定班底 / 'variant' 替換肉類 / 'main' 主力瘦肉(最多一個)。
 * - items[].gramsPerMeal:每餐生重;主力的值由 planGapFill 反推,這裡只是保留欄位。
 */
import { ITEM_ROLES, defaultGramsPerMeal } from '@furlogic/shared';

export const BUMP_STEP = 10;
export const MIN_MEALS_COUNT = 1;
export const MAX_MEALS_COUNT = 60;

/** 食材快照保留的欄位 */
const SNAPSHOT_KEYS = [
  'id',
  'name',
  'type',
  'subtype',
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

export const emptyBatchDraft = () => ({
  mealsCount: 2,
  mealTargetOverride: null,
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

/** 餐數正規化:取整數並限制在 1–60;非數字 → 1 */
export const toMealsCount = (value) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return MIN_MEALS_COUNT;
  return Math.min(MAX_MEALS_COUNT, Math.max(MIN_MEALS_COUNT, Math.round(n)));
};

/** 單餐目標覆寫正規化:> 0 取到一位小數,其餘(含 null / 空字串 / 非法)→ null */
export const toMealTargetOverride = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
};

const sameId = (a, b) => a !== undefined && a !== null && a === b;

const hasMain = (items) => items.some((item) => item.role === 'main');

/** 加入食材時的預設角色:蛋白質且尚無主力 → main;蛋白質已有主力 → variant;其他 → fixed */
const defaultRole = (food, items) => {
  if (food.recipeRole !== 'protein') return 'fixed';
  return hasMain(items) ? 'variant' : 'main';
};

const mapGrams = (state, id, fn) => ({
  ...state,
  items: state.items.map((item) =>
    sameId(item.food.id, id)
      ? { ...item, gramsPerMeal: fn(item.gramsPerMeal) }
      : item,
  ),
});

/**
 * actions:
 * - { type: 'setMealsCount', mealsCount }           整數 1–60
 * - { type: 'setMealTargetOverride', mealTarget }   > 0 的 kcal;null / 非法 → null(用毛孩設定)
 * - { type: 'addFood', food }        重複 id 或有毒食材不加入;角色依 defaultRole,克數依 defaultGramsPerMeal
 * - { type: 'removeFood', id }
 * - { type: 'setRole', id, role }    role ∈ ITEM_ROLES;設成 main 時原本的 main 降為 variant
 * - { type: 'setGramsPerMeal', id, grams }   ≥ 0;NaN → 0
 * - { type: 'bump', id, delta }      delta 為正 → +10,負 → −10,下限 0
 * - { type: 'clear' }                清空食材與目標覆寫,保留餐數
 */
export function batchDraftReducer(state, action) {
  switch (action?.type) {
    case 'setMealsCount': {
      const mealsCount = toMealsCount(action.mealsCount);
      return mealsCount === state.mealsCount ? state : { ...state, mealsCount };
    }
    case 'setMealTargetOverride': {
      const mealTargetOverride = toMealTargetOverride(action.mealTarget);
      return mealTargetOverride === state.mealTargetOverride
        ? state
        : { ...state, mealTargetOverride };
    }
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
        items: [
          ...state.items,
          {
            food: snapshotFood(food),
            role: defaultRole(food, state.items),
            gramsPerMeal: toGrams(defaultGramsPerMeal(food)),
          },
        ],
      };
    }
    case 'removeFood':
      return {
        ...state,
        items: state.items.filter((item) => !sameId(item.food.id, action.id)),
      };
    case 'setRole': {
      const { id, role } = action;
      if (!ITEM_ROLES.includes(role)) return state;
      const target = state.items.find((item) => sameId(item.food.id, id));
      if (!target || target.role === role) return state;
      return {
        ...state,
        items: state.items.map((item) => {
          if (sameId(item.food.id, id)) return { ...item, role };
          // 保證最多一個主力:新主力出現時,舊主力改為替換肉類
          if (role === 'main' && item.role === 'main')
            return { ...item, role: 'variant' };
          return item;
        }),
      };
    }
    case 'setGramsPerMeal':
      return mapGrams(state, action.id, () => toGrams(action.grams));
    case 'bump': {
      const step = action.delta < 0 ? -BUMP_STEP : BUMP_STEP;
      return mapGrams(state, action.id, (g) => toGrams(g + step));
    }
    case 'clear':
      return { ...emptyBatchDraft(), mealsCount: state.mealsCount };
    default:
      return state;
  }
}

/** 草稿 items 攤平成 shared planGapFill 用的形狀 */
export const toPlanItems = (items = []) =>
  items.map(({ food, role, gramsPerMeal }) => ({
    ...food,
    role,
    gramsPerMeal,
  }));

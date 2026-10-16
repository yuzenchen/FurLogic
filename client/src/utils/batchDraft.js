/**
 * 批次草稿的純函式:reducer 與食材快照。
 * 草稿形狀 { servings: number|null, items: [{ food, grams }] }(與 utils/storage 的驗證一致)。
 * servings 為 null 時使用建議份數;grams 為整鍋生重。
 */
import { allocateBatchForServings } from '@furlogic/shared';

export const BUMP_STEP = 50;
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 60;

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

export const emptyBatchDraft = () => ({ servings: null, items: [] });

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

/** 份數正規化:null/空字串 → null(用建議);其餘取整數並限制在 1–60 */
export const toServings = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(n)));
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
 * - { type: 'setServings', servings }   整數 1–60;null 表示使用建議份數
 * - { type: 'addFood', food }           重複 id 或有毒食材不加入;預設 0 克
 * - { type: 'removeFood', id }
 * - { type: 'setGrams', id, grams }     ≥ 0;NaN → 0
 * - { type: 'bump', id, delta }         delta 為正 → +50,負 → −50,下限 0
 * - { type: 'applyAllocation', servings, mealTarget }  依份數 × 單餐目標配量
 * - { type: 'clear' }
 */
export function batchDraftReducer(state, action) {
  switch (action?.type) {
    case 'setServings': {
      const servings = toServings(action.servings);
      return servings === state.servings ? state : { ...state, servings };
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
      const allocated = allocateBatchForServings(
        state.items.map((item) => item.food),
        toServings(action.servings) ?? MIN_SERVINGS,
        Number(action.mealTarget) || 0,
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
      return emptyBatchDraft();
    default:
      return state;
  }
}

/** 草稿 items 攤平成 shared planBatch / analyzeMeal 用的形狀 */
export const flattenDraftItems = (items = []) =>
  items.map(({ food, grams }) => ({ ...food, grams }));

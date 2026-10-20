/**
 * 批次草稿的純函式:reducer 與食材快照。
 * 草稿形狀 { mealsCount: number, mealTargetOverride: number|null, inputMode: 'batch'|'perMeal', items: [{ food, role, batchGrams }] }
 * (與 utils/storage 的驗證一致)。
 * - mealsCount:製作餐數(整數 1–60)。
 * - inputMode:UI 輸入模式;'batch' 輸入採買總量(預設)、'perMeal' 輸入每餐克數。
 *   item 內部一律存 batchGrams,perMeal 只是換算後再存;改餐數時 perMeal 模式會等比縮放 batchGrams 以保每餐量不變。
 * - mealTargetOverride:本次單餐目標 kcal;null 表示使用毛孩設定。
 * - items[].role:'fixed' 固定班底 / 'variant' 替換肉類 / 'main' 主力瘦肉(最多一個)。
 * - items[].batchGrams:整批採買總量(生重);每餐克數 = batchGrams ÷ mealsCount,
 *   在 toPlanItems 換算後交給 planGapFill;主力的值由缺口反推,這裡只是保留欄位。
 */
import { ITEM_ROLES, defaultGramsPerMeal } from '@furlogic/shared';

/** 步進克數:採買總量模式 ±50;每餐模式 ±10(換成總量 = 10 × 餐數) */
export const BUMP_STEP_BATCH = 50;
export const BUMP_STEP_PER_MEAL = 10;
export const INPUT_MODES = ['batch', 'perMeal'];
export const DEFAULT_INPUT_MODE = 'batch';
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
  inputMode: DEFAULT_INPUT_MODE,
  items: [],
});

/** 輸入模式正規化:非法值 → 'batch' */
export const toInputMode = (value) =>
  INPUT_MODES.includes(value) ? value : DEFAULT_INPUT_MODE;

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
      ? { ...item, batchGrams: fn(item.batchGrams) }
      : item,
  ),
});

/**
 * actions:
 * - { type: 'setMealsCount', mealsCount }           整數 1–60;batch 模式不動 batchGrams(每餐量隨之改變),
 *                                                    perMeal 模式 batchGrams = round1(batchGrams ÷ 舊餐數 × 新餐數)(每餐量不變)
 * - { type: 'setInputMode', mode }                  'batch' | 'perMeal';非法 → 'batch'
 * - { type: 'setMealTargetOverride', mealTarget }   > 0 的 kcal;null / 非法 → null(用毛孩設定)
 * - { type: 'addFood', food }        重複 id 或有毒食材不加入;角色依 defaultRole,總量 = defaultGramsPerMeal × mealsCount
 * - { type: 'removeFood', id }
 * - { type: 'setRole', id, role }    role ∈ ITEM_ROLES;設成 main 時原本的 main 降為 variant
 * - { type: 'setBatchGrams', id, grams }   採買總量 ≥ 0;NaN → 0
 * - { type: 'setGramsPerMeal', id, grams }  每餐克數 → batchGrams = round1(grams × mealsCount)
 * - { type: 'bump', id, delta }      依模式步進:batch ±50;perMeal ±10 × mealsCount(總量),下限 0
 * - { type: 'clear' }                清空食材與目標覆寫,保留餐數與輸入模式
 */
export function batchDraftReducer(state, action) {
  switch (action?.type) {
    case 'setMealsCount': {
      const mealsCount = toMealsCount(action.mealsCount);
      if (mealsCount === state.mealsCount) return state;
      if (state.inputMode !== 'perMeal') return { ...state, mealsCount };
      // 每餐模式:等比縮放總量,讓每餐克數維持不變
      const ratio = mealsCount / state.mealsCount;
      return {
        ...state,
        mealsCount,
        items: state.items.map((item) => ({
          ...item,
          batchGrams: toGrams(item.batchGrams * ratio),
        })),
      };
    }
    case 'setInputMode': {
      const inputMode = toInputMode(action.mode);
      return inputMode === state.inputMode ? state : { ...state, inputMode };
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
            batchGrams: toGrams(defaultGramsPerMeal(food) * state.mealsCount),
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
    case 'setBatchGrams':
      return mapGrams(state, action.id, () => toGrams(action.grams));
    case 'setGramsPerMeal':
      return mapGrams(state, action.id, () =>
        toGrams(Number(action.grams) * state.mealsCount),
      );
    case 'bump': {
      const size =
        state.inputMode === 'perMeal'
          ? BUMP_STEP_PER_MEAL * state.mealsCount
          : BUMP_STEP_BATCH;
      const step = action.delta < 0 ? -size : size;
      return mapGrams(state, action.id, (g) => toGrams(g + step));
    }
    case 'clear':
      return {
        ...emptyBatchDraft(),
        mealsCount: state.mealsCount,
        inputMode: state.inputMode,
      };
    default:
      return state;
  }
}

/**
 * 草稿 items 攤平成 shared planGapFill 用的形狀:採買總量 ÷ 餐數 → 每餐克數
 * (不四捨五入,取位交給 shared)。餐數非法時以 1 計。
 */
export const toPlanItems = (items = [], mealsCount = 1) => {
  const n = Number.isFinite(mealsCount) && mealsCount >= 1 ? mealsCount : 1;
  return items.map(({ food, role, batchGrams }) => ({
    ...food,
    role,
    gramsPerMeal: batchGrams / n,
  }));
};

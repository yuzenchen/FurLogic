/**
 * 計算頁草稿的純函式:reducer 與食材快照。
 * 草稿形狀 { mealsCount: number, mealTargetOverride: number|null, categoryPct: { [cat]: number }, items: [{ food, pct }] }
 * (與 utils/storage 的驗證一致)。
 * - mealsCount:製作餐數(整數 1–60)。
 * - mealTargetOverride:本次單餐目標 kcal;null 表示使用毛孩設定。
 * - categoryPct:各比例類別(shared RATIO_CATEGORIES,依 ratioCategoryOf(food) 歸類)占每餐總重的 %;
 *   只放目前有食材的類別。
 * - items[].pct:該食材占每餐總重的 %(同類加總應 = 類別 %,全部加總應 = 100)。
 */
import {
  defaultCategoryPcts,
  ratioCategoryOf,
  splitEvenly,
} from '@furlogic/shared';

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
  categoryPct: {},
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

/** 比例正規化:0–100、一位小數;非有限數 → 0 */
export const toPct = (value) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.round(n * 10) / 10);
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

/** 草稿項目所屬的比例類別 */
export const categoryOfItem = (item) => ratioCategoryOf(item?.food);

/** 目前有食材的類別(依出現順序,不重複) */
export const presentCategories = (items = []) => [
  ...new Set(items.map(categoryOfItem)),
];

/** 把 categoryPct[cat] 平均分給該類所有食材(覆蓋其 pct) */
const splitInto = (items, categoryPct, cat) => {
  const idx = [];
  items.forEach((item, i) => {
    if (categoryOfItem(item) === cat) idx.push(i);
  });
  if (idx.length === 0) return items;
  const parts = splitEvenly(categoryPct[cat] ?? 0, idx.length);
  const next = items.slice();
  idx.forEach((itemIndex, k) => {
    next[itemIndex] = { ...next[itemIndex], pct: parts[k] };
  });
  return next;
};

/** 依目前出現的類別重算全部類別 %(defaultCategoryPcts),再各自平均分給類內食材 */
const rebuildAll = (state, items) => {
  const categoryPct = defaultCategoryPcts(presentCategories(items));
  const nextItems = Object.keys(categoryPct).reduce(
    (acc, cat) => splitInto(acc, categoryPct, cat),
    items,
  );
  return { ...state, categoryPct, items: nextItems };
};

/**
 * actions:
 * - { type: 'setMealsCount', mealsCount }           整數 1–60
 * - { type: 'setMealTargetOverride', mealTarget }   > 0 的 kcal;null / 非法 → null(用毛孩設定)
 * - { type: 'addFood', food }        重複 id 或有毒食材不加入;新類別 → 重算全部類別 %;
 *                                    再把該類別 % 平均分給該類所有食材
 * - { type: 'removeFood', id }       該類別已無食材 → 刪類別並重算全部;否則只重分該類
 * - { type: 'setCategoryPct', cat, pct }  0–100 一位小數,並平均分給該類食材
 * - { type: 'setItemPct', id, pct }  0–100 一位小數,只改該項(不連動)
 * - { type: 'splitCategory', cat }   把該類別 % 平均分給該類食材
 * - { type: 'clear' }                清空食材、類別 % 與目標覆寫,保留餐數
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
      const item = { food: snapshotFood(food), pct: 0 };
      const cat = categoryOfItem(item);
      const items = [...state.items, item];
      if (!presentCategories(state.items).includes(cat)) {
        return rebuildAll(state, items);
      }
      return { ...state, items: splitInto(items, state.categoryPct, cat) };
    }
    case 'removeFood': {
      const target = state.items.find((item) =>
        sameId(item.food.id, action.id),
      );
      if (!target) return state;
      const cat = categoryOfItem(target);
      const items = state.items.filter((item) => item !== target);
      if (!presentCategories(items).includes(cat)) {
        return rebuildAll(state, items);
      }
      return { ...state, items: splitInto(items, state.categoryPct, cat) };
    }
    case 'setCategoryPct': {
      const { cat } = action;
      if (!presentCategories(state.items).includes(cat)) return state;
      const categoryPct = { ...state.categoryPct, [cat]: toPct(action.pct) };
      return {
        ...state,
        categoryPct,
        items: splitInto(state.items, categoryPct, cat),
      };
    }
    case 'setItemPct': {
      const pct = toPct(action.pct);
      const target = state.items.find((item) =>
        sameId(item.food.id, action.id),
      );
      if (!target || target.pct === pct) return state;
      return {
        ...state,
        items: state.items.map((item) =>
          item === target ? { ...item, pct } : item,
        ),
      };
    }
    case 'splitCategory': {
      const { cat } = action;
      if (!presentCategories(state.items).includes(cat)) return state;
      return {
        ...state,
        items: splitInto(state.items, state.categoryPct, cat),
      };
    }
    case 'clear':
      return { ...emptyBatchDraft(), mealsCount: state.mealsCount };
    default:
      return state;
  }
}

/** 草稿 items 攤平成 shared planByRatio 用的形狀 */
export const toRatioItems = (items = []) =>
  items.map(({ food, pct }) => ({ ...food, pct }));

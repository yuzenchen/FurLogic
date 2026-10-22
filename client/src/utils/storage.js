/**
 * localStorage 小工具。所有存取都包 try/catch(無痕模式 / 停用儲存時不會壞掉)。
 * 毛孩資料、食材都存在 API,這裡只放 UI 偏好、計算頁草稿與舊版資料遷移。
 */
import { RATIO_CATEGORIES } from '@furlogic/shared';
import { batchDraftReducer, presentCategories } from './batchDraft';

const KEYS = {
  ACTIVE_TAB: 'furlogic_active_tab',
  BATCH_DRAFT: 'furlogic_batch_draft',
  // 已移除的單餐記錄草稿(載入時清掉);以片段組成,方便全域搜尋舊功能殘留
  // 舊版單餐草稿,載入時清除
  LEGACY_SINGLE_DRAFT: 'furlogic_meal_draft',
  IMPORT_DISMISSED: 'furlogic_import_dismissed',
  // 舊版(純前端)使用的 key
  LEGACY_PET_PROFILE: 'furlogic_pet_profile',
  LEGACY_KITCHEN_INGREDIENTS: 'furlogic_kitchen_ingredients',
  LEGACY_APP_VERSION: 'furlogic_app_version',
};

const readRaw = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeRaw = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const removeRaw = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const readJson = (key) => {
  const raw = readRaw(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

// === 目前分頁 ===
export const TABS = ['batch', 'foods'];
export const DEFAULT_TAB = 'batch';
/** 舊分頁值 → 新分頁(today/history/log 與更舊的 home/kitchen 都併入計算頁) */
const LEGACY_TAB_MAP = {
  today: 'batch',
  history: 'batch',
  log: 'batch',
  home: 'batch',
  kitchen: 'batch',
  search: 'foods',
};

/** 讀目前分頁;舊值自動對應(見 LEGACY_TAB_MAP),無效值回預設 */
export const getActiveTab = () => {
  let value = readRaw(KEYS.ACTIVE_TAB);
  // 舊版以 JSON 字串存('"home"')
  if (value && value.startsWith('"')) {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  if (TABS.includes(value)) return value;
  if (value && LEGACY_TAB_MAP[value]) return LEGACY_TAB_MAP[value];
  return DEFAULT_TAB;
};

export const saveActiveTab = (tab) => {
  if (TABS.includes(tab)) writeRaw(KEYS.ACTIVE_TAB, tab);
};

// === 計算頁草稿 ===
const isValidPct = (v) => Number.isFinite(v) && v >= 0 && v <= 100;

const isValidFood = (food) =>
  isPlainObject(food) && typeof food.name === 'string';

/** 現行項目:{ food, pct } */
const isValidRatioItem = (item) =>
  isPlainObject(item) && isValidFood(item.food) && isValidPct(item.pct);

const isValidGrams = (g) => Number.isFinite(g) && g >= 0;

/**
 * 上一版(缺口填補)項目:{ food, role, batchGrams | gramsPerMeal };
 * 只保留食材清單,比例依序 addFood 重建。
 */
const isLegacyGapItem = (item) =>
  isPlainObject(item) &&
  isValidFood(item.food) &&
  typeof item.role === 'string' &&
  (item.batchGrams !== undefined
    ? isValidGrams(item.batchGrams)
    : isValidGrams(item.gramsPerMeal));

const isValidCategoryPct = (categoryPct, items) =>
  isPlainObject(categoryPct) &&
  Object.entries(categoryPct).every(
    ([cat, v]) => RATIO_CATEGORIES.includes(cat) && isValidPct(v),
  ) &&
  presentCategories(items).every((cat) => categoryPct[cat] !== undefined);

const isValidMealsCount = (n) => Number.isInteger(n) && n >= 1 && n <= 60;

const isValidTargetOverride = (v) =>
  v === null || (Number.isFinite(v) && v > 0);

/** 依序 addFood 重建 categoryPct 與 pct */
const rebuildFromFoods = (base, foods) =>
  foods.reduce(
    (state, food) => batchDraftReducer(state, { type: 'addFood', food }),
    base,
  );

/**
 * 讀計算頁草稿;順便清掉已停用的單餐草稿 key。格式不符回 null。
 * 相容上一版(缺口填補)形狀:items 有 role / batchGrams / gramsPerMeal →
 * 保留食材清單,依序 addFood 重建 categoryPct 與 pct(有毒 / 重複食材會被略過)。
 * 更舊的形狀(servings / grams / vegWeightPct)不遷移,直接視為無效。
 * @returns {{ mealsCount: number, mealTargetOverride: number|null, categoryPct: Record<string, number>, items: Array<{ food: object, pct: number }> } | null}
 */
export const getBatchDraft = () => {
  removeRaw(KEYS.LEGACY_SINGLE_DRAFT);
  const draft = readJson(KEYS.BATCH_DRAFT);
  if (
    !isPlainObject(draft) ||
    !isValidMealsCount(draft.mealsCount) ||
    !isValidTargetOverride(draft.mealTargetOverride ?? null) ||
    !Array.isArray(draft.items)
  ) {
    return null;
  }
  const base = {
    mealsCount: draft.mealsCount,
    mealTargetOverride: draft.mealTargetOverride ?? null,
    categoryPct: {},
    items: [],
  };
  if (
    draft.items.every(isValidRatioItem) &&
    isValidCategoryPct(draft.categoryPct ?? {}, draft.items)
  ) {
    return {
      ...base,
      categoryPct: { ...(draft.categoryPct ?? {}) },
      items: draft.items.map(({ food, pct }) => ({ food, pct })),
    };
  }
  if (draft.items.length > 0 && draft.items.every(isLegacyGapItem)) {
    return rebuildFromFoods(
      base,
      draft.items.map((item) => item.food),
    );
  }
  return null;
};

export const saveBatchDraft = (draft) => {
  try {
    writeRaw(KEYS.BATCH_DRAFT, JSON.stringify(draft));
  } catch {
    // JSON 失敗(循環參照等)時略過
  }
};

export const clearBatchDraft = () => removeRaw(KEYS.BATCH_DRAFT);

// === 舊版資料匯入 ===
const ACTIVITY_LEVELS = ['low', 'normal', 'high'];

/**
 * 讀舊版毛孩檔案;不存在或格式不符回 null。
 * @returns {{ name: string, weight: number, isNeutered: boolean, activityLevel: string } | null}
 */
export const readLegacyPetProfile = () => {
  const p = readJson(KEYS.LEGACY_PET_PROFILE);
  if (!isPlainObject(p)) return null;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const weight = Number(p.weight);
  if (!name || name.length > 30) return null;
  if (!Number.isFinite(weight) || weight <= 0 || weight > 150) return null;
  return {
    name,
    weight,
    isNeutered: Boolean(p.isNeutered),
    activityLevel: ACTIVITY_LEVELS.includes(p.activityLevel)
      ? p.activityLevel
      : 'normal',
  };
};

export const clearLegacyData = () => {
  removeRaw(KEYS.LEGACY_PET_PROFILE);
  removeRaw(KEYS.LEGACY_KITCHEN_INGREDIENTS);
  removeRaw(KEYS.LEGACY_APP_VERSION);
};

export const isLegacyImportDismissed = () =>
  readRaw(KEYS.IMPORT_DISMISSED) === '1';

export const dismissLegacyImport = () => writeRaw(KEYS.IMPORT_DISMISSED, '1');

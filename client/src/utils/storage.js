/**
 * localStorage 小工具。所有存取都包 try/catch(無痕模式 / 停用儲存時不會壞掉)。
 * 毛孩資料、食材都存在 API,這裡只放 UI 偏好、批次草稿與舊版資料遷移。
 */
import { ITEM_ROLES } from '@furlogic/shared';
import { toInputMode } from './batchDraft';

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
/** 舊分頁值 → 新分頁(today/history/log 與更舊的 home/kitchen 都併入批次) */
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

// === 批次草稿 ===
const isValidGrams = (g) => Number.isFinite(g) && g >= 0;

/** 草稿項目:batchGrams(現行)或 gramsPerMeal(舊形狀,讀取時換算)其一有效即可 */
const isValidDraftItem = (item) =>
  isPlainObject(item) &&
  isPlainObject(item.food) &&
  typeof item.food.name === 'string' &&
  ITEM_ROLES.includes(item.role) &&
  (item.batchGrams !== undefined
    ? isValidGrams(item.batchGrams)
    : isValidGrams(item.gramsPerMeal));

const round1 = (n) => Math.round(n * 10) / 10;

/** 舊形狀 { gramsPerMeal } → { batchGrams = round1(gramsPerMeal × mealsCount) } */
const normalizeDraftItem = (item, mealsCount) => {
  const { gramsPerMeal, ...rest } = item;
  if (item.batchGrams !== undefined) return rest;
  return { ...rest, batchGrams: round1(gramsPerMeal * mealsCount) };
};

const isValidMealsCount = (n) => Number.isInteger(n) && n >= 1 && n <= 60;

const isValidTargetOverride = (v) =>
  v === null || (Number.isFinite(v) && v > 0);

/**
 * 讀批次草稿;順便清掉已停用的單餐草稿 key。格式不符回 null。
 * 相容舊形狀:item 只有 gramsPerMeal(無 batchGrams)→ batchGrams = round1(gramsPerMeal × mealsCount)。
 * 更舊的形狀(servings / grams / vegWeightPct)不遷移,直接視為無效。
 * inputMode 缺少或非法 → 'batch'。
 * @returns {{ mealsCount: number, mealTargetOverride: number|null, inputMode: 'batch'|'perMeal', items: Array<{ food: object, role: string, batchGrams: number }> } | null}
 */
export const getBatchDraft = () => {
  removeRaw(KEYS.LEGACY_SINGLE_DRAFT);
  const draft = readJson(KEYS.BATCH_DRAFT);
  if (
    !isPlainObject(draft) ||
    !isValidMealsCount(draft.mealsCount) ||
    !isValidTargetOverride(draft.mealTargetOverride ?? null) ||
    !Array.isArray(draft.items) ||
    !draft.items.every(isValidDraftItem)
  ) {
    return null;
  }
  return {
    mealsCount: draft.mealsCount,
    mealTargetOverride: draft.mealTargetOverride ?? null,
    inputMode: toInputMode(draft.inputMode),
    items: draft.items.map((item) =>
      normalizeDraftItem(item, draft.mealsCount),
    ),
  };
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

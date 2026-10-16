/**
 * localStorage 小工具。所有存取都包 try/catch(無痕模式 / 停用儲存時不會壞掉)。
 * 毛孩資料、食材、餐點都存在 API,這裡只放 UI 偏好、記餐草稿與舊版資料遷移。
 */
const KEYS = {
  ACTIVE_TAB: 'furlogic_active_tab',
  MEAL_DRAFT: 'furlogic_meal_draft',
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
export const TABS = ['today', 'history', 'log', 'foods'];
export const DEFAULT_TAB = 'today';
const LEGACY_TAB_MAP = { home: 'today', search: 'foods', kitchen: 'log' };

/** 讀目前分頁;舊值(home/search/kitchen)自動對應,無效值回預設 */
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

// === 記餐草稿 ===
const isValidDraftItem = (item) =>
  isPlainObject(item) &&
  isPlainObject(item.food) &&
  typeof item.food.name === 'string' &&
  Number.isFinite(item.grams);

/**
 * @returns {{ label: string, items: Array<{ food: object, grams: number }> } | null}
 */
export const getMealDraft = () => {
  const draft = readJson(KEYS.MEAL_DRAFT);
  if (
    !isPlainObject(draft) ||
    typeof draft.label !== 'string' ||
    !Array.isArray(draft.items) ||
    !draft.items.every(isValidDraftItem)
  ) {
    return null;
  }
  return { label: draft.label, items: draft.items };
};

export const saveMealDraft = (draft) => {
  try {
    writeRaw(KEYS.MEAL_DRAFT, JSON.stringify(draft));
  } catch {
    // JSON 失敗(循環參照等)時略過
  }
};

export const clearMealDraft = () => removeRaw(KEYS.MEAL_DRAFT);

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

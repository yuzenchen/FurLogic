/**
 * FurLogic Storage Utility
 * 使用 localStorage 進行資料持久化
 */

const STORAGE_KEYS = {
  PET_PROFILE: 'furlogic_pet_profile',
  ACTIVE_TAB: 'furlogic_active_tab',
  KITCHEN_INGREDIENTS: 'furlogic_kitchen_ingredients',
};

const DEFAULT_PET_PROFILE = {
  name: 'Mochi',
  weight: 12,
  isNeutered: true,
  activityLevel: 'normal',
};

// 模組載入時檢測一次,結果 cache
const localStorageAvailable = (() => {
  try {
    const k = '__furlogic_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    console.warn('localStorage 不可用:', e);
    return false;
  }
})();

const getItem = (key, defaultValue) => {
  if (!localStorageAvailable) return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? defaultValue : JSON.parse(raw);
  } catch (e) {
    console.error(`讀取 ${key} 失敗:`, e);
    return defaultValue;
  }
};

const setItem = (key, value) => {
  if (!localStorageAvailable) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`儲存 ${key} 失敗:`, e);
    return false;
  }
};

// === 毛孩檔案 ===
export const getPetProfile = () =>
  getItem(STORAGE_KEYS.PET_PROFILE, DEFAULT_PET_PROFILE);
export const savePetProfile = (profile) =>
  setItem(STORAGE_KEYS.PET_PROFILE, profile);

// === 活動分頁 ===
export const getActiveTab = () => getItem(STORAGE_KEYS.ACTIVE_TAB, 'home');
export const saveActiveTab = (tab) => setItem(STORAGE_KEYS.ACTIVE_TAB, tab);

// === 廚房食材選擇 ===
export const getKitchenIngredients = () =>
  getItem(STORAGE_KEYS.KITCHEN_INGREDIENTS, []);
export const saveKitchenIngredients = (ingredients) =>
  setItem(STORAGE_KEYS.KITCHEN_INGREDIENTS, ingredients);

/**
 * FurLogic Storage Utility
 * 使用 localStorage 進行資料持久化
 */

const STORAGE_KEYS = {
  PET_PROFILE: 'furlogic_pet_profile',
  ACTIVE_TAB: 'furlogic_active_tab',
  KITCHEN_INGREDIENTS: 'furlogic_kitchen_ingredients',
  APP_VERSION: 'furlogic_app_version',
};

const APP_VERSION = '1.0.1';

/**
 * 檢查 localStorage 是否可用
 */
const isLocalStorageAvailable = () => {
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('localStorage 不可用:', e);
    return false;
  }
};

/**
 * 從 localStorage 讀取資料
 * @param {string} key - 儲存鍵名
 * @param {*} defaultValue - 預設值
 * @returns {*} 讀取的資料或預設值
 */
const getItem = (key, defaultValue = null) => {
  if (!isLocalStorageAvailable()) {
    return defaultValue;
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item);
  } catch (e) {
    console.error(`讀取 ${key} 失敗:`, e);
    return defaultValue;
  }
};

/**
 * 儲存資料到 localStorage
 * @param {string} key - 儲存鍵名
 * @param {*} value - 要儲存的值
 * @returns {boolean} 是否成功儲存
 */
const setItem = (key, value) => {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`儲存 ${key} 失敗:`, e);
    return false;
  }
};

/**
 * 從 localStorage 刪除資料
 * @param {string} key - 儲存鍵名
 */
const removeItem = (key) => {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`刪除 ${key} 失敗:`, e);
  }
};

/**
 * 清除所有 FurLogic 相關資料
 */
const clearAll = () => {
  if (!isLocalStorageAvailable()) {
    return;
  }

  Object.values(STORAGE_KEYS).forEach(key => {
    removeItem(key);
  });
};

// === 毛孩檔案相關 ===

/**
 * 讀取毛孩檔案
 */
export const getPetProfile = () => {
  const defaultProfile = {
    name: 'Mochi',
    weight: 12,
    isNeutered: true,
    activityLevel: 'normal',
  };

  return getItem(STORAGE_KEYS.PET_PROFILE, defaultProfile);
};

/**
 * 儲存毛孩檔案
 * @param {Object} profile - 毛孩檔案物件
 */
export const savePetProfile = (profile) => {
  return setItem(STORAGE_KEYS.PET_PROFILE, profile);
};

// === 活動分頁相關 ===

/**
 * 讀取上次活動的分頁
 */
export const getActiveTab = () => {
  return getItem(STORAGE_KEYS.ACTIVE_TAB, 'home');
};

/**
 * 儲存當前活動的分頁
 * @param {string} tab - 分頁名稱
 */
export const saveActiveTab = (tab) => {
  return setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
};

// === 廚房配餐相關 ===

/**
 * 讀取已選食材
 */
export const getKitchenIngredients = () => {
  return getItem(STORAGE_KEYS.KITCHEN_INGREDIENTS, []);
};

/**
 * 儲存已選食材
 * @param {Array} ingredients - 食材陣列
 */
export const saveKitchenIngredients = (ingredients) => {
  return setItem(STORAGE_KEYS.KITCHEN_INGREDIENTS, ingredients);
};

// === 版本管理 ===

/**
 * 檢查是否需要資料遷移
 */
export const checkVersion = () => {
  const storedVersion = getItem(STORAGE_KEYS.APP_VERSION);
  
  if (!storedVersion || storedVersion !== APP_VERSION) {
    console.log(`版本更新: ${storedVersion} -> ${APP_VERSION}`);
    // 這裡可以加入資料遷移邏輯
    setItem(STORAGE_KEYS.APP_VERSION, APP_VERSION);
    return true;
  }
  
  return false;
};

// === 匯出/匯入資料 ===

/**
 * 匯出所有資料為 JSON
 */
export const exportData = () => {
  return {
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    data: {
      petProfile: getPetProfile(),
      activeTab: getActiveTab(),
      kitchenIngredients: getKitchenIngredients(),
    },
  };
};

/**
 * 從 JSON 匯入資料
 * @param {Object} data - 匯入的資料物件
 */
export const importData = (data) => {
  try {
    if (!data.version || !data.data) {
      throw new Error('無效的資料格式');
    }

    const { petProfile, activeTab, kitchenIngredients } = data.data;

    if (petProfile) savePetProfile(petProfile);
    if (activeTab) saveActiveTab(activeTab);
    if (kitchenIngredients) saveKitchenIngredients(kitchenIngredients);

    console.log('資料匯入成功');
    return true;
  } catch (e) {
    console.error('資料匯入失敗:', e);
    return false;
  }
};

// === 工具函數 ===

/**
 * 重置為預設值
 */
export const resetToDefaults = () => {
  clearAll();
  checkVersion();
  console.log('已重置為預設值');
};

// 初始化時檢查版本
checkVersion();

export default {
  getPetProfile,
  savePetProfile,
  getActiveTab,
  saveActiveTab,
  getKitchenIngredients,
  saveKitchenIngredients,
  exportData,
  importData,
  resetToDefaults,
};
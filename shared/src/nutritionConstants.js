/**
 * 營養計算常數
 *
 * 來源:
 * - RER 公式:NRC (2006) Nutrient Requirements of Dogs and Cats
 *   RER = 70 × BW(kg)^0.75
 * - 活動係數參考:WSAVA Global Nutrition Guidelines (2011) /
 *   Hand et al. Small Animal Clinical Nutrition (5th ed., Ch.13)
 * - 鈣磷比建議:AAFCO 犬隻成犬維持期 1.0:1 ~ 2.1:1
 * - 蛋殼粉鈣含量:約 38% calcium carbonate → ~380 mg Ca/g;
 *   保守估 350 mg/g 以避免過量
 */

// === RER (Resting Energy Requirement) ===
export const RER_COEFFICIENT = 70;
export const RER_EXPONENT = 0.75;

// === 飲水量 (ml/kg/day) ===
export const WATER_ML_PER_KG = 60;

// === 活動係數 ===
export const ACTIVITY_FACTOR_BASE = {
  neutered: 1.6,
  intact: 1.8,
};
export const ACTIVITY_LEVEL_DELTA = {
  low: -0.2,
  normal: 0,
  high: 0.4,
};

// === 鈣磷比 ===
export const CAP_RATIO_MIN_GOOD = 1.0;
export const CAP_RATIO_MAX_GOOD = 2.0;
export const CAP_RATIO_TARGET = 1.2; // 補鈣時的目標比

// === 配餐熱量分配 ===
export const MEAT_CALORIE_RATIO = 0.7; // 有肉時,肉類佔總熱量比例
export const DEFAULT_MEALS_PER_DAY = 2; // DER 預設拆兩餐
export const MEALS_PER_DAY = DEFAULT_MEALS_PER_DAY; // 向下相容舊名稱

// === 補充品 ===
export const EGGSHELL_CA_MG_PER_GRAM = 350;

// === 每餐上限(護腸配方;超過只警告不強制) ===
export const FOOD_SUBTYPE = { ORGAN: 'organ', FATTY_FISH: 'fatty_fish' };
export const MEAL_CAPS = {
  veg: { grams: 50, label: '蔬菜' }, // food.type === 'veg'
  organ: { grams: 12, label: '內臟' }, // food.subtype === 'organ'
  fatty_fish: { grams: 65, label: '高脂魚' }, // food.subtype === 'fatty_fish'
};

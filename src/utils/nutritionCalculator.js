/**
 * 營養計算工具函式 (純函式,可單元測試)
 */
import {
  RER_COEFFICIENT,
  RER_EXPONENT,
  WATER_ML_PER_KG,
  ACTIVITY_FACTOR_BASE,
  ACTIVITY_LEVEL_DELTA,
  CAP_RATIO_MIN_GOOD,
  CAP_RATIO_MAX_GOOD,
  CAP_RATIO_TARGET,
  MEAT_CALORIE_RATIO,
  EGGSHELL_CA_MG_PER_GRAM,
} from './nutritionConstants';

/**
 * RER (Resting Energy Requirement) 靜止能量需求 (kcal)
 */
export const calculateRER = (weight) =>
  Math.round(RER_COEFFICIENT * Math.pow(weight, RER_EXPONENT));

/**
 * DER (Daily Energy Requirement) 每日能量需求 (kcal)
 */
export const calculateDER = (rer, factor) => Math.round(rer * factor);

/**
 * 活動係數
 * @param {boolean} isNeutered
 * @param {'low'|'normal'|'high'} activityLevel
 */
export const calculateActivityFactor = (isNeutered, activityLevel) => {
  const base = isNeutered
    ? ACTIVITY_FACTOR_BASE.neutered
    : ACTIVITY_FACTOR_BASE.intact;
  const delta = ACTIVITY_LEVEL_DELTA[activityLevel] ?? 0;
  return base + delta;
};

/**
 * 建議飲水量 (ml/day)
 */
export const calculateWaterNeed = (weight) =>
  Math.round(weight * WATER_ML_PER_KG);

/**
 * 鈣磷比分析
 */
export const analyzeCaPRatio = (totalCa, totalP) => {
  if (totalP <= 0) {
    return { ratio: 0, status: 'unknown', advice: '無法計算鈣磷比' };
  }

  const ratio = totalCa / totalP;
  const ratioFixed = ratio.toFixed(2);

  if (ratio < CAP_RATIO_MIN_GOOD) {
    return {
      ratio: ratioFixed,
      status: 'low',
      advice: `缺鈣警告 (1:${(1 / ratio).toFixed(1)})。肉類磷含量高,務必添加鈣粉或蛋殼粉平衡。`,
    };
  }
  if (ratio > CAP_RATIO_MAX_GOOD) {
    return {
      ratio: ratioFixed,
      status: 'high',
      advice: `鈣質過高 (1:${ratio.toFixed(1)})。請減少骨頭或鈣粉攝取。`,
    };
  }
  return { ratio: ratioFixed, status: 'good', advice: '鈣磷比完美!' };
};

/**
 * 將單一食材的鈣/磷加進累計值。每 100g 食材的營養 × 實際克數 / 100。
 */
const accumulateMineral = (food, grams) => ({
  ca: (food.ca * grams) / 100,
  p: (food.p * grams) / 100,
});

/**
 * 依目標熱量,把肉類/蔬菜的份量(克)算出來
 */
const allocatePortion = (food, calorieBudgetPerItem) =>
  Math.round((calorieBudgetPerItem / food.calories) * 100);

/**
 * 生成食譜
 * @param {Array} selectedIngredients
 * @param {number} targetCalories
 */
export const generateRecipe = (selectedIngredients, targetCalories) => {
  // 用 recipeRole(配餐角色),不要直接看顯示分類 type
  // 舊資料若沒 recipeRole,fallback 到 type === 'protein'
  const roleOf = (i) =>
    i.recipeRole ?? (i.type === 'protein' ? 'protein' : 'plant');
  const proteins = selectedIngredients.filter((i) => roleOf(i) === 'protein');
  const plants = selectedIngredients.filter((i) => roleOf(i) === 'plant');
  const hasMeat = proteins.length > 0;

  const proteinBudget = hasMeat ? targetCalories * MEAT_CALORIE_RATIO : 0;
  const plantBudget = hasMeat
    ? targetCalories * (1 - MEAT_CALORIE_RATIO)
    : targetCalories;

  const items = [];
  let totalCa = 0;
  let totalP = 0;

  const addGroup = (group, totalBudget) => {
    if (group.length === 0) return;
    const perItem = totalBudget / group.length;
    group.forEach((food) => {
      const amount = allocatePortion(food, perItem);
      const minerals = accumulateMineral(food, amount);
      totalCa += minerals.ca;
      totalP += minerals.p;
      items.push({ ...food, amount });
    });
  };

  addGroup(proteins, proteinBudget);
  addGroup(plants, plantBudget);

  const analysis = analyzeCaPRatio(totalCa, totalP);
  const supplements = buildSupplements(analysis, totalCa, totalP);

  return {
    items,
    calories: targetCalories,
    analysis,
    supplements,
  };
};

const buildSupplements = (analysis, totalCa, totalP) => {
  const list = [];
  if (analysis.status === 'low') {
    const targetCa = totalP * CAP_RATIO_TARGET;
    const missingCa = Math.max(0, targetCa - totalCa);
    const grams = (missingCa / EGGSHELL_CA_MG_PER_GRAM).toFixed(1);
    list.push({
      name: '蛋殼粉',
      amount: `${grams}g`,
      reason: '平衡鈣磷比',
    });
  }
  list.push({
    name: '魚油',
    amount: '1顆',
    reason: '補充 Omega-3',
  });
  return list;
};

/**
 * 餐點營養分析與熱量目標的純函式(前後端共用,可單元測試)
 */
import {
  analyzeCaPRatio,
  buildSupplements,
  computeMacros,
} from './nutritionCalculator.js';
import {
  DEFAULT_MEALS_PER_DAY,
  MEAT_CALORIE_RATIO,
} from './nutritionConstants.js';

// === 每餐目標熱量 ===
const MIN_MEALS_PER_DAY = 1;
const MAX_MEALS_PER_DAY = 4;

/**
 * 每餐目標熱量(未四捨五入)。mealsPerDay 限制在 1–4,預設 2。
 */
export const mealTargetCalories = (
  der,
  mealsPerDay = DEFAULT_MEALS_PER_DAY,
) => {
  const n = Number.isFinite(mealsPerDay)
    ? Math.min(
        MAX_MEALS_PER_DAY,
        Math.max(MIN_MEALS_PER_DAY, Math.round(mealsPerDay)),
      )
    : DEFAULT_MEALS_PER_DAY;
  return der / n;
};

// === 攝取量計算 ===
const isValidGrams = (grams) => Number.isFinite(grams) && grams > 0;

/**
 * 累加攝取量(未四捨五入)。每個 item 的營養值為每 100g,
 * 貢獻 = 值 × grams ÷ 100。grams 非有限正數的 item 會被忽略。
 * @param {Array<{calories, protein, fat, ca, p, grams}>} items
 */
export const computeIntake = (items = []) => {
  const sum = { calories: 0, protein: 0, fat: 0, ca: 0, p: 0, grams: 0 };
  items.forEach((item) => {
    if (!item || !isValidGrams(item.grams)) return;
    const factor = item.grams / 100;
    sum.calories += (item.calories ?? 0) * factor;
    sum.protein += (item.protein ?? 0) * factor;
    sum.fat += (item.fat ?? 0) * factor;
    sum.ca += (item.ca ?? 0) * factor;
    sum.p += (item.p ?? 0) * factor;
    sum.grams += item.grams;
  });
  return sum;
};

const round1 = (n) => Math.round(n * 10) / 10;

const roundTotals = (sum) => ({
  calories: Math.round(sum.calories),
  protein: round1(sum.protein),
  fat: round1(sum.fat),
  ca: Math.round(sum.ca),
  p: Math.round(sum.p),
  grams: round1(sum.grams),
});

/**
 * 完整餐點分析:總計(四捨五入)、巨集營養素、鈣磷比、補充品建議。
 * 巨集與鈣磷比皆以未四捨五入的累計值計算。
 */
export const analyzeMeal = (items = []) => {
  const sum = computeIntake(items);
  const analysis = analyzeCaPRatio(sum.ca, sum.p);
  return {
    totals: roundTotals(sum),
    macros: computeMacros(sum.protein, sum.fat, sum.calories),
    analysis,
    supplements: buildSupplements(analysis, sum.ca, sum.p),
  };
};

/**
 * 依目標熱量分配每個食材的克數,規則同 generateRecipe:
 * 有蛋白質食材時,70% 熱量平均分給蛋白質、30% 平均分給其餘;
 * 否則 100% 平均分給全部。recipeRole 'excluded' 或 calories ≤ 0
 * 的食材給 0 克,且不參與分配。回傳順序與輸入相同。
 * @returns {Array<{ food: object, grams: number }>}
 */
export const allocatePortionsForTarget = (foods = [], target = 0) => {
  if (!Array.isArray(foods) || foods.length === 0) return [];

  const roleOf = (f) =>
    f.recipeRole ?? (f.type === 'protein' ? 'protein' : 'plant');
  const isEligible = (f) =>
    roleOf(f) !== 'excluded' && Number.isFinite(f.calories) && f.calories > 0;

  const eligible = foods.filter(isEligible);
  const proteinCount = eligible.filter((f) => roleOf(f) === 'protein').length;
  const otherCount = eligible.length - proteinCount;
  const hasMeat = proteinCount > 0;

  const perProtein = hasMeat ? (target * MEAT_CALORIE_RATIO) / proteinCount : 0;
  const perOther =
    otherCount > 0
      ? (hasMeat ? target * (1 - MEAT_CALORIE_RATIO) : target) / otherCount
      : 0;

  return foods.map((food) => {
    if (!isEligible(food)) return { food, grams: 0 };
    const kcal = roleOf(food) === 'protein' ? perProtein : perOther;
    return { food, grams: Math.round((kcal / food.calories) * 100) };
  });
};

// === 每日達標狀態 ===
export const DAILY_STATUS_LABELS = {
  under: '不足',
  met: '達標',
  over: '超過',
};

/**
 * ratio = intake / der(der ≤ 0 時為 0)。
 * < 0.9 不足;0.9–1.1(含)達標;> 1.1 超過。
 */
export const dailyStatus = (intake, der) => {
  const ratio = der > 0 ? intake / der : 0;
  let status = 'met';
  if (ratio < 0.9) status = 'under';
  else if (ratio > 1.1) status = 'over';
  return { ratio, status };
};

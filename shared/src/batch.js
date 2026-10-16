/**
 * 批次分份計算(整鍋鮮食 → 依份數平分),前後端共用純函式。
 * 營養值皆為每 100g 生食基準;grams 為整鍋生重。
 */
import { DEFAULT_MEALS_PER_DAY } from './nutritionConstants.js';
import {
  allocatePortionsForTarget,
  analyzeMeal,
  computeIntake,
  dailyStatus,
} from './mealLog.js';

const round1 = (n) => Math.round(n * 10) / 10;

const toServings = (n) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : null);

/**
 * 依整鍋食材與單餐目標,算出建議份數、每份營養與補充品。
 * @param {object} args
 * @param {Array<{calories, protein, fat, ca, p, grams}>} args.items 每 100g 營養值 + 整鍋克數
 * @param {number|null} [args.servings] 指定份數(整數 ≥ 1);省略時用建議份數
 * @param {number} args.mealTarget 單餐目標 kcal(未四捨五入)
 * @param {number} [args.mealsPerDay] 每日餐數,預設 2
 */
export const planBatch = ({
  items = [],
  servings,
  mealTarget = 0,
  mealsPerDay = DEFAULT_MEALS_PER_DAY,
} = {}) => {
  const list = Array.isArray(items) ? items : [];
  const batch = analyzeMeal(list);
  const intake = computeIntake(list);

  const suggestedServings =
    intake.calories > 0 && mealTarget > 0
      ? Math.max(1, Math.round(intake.calories / mealTarget))
      : null;
  const n = toServings(servings) ?? suggestedServings ?? 1;

  const scaled = list.map((item) => ({
    ...item,
    grams: Number.isFinite(item?.grams) ? item.grams / n : item?.grams,
  }));
  const perServingKcal = intake.calories / n;

  const perDay =
    Number.isFinite(mealsPerDay) && mealsPerDay > 0
      ? mealsPerDay
      : DEFAULT_MEALS_PER_DAY;

  return {
    batch,
    suggestedServings,
    servings: n,
    perServing: {
      calories: Math.round(perServingKcal),
      grams: Math.round(intake.grams / n),
      items: scaled.map((item) => ({
        ...item,
        grams: Number.isFinite(item.grams) ? round1(item.grams) : item.grams,
      })),
      analysis: analyzeMeal(scaled),
    },
    status: dailyStatus(perServingKcal, mealTarget),
    daysCovered: round1(n / perDay),
  };
};

/**
 * 依份數 × 單餐目標,分配整鍋各食材的總克數(規則同 allocatePortionsForTarget)。
 * @returns {Array<{ food: object, grams: number }>}
 */
export const allocateBatchForServings = (
  foods = [],
  servings = 1,
  mealTarget = 0,
) =>
  allocatePortionsForTarget(
    foods,
    (Number(mealTarget) || 0) * (toServings(Number(servings)) ?? 1),
  );

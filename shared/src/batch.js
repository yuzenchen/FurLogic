/**
 * 批次分份計算(整鍋鮮食 → 依份數平分),前後端共用純函式。
 * 營養值皆為每 100g 生食基準;grams 為整鍋生重。
 *
 * 蔬菜(type 'veg')不計熱量:熱量、蛋白質、脂肪一律視為 0(鈣、磷與重量照算),
 * 份量改由「蔬菜占整鍋重量 %」決定。
 */
import {
  DEFAULT_MEALS_PER_DAY,
  MEAT_CALORIE_RATIO,
} from './nutritionConstants.js';
import { analyzeMeal, computeIntake, dailyStatus } from './mealLog.js';

export const DEFAULT_VEG_WEIGHT_PCT = 20;
export const MIN_VEG_WEIGHT_PCT = 0;
export const MAX_VEG_WEIGHT_PCT = 90;

const round1 = (n) => Math.round(n * 10) / 10;

const toServings = (n) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : null);

/** 是否為「不計熱量、依重量占比配量」的蔬菜 */
export const isVegetable = (food) => food?.type === 'veg';

/** 蔬菜占比正規化:非數字 → 預設 20;限制在 0–90 */
export const toVegWeightPct = (value) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (value === null || value === '' || !Number.isFinite(n)) {
    return DEFAULT_VEG_WEIGHT_PCT;
  }
  return Math.min(
    MAX_VEG_WEIGHT_PCT,
    Math.max(MIN_VEG_WEIGHT_PCT, Math.round(n)),
  );
};

/** 蔬菜的熱量 / 蛋白質 / 脂肪歸零(保留鈣、磷、克數),供所有營養計算使用 */
export const withoutVegetableEnergy = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) =>
    isVegetable(item) ? { ...item, calories: 0, protein: 0, fat: 0 } : item,
  );

/**
 * 依整鍋食材與單餐目標,算出建議份數、每份營養與補充品。
 * 蔬菜熱量不計(見 withoutVegetableEnergy)。
 * @param {object} args
 * @param {Array<{type, calories, protein, fat, ca, p, grams}>} args.items 每 100g 營養值 + 整鍋克數
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
  const list = withoutVegetableEnergy(items);
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

const validGrams = (g) => (Number.isFinite(g) && g > 0 ? g : 0);
const roleOf = (f) =>
  f.recipeRole ?? (f.type === 'protein' ? 'protein' : 'plant');

/** 能提供熱量的非蔬菜食材(非 excluded、calories > 0) */
const isEnergySource = (food) =>
  !isVegetable(food) &&
  roleOf(food) !== 'excluded' &&
  Number.isFinite(food.calories) &&
  food.calories > 0;

/** 是否至少有一項非蔬菜食材可以提供熱量(自動配量的前提) */
export const canAllocateBatch = (items = []) =>
  (Array.isArray(items) ? items : []).some((item) =>
    isEnergySource(item?.food ?? {}),
  );

/** 非蔬菜都還是 0 g 時的預設配比:蛋白質 70%、其餘 30%(只有一類時 100%) */
const fallbackEnergyGrams = (foods, target) => {
  const sources = foods.filter(isEnergySource);
  const proteins = sources.filter((f) => roleOf(f) === 'protein');
  const others = sources.length - proteins.length;
  const proteinShare =
    proteins.length === 0 ? 0 : others === 0 ? 1 : MEAT_CALORIE_RATIO;
  return foods.map((food) => {
    if (!isEnergySource(food)) return 0;
    const isProtein = roleOf(food) === 'protein';
    const kcal = isProtein
      ? (target * proteinShare) / proteins.length
      : (target * (1 - proteinShare)) / others;
    return (kcal / food.calories) * 100;
  });
};

/**
 * 依份數 × 單餐目標,重新配置整鍋各食材的總克數。
 * 1. 非蔬菜:照目前輸入的克數比例等比縮放,使熱量 = 份數 × 單餐目標;
 *    若都還是 0 g,改用蛋白質 70% / 其餘 30% 熱量的預設配比。
 *    excluded 或 calories ≤ 0 的非蔬菜給 0 g。
 * 2. 蔬菜(不計熱量):總重 = 非蔬菜總重 × pct ÷ (100 − pct),使蔬菜占整鍋重量 pct%;
 *    多種蔬菜照輸入克數比例分配,都是 0 g 時平分。
 * 沒有可提供熱量的非蔬菜食材時,克數原樣回傳。
 * @param {Array<{ food: object, grams: number }>} items 草稿食材
 * @returns {Array<{ food: object, grams: number }>} 順序與輸入相同,克數取整數
 */
export const allocateBatchForServings = (
  items = [],
  servings = 1,
  mealTarget = 0,
  vegWeightPct = DEFAULT_VEG_WEIGHT_PCT,
) => {
  const list = Array.isArray(items) ? items : [];
  if (!canAllocateBatch(list))
    return list.map(({ food, grams }) => ({ food, grams }));

  const foods = list.map((item) => item.food);
  const target =
    (Number(mealTarget) || 0) * (toServings(Number(servings)) ?? 1);

  const currentKcal = list.reduce(
    (sum, { food, grams }) =>
      isEnergySource(food)
        ? sum + (food.calories * validGrams(grams)) / 100
        : sum,
    0,
  );
  const energyGrams =
    currentKcal > 0
      ? list.map(({ food, grams }) =>
          isEnergySource(food) ? (validGrams(grams) * target) / currentKcal : 0,
        )
      : fallbackEnergyGrams(foods, target);

  const nonVegWeight = energyGrams.reduce((sum, g) => sum + g, 0);
  const pct = toVegWeightPct(vegWeightPct);
  const vegTotal = (nonVegWeight * pct) / (100 - pct);

  const vegIdx = list.flatMap((item, i) => (isVegetable(item.food) ? [i] : []));
  const vegInput = vegIdx.reduce(
    (sum, i) => sum + validGrams(list[i].grams),
    0,
  );

  return list.map(({ food, grams }, i) => {
    if (!isVegetable(food)) return { food, grams: Math.round(energyGrams[i]) };
    const share =
      vegInput > 0 ? validGrams(grams) / vegInput : 1 / vegIdx.length;
    return { food, grams: Math.round(vegTotal * share) };
  });
};

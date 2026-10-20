/**
 * 批次製作「缺口填補」計算(護腸鮮食熱量精算),前後端共用純函式。
 * 營養值皆為每 100g 生食基準;gramsPerMeal 為每餐生重。
 *
 * 每餐 = 固定班底(fixed)+ 替換肉類(variant)+ 主力瘦肉(main):
 *   Gap = 單餐目標 − Σ固定 − Σ替換;主力克數 = Gap ÷ (主力 kcal/100g ÷ 100),
 *   無條件進位到整數 g。採買總量 = 每餐克數 × 餐數。
 *
 * 蔬菜(type 'veg')不計熱量:熱量、蛋白質、脂肪一律視為 0(鈣、磷與重量照算)。
 * 每餐上限(蔬菜 50 g / 內臟 12 g / 高脂魚 65 g)超過只回傳警告,不強制修正。
 */
import { DEFAULT_MEALS_PER_DAY, MEAL_CAPS } from './nutritionConstants.js';
import { analyzeMeal, computeIntake, dailyStatus } from './mealLog.js';

/** 食材在缺口填補中的角色 */
export const ITEM_ROLES = ['fixed', 'variant', 'main'];
export const ITEM_ROLE_LABELS = {
  fixed: '固定班底',
  variant: '替換肉類',
  main: '主力瘦肉',
};

const round1 = (n) => Math.round(n * 10) / 10;

/** 餐數正規化:整數 ≥ 1,非法 → 1 */
const toMealsCount = (n) => {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
};

/** 克數正規化:非有限正數 → 0 */
const validGrams = (g) => (Number.isFinite(g) && g > 0 ? g : 0);

/** 是否為「不計熱量」的蔬菜 */
export const isVegetable = (food) => food?.type === 'veg';

/** 蔬菜的熱量 / 蛋白質 / 脂肪歸零(保留鈣、磷、克數),供所有營養計算使用 */
export const withoutVegetableEnergy = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) =>
    isVegetable(item) ? { ...item, calories: 0, protein: 0, fat: 0 } : item,
  );

/**
 * 食材所屬的每餐上限類別:蔬菜看 type,內臟 / 高脂魚看 subtype。
 * @returns {'veg'|'organ'|'fatty_fish'|null}
 */
export const capKindOf = (food) => {
  if (isVegetable(food)) return 'veg';
  const sub = food?.subtype;
  return sub === 'organ' || sub === 'fatty_fish' ? sub : null;
};

/** 加入批次時的預設每餐克數:有上限類別者給上限值,其餘 0 */
export const defaultGramsPerMeal = (food) =>
  MEAL_CAPS[capKindOf(food)]?.grams ?? 0;

/** 每餐熱量貢獻(未四捨五入);calories 非有限數視為 0 */
const kcalOf = (food, grams) =>
  ((Number.isFinite(food?.calories) ? food.calories : 0) * grams) / 100;

/**
 * 缺口填補:固定班底 + 替換肉類 → 缺口 → 主力瘦肉克數 → 採買總量。
 *
 * 取位原則(與舊 planBatch 一致):kcal 整數、g 一位小數、總重整數;
 * 主力克數為整數(無條件進位)。所有判定(缺口、達標)皆以未四捨五入的值計算。
 *
 * @param {object} args
 * @param {Array<object>} args.items
 *   `[{ ...food(每 100g 營養值, type, subtype, recipeRole), role, gramsPerMeal }]`
 *   role 為 'fixed' | 'variant' | 'main'(非法值視為 'fixed');
 *   'main' 最多一個,多的視為 'variant';主力的 gramsPerMeal 輸入值忽略,由缺口反推。
 * @param {number} args.mealTarget 單餐目標 kcal(未四捨五入);≤ 0 或非有限數 → 缺口視為 0
 * @param {number} [args.mealsCount] 製作餐數(整數 ≥ 1,非法 → 1)
 * @param {number} [args.mealsPerDay] 每日餐數,預設 2(算約可吃幾天)
 */
export const planGapFill = ({
  items = [],
  mealTarget = 0,
  mealsCount = 1,
  mealsPerDay = DEFAULT_MEALS_PER_DAY,
} = {}) => {
  const list = Array.isArray(items) ? items : [];
  const n = toMealsCount(mealsCount);
  const perDay =
    Number.isFinite(mealsPerDay) && mealsPerDay > 0
      ? mealsPerDay
      : DEFAULT_MEALS_PER_DAY;
  const hasTarget = Number.isFinite(mealTarget) && mealTarget > 0;
  const target = hasTarget ? mealTarget : 0;

  const warnings = [];
  if (!hasTarget) warnings.push({ kind: 'no_target' });

  // 1. 角色正規化:第一個 main 當主力,其餘 main 降為 variant
  let mainIdx = -1;
  let multipleMain = false;
  const normalized = list.map((item, i) => {
    const raw = item?.role;
    const role = ITEM_ROLES.includes(raw) ? raw : 'fixed';
    if (role !== 'main') return { ...item, role };
    if (mainIdx === -1) {
      mainIdx = i;
      return { ...item, role: 'main' };
    }
    multipleMain = true;
    return { ...item, role: 'variant' };
  });
  if (multipleMain) warnings.push({ kind: 'multiple_main' });

  // 2. 熱量計算用的版本:蔬菜熱量 / 蛋白質 / 脂肪歸零
  const energy = withoutVegetableEnergy(normalized);

  // 3. 固定 / 替換熱量(未四捨五入)與缺口
  const inputGrams = normalized.map((item, i) =>
    i === mainIdx ? 0 : round1(validGrams(item.gramsPerMeal)),
  );
  const sumKcal = (role) =>
    energy.reduce(
      (sum, food, i) =>
        food.role === role ? sum + kcalOf(food, inputGrams[i]) : sum,
      0,
    );
  const fixedKcalRaw = sumKcal('fixed');
  const variantKcalRaw = sumKcal('variant');
  const gapKcalRaw = target - fixedKcalRaw - variantKcalRaw;

  // 4. 主力瘦肉克數:Gap ÷ (kcal/100g ÷ 100),無條件進位到整數 g。
  //    先把商取到 1e-6 再 ceil,避免浮點誤差把剛好整數的結果多進一位。
  let mainGrams = 0;
  if (mainIdx === -1) {
    warnings.push({ kind: 'no_main' });
  } else {
    const mainFood = energy[mainIdx];
    const kcalPer100 = Number.isFinite(mainFood.calories)
      ? mainFood.calories
      : 0;
    if (kcalPer100 <= 0) {
      warnings.push({ kind: 'main_no_energy' });
    } else if (hasTarget && gapKcalRaw <= 0) {
      warnings.push({
        kind: 'over_target',
        excessKcal: Math.round(Math.abs(gapKcalRaw)), // abs 避免 -0
      });
    } else if (hasTarget) {
      const quotient = gapKcalRaw / (kcalPer100 / 100);
      mainGrams = Math.ceil(Math.round(quotient * 1e6) / 1e6);
    }
  }

  // 5. 每餐 / 整批食材(順序同輸入)
  const gramsPerMealOf = (i) => (i === mainIdx ? mainGrams : inputGrams[i]);
  const mealItems = energy.map((food, i) => ({
    ...food,
    grams: gramsPerMealOf(i),
  }));
  const batchItems = mealItems.map((food) => ({
    ...food,
    grams: food.grams * n,
  }));

  const outItems = normalized.map((item, i) => {
    const gramsPerMeal = gramsPerMealOf(i);
    return {
      ...item,
      gramsPerMeal,
      kcalPerMeal: Math.round(kcalOf(energy[i], gramsPerMeal)),
      batchGrams: round1(gramsPerMeal * n),
      isMain: i === mainIdx,
    };
  });

  const main =
    mainIdx === -1
      ? null
      : {
          id: normalized[mainIdx].id,
          name: normalized[mainIdx].name,
          gramsPerMeal: mainGrams,
          kcalPerMeal: Math.round(kcalOf(energy[mainIdx], mainGrams)),
        };

  // 6. 每餐上限:按類別彙總每餐克數(含反推後的主力),超過才警告
  const capTotals = {};
  mealItems.forEach((food) => {
    const kind = capKindOf(food);
    if (!kind) return;
    capTotals[kind] = (capTotals[kind] ?? 0) + food.grams;
  });
  const capWarnings = Object.keys(MEAL_CAPS).flatMap((kind) => {
    const grams = capTotals[kind] ?? 0;
    const { grams: cap, label } = MEAL_CAPS[kind];
    return grams > cap ? [{ kind, grams: round1(grams), cap, label }] : [];
  });

  // 7. 營養分析與達標
  const perMealIntake = computeIntake(mealItems);

  return {
    mealsCount: n,
    mealTarget,
    items: outItems,
    fixedKcal: Math.round(fixedKcalRaw),
    variantKcal: Math.round(variantKcalRaw),
    gapKcal: Math.round(gapKcalRaw),
    main,
    perMeal: analyzeMeal(mealItems),
    perMealGrams: Math.round(perMealIntake.grams),
    batch: analyzeMeal(batchItems),
    status: dailyStatus(perMealIntake.calories, mealTarget),
    daysCovered: round1(n / perDay),
    capWarnings,
    warnings,
  };
};

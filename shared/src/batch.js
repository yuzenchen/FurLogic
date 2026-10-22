/**
 * 「計算」頁比例計算(護腸鮮食熱量精算),前後端共用純函式。
 * 營養值皆為每 100g 生食基準;克數為生重。
 *
 * 使用者給每項食材「占每餐總重的百分比」(全部合計 100%),由單餐目標熱量反推:
 *   熱量密度 density = Σ (pct/100) × (kcal/100g ÷ 100)
 *   每餐總重 W = 單餐目標 ÷ density;每項每餐克數 = W × pct/100;共買 = 每餐 × 餐數。
 *
 * 蔬菜(type 'veg')不計熱量:熱量、蛋白質、脂肪一律視為 0(鈣、磷與重量照算);
 * 水果(type 'fruit')照計熱量。
 * 每餐上限(蔬菜 50 g / 內臟 12 g / 高脂魚 65 g)超過只回傳警告,不強制修正。
 */
import { DEFAULT_MEALS_PER_DAY, MEAL_CAPS } from './nutritionConstants.js';
import { analyzeMeal, computeIntake, dailyStatus } from './mealLog.js';

const round1 = (n) => Math.round(n * 10) / 10;

/** 餐數正規化:整數 ≥ 1,非法 → 1 */
const toMealsCount = (n) => {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
};

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

/** 每餐熱量貢獻(未四捨五入);calories 非有限數視為 0 */
const kcalOf = (food, grams) =>
  ((Number.isFinite(food?.calories) ? food.calories : 0) * grams) / 100;

/** 比例計算的食材類別(顯示順序) */
export const RATIO_CATEGORIES = ['protein', 'produce', 'starch', 'other'];
export const RATIO_CATEGORY_LABELS = {
  protein: '蛋白質',
  produce: '蔬果',
  starch: '澱粉',
  other: '其他',
};
/** 各類別預設占比(%);實際使用時依目前出現的類別等比正規化 */
export const DEFAULT_CATEGORY_PCT = {
  protein: 60,
  produce: 30,
  starch: 10,
  other: 0,
};

/** 食材所屬比例類別:protein → 蛋白質;veg / fruit → 蔬果;starch → 澱粉;其他 → 其他 */
export const ratioCategoryOf = (food) => {
  const type = food?.type;
  if (type === 'protein') return 'protein';
  if (type === 'veg' || type === 'fruit') return 'produce';
  if (type === 'starch') return 'starch';
  return 'other';
};

/**
 * 目前出現的類別的預設占比:取 DEFAULT_CATEGORY_PCT 後等比正規化到合計 100
 * (整數,無條件捨去後的餘數補到第一個類別);預設值合計為 0(例如只有 other)時,
 * 第一個類別給 100。回傳 key 依 RATIO_CATEGORIES 順序,非法類別忽略。
 * @param {string[]} categories
 * @returns {Record<string, number>}
 */
export const defaultCategoryPcts = (categories = []) => {
  const list = Array.isArray(categories) ? categories : [];
  const present = RATIO_CATEGORIES.filter((c) => list.includes(c));
  if (present.length === 0) return {};
  const sum = present.reduce((s, c) => s + DEFAULT_CATEGORY_PCT[c], 0);
  const out = {};
  if (sum <= 0) {
    present.forEach((c, i) => {
      out[c] = i === 0 ? 100 : 0;
    });
    return out;
  }
  present.forEach((c) => {
    out[c] = Math.floor((DEFAULT_CATEGORY_PCT[c] / sum) * 100);
  });
  const assigned = present.reduce((s, c) => s + out[c], 0);
  out[present[0]] += 100 - assigned;
  return out;
};

/**
 * 把 total 平均分成 n 份:每份一位小數、加總 = total
 * (以 0.1 為單位計算,餘數補到第一份)。n 非正整數 → []。
 */
export const splitEvenly = (total, n) => {
  const count = Number.isFinite(n) ? Math.floor(n) : 0;
  if (count <= 0) return [];
  const tenths = Math.round((Number.isFinite(total) ? total : 0) * 10);
  const base = Math.floor(tenths / count);
  const rem = tenths - base * count;
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? (base + rem) / 10 : base / 10,
  );
};

/** 比例正規化:非有限數或負數 → 0 */
const validPct = (p) => (Number.isFinite(p) && p > 0 ? p : 0);

/** 比例合計與 100 的容許誤差(%) */
const PCT_TOLERANCE = 0.05;

/**
 * 比例計算:依各食材占每餐總重的 %,由單餐目標熱量反推每餐總重與各項克數。
 *
 * 取位:每餐 / 共買克數一位小數、kcal 整數、每餐總重整數;判定以未四捨五入值計算。
 *
 * @param {object} args
 * @param {Array<object>} args.items `[{ ...food(每 100g 營養值, type, subtype), pct }]`
 * @param {number} args.mealTarget 單餐目標 kcal
 * @param {number} [args.mealsCount] 製作餐數(整數 ≥ 1,非法 → 1)
 * @param {number} [args.mealsPerDay] 每日餐數,預設 2(算約可吃幾天)
 * @returns {object} `{ ok, errors, mealsCount, mealTarget, totalGramsPerMeal, items,
 *   perMeal, batch, status, daysCovered, capWarnings }`;
 *   errors 的 kind:'total_not_100'(附 totalPct)| 'no_target' | 'no_energy'。
 *   ok 為 false 時 totalGramsPerMeal / items / perMeal / batch / status 為 null。
 */
export const planByRatio = ({
  items = [],
  mealTarget = 0,
  mealsCount = 1,
  mealsPerDay = DEFAULT_MEALS_PER_DAY,
} = {}) => {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  const n = toMealsCount(mealsCount);
  const perDay =
    Number.isFinite(mealsPerDay) && mealsPerDay > 0
      ? mealsPerDay
      : DEFAULT_MEALS_PER_DAY;
  const daysCovered = round1(n / perDay);

  const normalized = list.map((item) => ({ ...item, pct: validPct(item.pct) }));
  const energy = withoutVegetableEnergy(normalized);

  const totalPct = normalized.reduce((s, item) => s + item.pct, 0);
  const density = energy.reduce(
    (s, food) => s + (food.pct / 100) * (kcalOf(food, 100) / 100),
    0,
  );

  const errors = [];
  if (Math.abs(totalPct - 100) > PCT_TOLERANCE) {
    errors.push({ kind: 'total_not_100', totalPct: round1(totalPct) });
  }
  if (!(Number.isFinite(mealTarget) && mealTarget > 0)) {
    errors.push({ kind: 'no_target' });
  }
  if (!(density > 0)) errors.push({ kind: 'no_energy' });

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      mealsCount: n,
      mealTarget,
      totalGramsPerMeal: null,
      items: null,
      perMeal: null,
      batch: null,
      status: null,
      daysCovered,
      capWarnings: [],
    };
  }

  // 每餐總重(未四捨五入)
  const W = mealTarget / density;

  const outItems = normalized.map((item, i) => {
    const gramsPerMeal = round1((W * item.pct) / 100);
    return {
      ...item,
      gramsPerMeal,
      kcalPerMeal: Math.round(kcalOf(energy[i], gramsPerMeal)),
      batchGrams: round1(gramsPerMeal * n),
    };
  });

  const mealItems = energy.map((food, i) => ({
    ...food,
    grams: outItems[i].gramsPerMeal,
  }));
  const batchItems = energy.map((food, i) => ({
    ...food,
    grams: outItems[i].batchGrams,
  }));

  // 每餐上限:按類別彙總每餐克數,超過才警告
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

  const perMealIntake = computeIntake(mealItems);

  return {
    ok: true,
    errors: [],
    mealsCount: n,
    mealTarget,
    totalGramsPerMeal: Math.round(W),
    items: outItems,
    perMeal: analyzeMeal(mealItems),
    batch: analyzeMeal(batchItems),
    status: dailyStatus(perMealIntake.calories, mealTarget),
    daysCovered,
    capWarnings,
  };
};

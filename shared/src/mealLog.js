/**
 * 餐點紀錄相關的純函式(前後端共用,可單元測試)
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

// === 餐別 ===
export const MEAL_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心',
};

/**
 * 依當地時間推測預設餐別。
 * 04:00–10:59 早餐 / 11:00–14:59 午餐 / 15:00–20:59 晚餐 / 其餘 點心
 */
export const defaultMealLabel = (date = new Date()) => {
  const h = date.getHours();
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 15 && h < 21) return 'dinner';
  return 'snack';
};

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
 * 顯示/儲存用的四捨五入總計:
 * calories、ca、p 取整數;protein、fat、grams 取 1 位小數。
 */
export const computeMealTotals = (items = []) =>
  roundTotals(computeIntake(items));

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

// === 日期工具 ===
const pad2 = (n) => String(n).padStart(2, '0');

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_WITH_OFFSET_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

const isRealDate = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return (
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d
  );
};

/**
 * 轉成日期鍵 'YYYY-MM-DD'。
 * - Date:取「執行環境當地」的日曆日期
 * - 帶時區(Z / ±HH:MM)的 ISO 字串:取該時區下牆上時鐘的日期(即字串所寫的日期)
 * - 'YYYY-MM-DD':原樣回傳
 * 其他(含無時區的日期時間字串)一律拋錯。
 */
export const toDateKey = (input) => {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new Error('Invalid date');
    return `${input.getFullYear()}-${pad2(input.getMonth() + 1)}-${pad2(input.getDate())}`;
  }
  if (typeof input === 'string') {
    const m = DATE_KEY_RE.exec(input) || ISO_WITH_OFFSET_RE.exec(input);
    if (m) {
      const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const timeOk =
        m[4] === undefined ||
        (Number(m[4]) < 24 &&
          Number(m[5]) < 60 &&
          (m[6] === undefined || Number(m[6]) < 60));
      if (isRealDate(y, mo, d) && timeOk) return `${m[1]}-${m[2]}-${m[3]}`;
    }
  }
  throw new Error(`Invalid date input: ${String(input)}`);
};

/**
 * 'YYYY-MM-DDTHH:mm:ss+HH:MM',使用執行環境的當地時區偏移。
 */
export const toLocalIsoString = (date = new Date()) => {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  );
};

/**
 * 日期鍵加減天數(純 UTC 運算,不受 DST/時區影響)。
 */
export const addDays = (dateKey, n) => {
  const m = DATE_KEY_RE.exec(dateKey);
  if (!m) throw new Error(`Invalid date key: ${String(dateKey)}`);
  const t = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n),
  );
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
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

/**
 * 產生以 endDateKey 結尾、共 days 天的遞增序列,缺資料的日子補 0。
 * @param {Array<{dateKey: string, calories?: number, count?: number}>} rows
 * @returns {Array<{dateKey: string, calories: number, count: number}>}
 */
export const fillDailySeries = (rows = [], endDateKey, days) => {
  const byKey = new Map();
  rows.forEach((row) => {
    if (!row || !row.dateKey) return;
    const prev = byKey.get(row.dateKey) ?? { calories: 0, count: 0 };
    byKey.set(row.dateKey, {
      calories: prev.calories + (row.calories ?? 0),
      count: prev.count + (row.count ?? 0),
    });
  });

  const n = Math.max(0, Math.floor(days));
  const series = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const dateKey = addDays(endDateKey, -i);
    const hit = byKey.get(dateKey);
    series.push({
      dateKey,
      calories: hit ? hit.calories : 0,
      count: hit ? hit.count : 0,
    });
  }
  return series;
};

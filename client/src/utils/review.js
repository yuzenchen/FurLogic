/**
 * AI 復盤:把計算頁的 planByRatio 結果組成 POST /api/ai/review 的 body。
 * 後端對未知欄位回 400,所以這裡只輸出規格列出的欄位。
 */

export const MAX_ITEM_NAME_LENGTH = 40;
export const MAX_PET_NAME_LENGTH = 30;
export const DEFAULT_PET_NAME = '毛孩';

/** 數值缺漏 / 非有限值 / 負數 → 0(後端 schema 要求 ≥ 0) */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** 食材名:截 40 字;空字串後端會拒絕(minLength 1)→ 改成「未命名食材」 */
const toItemName = (name) =>
  String(name ?? '')
    .trim()
    .slice(0, MAX_ITEM_NAME_LENGTH) || '未命名食材';

/** 每日餐數:取整數並限制 1–4(非法值 → 2) */
const toMealsPerDay = (v) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 2;
  return Math.min(4, Math.max(1, n));
};

const toPetName = (name) => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed ? trimmed.slice(0, MAX_PET_NAME_LENGTH) : DEFAULT_PET_NAME;
};

/** analyzeCaPRatio 的 ratio 是字串('1.23')或 0(無法計算);無法計算 → null */
const toCaPRatio = (analysis) => {
  if (!analysis || analysis.status === 'unknown') return null;
  const n = Number(analysis.ratio);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * 組 AI 復盤的 payload(不含 computedAt)。result 必須是 ok 的 planByRatio 結果。
 * @param {{ pet: object|null, mealTarget: number, mealsCount: number, mealsPerDay: number, result: object }} input
 * @returns {object|null} result 非 ok 或單餐目標 ≤ 0 時回 null
 */
export const buildReviewPayload = ({
  pet,
  mealTarget,
  mealsCount,
  mealsPerDay,
  result,
}) => {
  if (!result?.ok) return null;
  const target = num(mealTarget);
  if (!(target > 0)) return null;
  const totals = result.perMeal?.totals ?? {};
  return {
    pet: { name: toPetName(pet?.name), weight: num(pet?.weight) },
    mealTarget: target,
    mealsCount: Math.min(60, Math.max(1, Math.round(num(mealsCount)))),
    mealsPerDay: toMealsPerDay(mealsPerDay),
    items: (result.items ?? []).map((i) => ({
      name: toItemName(i.name),
      type: i.type ?? null,
      subtype: i.subtype ?? null,
      calories: num(i.calories),
      protein: num(i.protein),
      fat: num(i.fat),
      ca: num(i.ca),
      p: num(i.p),
      pct: num(i.pct),
      gramsPerMeal: num(i.gramsPerMeal),
    })),
    appResult: {
      totalGramsPerMeal: num(result.totalGramsPerMeal),
      perMealKcal: num(totals.calories),
      protein: num(totals.protein),
      fat: num(totals.fat),
      ca: num(totals.ca),
      p: num(totals.p),
      caPRatio: toCaPRatio(result.perMeal?.analysis),
      capWarnings: (result.capWarnings ?? []).map(
        (w) => `${w.label}每餐建議 ≤ ${w.cap} g,目前 ${w.grams} g`,
      ),
    },
  };
};

/** 最近一次計算(含 computedAt)→ API body:拿掉 computedAt(後端未知欄位回 400) */
export const toReviewBody = (lastCalc) => {
  // eslint-disable-next-line no-unused-vars
  const { computedAt, ...body } = lastCalc;
  return body;
};

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CATEGORY_PCT,
  RATIO_CATEGORIES,
  RATIO_CATEGORY_LABELS,
  capKindOf,
  defaultCategoryPcts,
  isVegetable,
  planByRatio,
  ratioCategoryOf,
  splitEvenly,
  withoutVegetableEnergy,
} from './batch.js';
import { MEAL_CAPS } from './nutritionConstants.js';

// 測試用食材(每 100 g),不依賴 foodDatabase.js
const food = (id, name, type, calories, extra = {}) => ({
  id,
  name,
  type,
  calories,
  protein: 0,
  fat: 0,
  ca: 0,
  p: 0,
  subtype: null,
  ...extra,
});
const chicken = food(1, '雞胸', 'protein', 110, {
  protein: 23,
  fat: 1.5,
  ca: 5,
  p: 200,
});
const duck = food(2, '鴨柳', 'protein', 110, {
  protein: 22,
  fat: 2,
  ca: 5,
  p: 200,
});
const pumpkin = food(3, '南瓜', 'veg', 30, { protein: 1, ca: 20, p: 40 });
const melon = food(4, '冬瓜', 'veg', 12, { ca: 15, p: 20 });
const rice = food(5, '白飯', 'starch', 130, { protein: 2.5, p: 40 });
const barley = food(6, '薏仁', 'starch', 117, { protein: 2.5, p: 60 });
const apple = food(7, '蘋果', 'fruit', 52, { ca: 6, p: 11 });
const organ = food(8, '雞肝', 'protein', 120, { subtype: 'organ', p: 300 });
const mackerel = food(9, '鯖魚', 'protein', 205, {
  subtype: 'fatty_fish',
  ca: 12,
  p: 230,
});

const withPct = (f, pct) => ({ ...f, pct });

/** 使用者手稿:蛋白質 60(雞胸 40 / 鴨柳 20)、蔬果 30(南瓜 10 / 冬瓜 20)、澱粉 10(白飯 5 / 薏仁 5) */
const sketch = [
  withPct(chicken, 40),
  withPct(duck, 20),
  withPct(pumpkin, 10),
  withPct(melon, 20),
  withPct(rice, 5),
  withPct(barley, 5),
];

describe('planByRatio – 使用者手稿', () => {
  it('density 0.7835 → 目標 450 每餐 574 g,各項依 % 分重量', () => {
    const r = planByRatio({ items: sketch, mealTarget: 450, mealsCount: 6 });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    // W = 450 / (0.4×1.1 + 0.2×1.1 + 0 + 0 + 0.05×1.3 + 0.05×1.17) = 574.35
    expect(r.totalGramsPerMeal).toBe(574);
    expect(r.items.map((i) => i.gramsPerMeal)).toEqual([
      229.7, 114.9, 57.4, 114.9, 28.7, 28.7,
    ]);
    expect(r.items.map((i) => i.kcalPerMeal)).toEqual([253, 126, 0, 0, 37, 34]);
    expect(r.items[0].batchGrams).toBe(1378.2);
    expect(r.items[0].pct).toBe(40);
    expect(r.items.map((i) => i.name)).toEqual(sketch.map((i) => i.name));
    // Σ 熱量 ≈ 目標
    expect(Math.abs(r.perMeal.totals.calories - 450)).toBeLessThanOrEqual(1);
    expect(r.status.status).toBe('met');
    expect(r.mealsCount).toBe(6);
    expect(r.mealTarget).toBe(450);
    expect(r.daysCovered).toBe(3);
    // 共買 ≈ 每餐 × 6
    expect(r.batch.totals.grams).toBeCloseTo(r.perMeal.totals.grams * 6, 0);
  });

  it('蔬菜不計熱量但重量照分;蔬菜合計超過 50 g → capWarnings', () => {
    const r = planByRatio({ items: sketch, mealTarget: 450 });
    expect(r.items[2].kcalPerMeal).toBe(0);
    expect(r.items[2].gramsPerMeal).toBeGreaterThan(0);
    expect(r.capWarnings).toEqual([
      { kind: 'veg', grams: 172.3, cap: MEAL_CAPS.veg.grams, label: '蔬菜' },
    ]);
  });
});

describe('planByRatio – 錯誤', () => {
  it('合計 ≠ 100 → total_not_100', () => {
    const r = planByRatio({
      items: [withPct(chicken, 60), withPct(rice, 30)],
      mealTarget: 400,
    });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([{ kind: 'total_not_100', totalPct: 90 }]);
    expect(r.items).toBeNull();
    expect(r.totalGramsPerMeal).toBeNull();
  });

  it('合計誤差 ≤ 0.05 視為 100', () => {
    const r = planByRatio({
      items: [
        withPct(chicken, 33.3),
        withPct(duck, 33.3),
        withPct(rice, 33.43),
      ],
      mealTarget: 400,
    });
    expect(r.ok).toBe(true);
  });

  it('無目標(0 / 負 / NaN)→ no_target', () => {
    [0, -10, NaN, undefined].forEach((mealTarget) => {
      const r = planByRatio({ items: [withPct(chicken, 100)], mealTarget });
      expect(r.ok).toBe(false);
      expect(r.errors).toEqual([{ kind: 'no_target' }]);
    });
  });

  it('全蔬菜 → no_energy', () => {
    const r = planByRatio({
      items: [withPct(pumpkin, 50), withPct(melon, 50)],
      mealTarget: 300,
    });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([{ kind: 'no_energy' }]);
  });

  it('沒有食材 → total_not_100 + no_energy', () => {
    const r = planByRatio({ items: [], mealTarget: 300 });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.kind)).toEqual(['total_not_100', 'no_energy']);
    expect(planByRatio().ok).toBe(false);
  });
});

describe('planByRatio – 其他規則', () => {
  it('水果照計熱量', () => {
    const r = planByRatio({
      items: [withPct(chicken, 80), withPct(apple, 20)],
      mealTarget: 300,
    });
    expect(r.ok).toBe(true);
    // density = 0.8×1.1 + 0.2×0.52 = 0.984 → W = 304.9
    expect(r.totalGramsPerMeal).toBe(305);
    expect(r.items[1].gramsPerMeal).toBe(61);
    expect(r.items[1].kcalPerMeal).toBe(32);
  });

  it('內臟 / 高脂魚超過上限才警告', () => {
    const r = planByRatio({
      items: [withPct(chicken, 84), withPct(organ, 6), withPct(mackerel, 10)],
      mealTarget: 450,
    });
    // density = 0.924 + 0.072 + 0.205 = 1.201 → W = 374.7;內臟 22.5 g、鯖魚 37.5 g
    expect(r.capWarnings).toEqual([
      { kind: 'organ', grams: 22.5, cap: 12, label: '內臟' },
    ]);
  });

  it('mealsCount 非法 → 1;小數無條件捨去;pct 負值視為 0', () => {
    const items = [withPct(chicken, 100), withPct(rice, -5)];
    expect(
      planByRatio({ items, mealTarget: 110, mealsCount: 0 }).mealsCount,
    ).toBe(1);
    const r = planByRatio({ items, mealTarget: 110, mealsCount: 4.9 });
    expect(r.mealsCount).toBe(4);
    expect(r.items[0].gramsPerMeal).toBe(100);
    expect(r.items[0].batchGrams).toBe(400);
    expect(r.items[1].pct).toBe(0);
    expect(r.items[1].gramsPerMeal).toBe(0);
  });
});

describe('ratioCategoryOf / defaultCategoryPcts / splitEvenly', () => {
  it('ratioCategoryOf', () => {
    expect(ratioCategoryOf(chicken)).toBe('protein');
    expect(ratioCategoryOf(organ)).toBe('protein');
    expect(ratioCategoryOf(pumpkin)).toBe('produce');
    expect(ratioCategoryOf(apple)).toBe('produce');
    expect(ratioCategoryOf(rice)).toBe('starch');
    expect(ratioCategoryOf({ type: 'snack' })).toBe('other');
    expect(ratioCategoryOf(null)).toBe('other');
  });

  it('常數', () => {
    expect(RATIO_CATEGORIES).toEqual(['protein', 'produce', 'starch', 'other']);
    expect(Object.keys(RATIO_CATEGORY_LABELS)).toEqual(RATIO_CATEGORIES);
    expect(DEFAULT_CATEGORY_PCT).toEqual({
      protein: 60,
      produce: 30,
      starch: 10,
      other: 0,
    });
  });

  it('defaultCategoryPcts', () => {
    expect(defaultCategoryPcts(['starch', 'protein', 'produce'])).toEqual({
      protein: 60,
      produce: 30,
      starch: 10,
    });
    expect(defaultCategoryPcts(['protein', 'starch'])).toEqual({
      protein: 86,
      starch: 14,
    });
    expect(defaultCategoryPcts(['produce'])).toEqual({ produce: 100 });
    expect(defaultCategoryPcts(['other'])).toEqual({ other: 100 });
    expect(defaultCategoryPcts(['protein', 'other'])).toEqual({
      protein: 100,
      other: 0,
    });
    expect(defaultCategoryPcts([])).toEqual({});
    expect(defaultCategoryPcts(null)).toEqual({});
  });

  it('splitEvenly', () => {
    expect(splitEvenly(60, 3)).toEqual([20, 20, 20]);
    const ten = splitEvenly(10, 3);
    expect(ten).toEqual([3.4, 3.3, 3.3]);
    expect(Math.round(ten.reduce((a, b) => a + b, 0) * 10) / 10).toBe(10);
    expect(splitEvenly(30, 2)).toEqual([15, 15]);
    expect(splitEvenly(5, 1)).toEqual([5]);
    expect(splitEvenly(10, 0)).toEqual([]);
  });
});

describe('蔬菜工具與上限類別', () => {
  it('capKindOf:蔬菜看 type,其餘看 subtype', () => {
    expect(capKindOf(pumpkin)).toBe('veg');
    expect(capKindOf(organ)).toBe('organ');
    expect(capKindOf(mackerel)).toBe('fatty_fish');
    expect(capKindOf(chicken)).toBeNull();
    expect(capKindOf(apple)).toBeNull();
    expect(capKindOf(null)).toBeNull();
    expect(capKindOf({ type: 'veg', subtype: 'organ' })).toBe('veg');
  });

  it('isVegetable / withoutVegetableEnergy(水果不歸零)', () => {
    expect(isVegetable(pumpkin)).toBe(true);
    expect(isVegetable(apple)).toBe(false);
    expect(isVegetable(null)).toBe(false);
    const [veg, meat, fruit] = withoutVegetableEnergy([
      pumpkin,
      chicken,
      apple,
    ]);
    expect(veg).toMatchObject({ calories: 0, protein: 0, fat: 0, ca: 20 });
    expect(meat).toBe(chicken);
    expect(fruit).toBe(apple);
    expect(withoutVegetableEnergy(null)).toEqual([]);
  });
});

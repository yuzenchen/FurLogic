import { describe, it, expect } from 'vitest';
import {
  ITEM_ROLES,
  ITEM_ROLE_LABELS,
  capKindOf,
  defaultGramsPerMeal,
  isVegetable,
  planGapFill,
  withoutVegetableEnergy,
} from './batch.js';
import { MEAL_CAPS } from './nutritionConstants.js';

// 測試用食材(每 100 g;係數 × 100),不依賴 foodDatabase.js
const food = (id, name, type, calories, extra = {}) => ({
  id,
  name,
  type,
  recipeRole: type === 'protein' ? 'protein' : 'plant',
  calories,
  protein: 0,
  fat: 0,
  ca: 0,
  p: 0,
  subtype: null,
  ...extra,
});
const rice = food(101, '熟白飯', 'starch', 130, { protein: 2.5, p: 40 });
const barley = food(102, '熟薏仁泥', 'starch', 117, { protein: 2.5, p: 60 });
const cucumber = food(103, '大黃瓜', 'veg', 14, { ca: 16, p: 24 });
const celery = food(104, '西洋芹', 'veg', 14, { ca: 40, p: 24 });
const duckOrgan = food(105, '綜合鴨內臟', 'protein', 150, {
  subtype: 'organ',
  protein: 18,
  fat: 8,
  p: 250,
});
const mackerel = food(106, '鯖魚', 'protein', 205, {
  subtype: 'fatty_fish',
  protein: 19,
  fat: 14,
  ca: 12,
  p: 230,
});
const porkLoin = food(107, '豬小里肌', 'protein', 110, {
  protein: 21,
  fat: 2,
  ca: 5,
  p: 200,
});
const duckBreast = food(108, '鴨柳條', 'protein', 110, {
  protein: 22,
  fat: 2,
  ca: 5,
  p: 200,
});
// 非蔬菜的小配料:10 g × 68 kcal/100g = 6.8 kcal,用來把固定班底湊成 186 kcal
const filler = food(109, '補熱量配料', 'starch', 68);

const item = (f, role, gramsPerMeal) => ({ ...f, role, gramsPerMeal });

const eggshellGrams = (supplements) => {
  const s = supplements.find((x) => x.name === '蛋殼粉');
  return s ? parseFloat(s.amount) : null;
};
const kinds = (list) => list.map((w) => w.kind);

/** 使用者範例:固定 179(蔬菜 0 kcal)+ 替換 137,目標 450 */
const exampleItems = [
  item(rice, 'fixed', 70), // 91
  item(barley, 'fixed', 60), // 70.2
  item(cucumber, 'fixed', 50), // 0(蔬菜不計)
  item(duckOrgan, 'fixed', 12), // 18
  item(mackerel, 'variant', 40), // 82
  item(porkLoin, 'variant', 50), // 55
  item(duckBreast, 'main', 999), // 輸入值忽略
];

describe('planGapFill – 使用者範例', () => {
  it('固定 179 + 替換 137,缺口 134 → 鴨柳 121.8 進位 122 g', () => {
    const r = planGapFill({ items: exampleItems, mealTarget: 450 });
    expect(r.fixedKcal).toBe(179);
    expect(r.variantKcal).toBe(137);
    expect(r.gapKcal).toBe(134);
    expect(r.main).toEqual({
      id: 108,
      name: '鴨柳條',
      gramsPerMeal: 122,
      kcalPerMeal: 134,
    });
    const mainItem = r.items[6];
    expect(mainItem.isMain).toBe(true);
    expect(mainItem.gramsPerMeal).toBe(122);
    expect(mainItem.role).toBe('main');
    expect(r.items.filter((i) => i.isMain)).toHaveLength(1);
    expect(r.warnings).toEqual([]);
    expect(r.capWarnings).toEqual([]);
    expect(r.mealsCount).toBe(1);
    expect(r.mealTarget).toBe(450);
    // 每餐總重 70+60+50+12+40+50+122 = 404
    expect(r.perMealGrams).toBe(404);
    // 補到 ≥ 目標,且在 ±10% 內
    expect(r.perMeal.totals.calories).toBeGreaterThanOrEqual(450);
    expect(r.status.status).toBe('met');
    expect(r.daysCovered).toBe(0.5);
  });

  it('固定 186(不放蔬菜、改放 6.8 kcal 配料)→ 缺口 127 → 115.45 進位 116 g', () => {
    const items = [
      item(rice, 'fixed', 70), // 91
      item(barley, 'fixed', 60), // 70.2
      item(duckOrgan, 'fixed', 12), // 18
      item(filler, 'fixed', 10), // 6.8 → 合計 186
      item(mackerel, 'variant', 40), // 82
      item(porkLoin, 'variant', 50), // 55
      item(duckBreast, 'main', 0),
    ];
    const r = planGapFill({ items, mealTarget: 450 });
    expect(r.fixedKcal).toBe(186);
    expect(r.variantKcal).toBe(137);
    expect(r.gapKcal).toBe(127);
    expect(r.main.gramsPerMeal).toBe(116);
  });

  it('每餐 kcal 與順序:items 順序同輸入,蔬菜 kcalPerMeal 為 0', () => {
    const r = planGapFill({ items: exampleItems, mealTarget: 450 });
    expect(r.items.map((i) => i.name)).toEqual(exampleItems.map((i) => i.name));
    expect(r.items.map((i) => i.kcalPerMeal)).toEqual([
      91, 70, 0, 18, 82, 55, 134,
    ]);
    expect(r.items.map((i) => i.role)).toEqual([
      'fixed',
      'fixed',
      'fixed',
      'fixed',
      'variant',
      'variant',
      'main',
    ]);
  });
});

describe('planGapFill – 主力與目標的邊界', () => {
  it('無主力 → main null,warnings no_main,其餘照算', () => {
    const r = planGapFill({
      items: [item(rice, 'fixed', 70), item(mackerel, 'variant', 40)],
      mealTarget: 450,
    });
    expect(r.main).toBeNull();
    expect(kinds(r.warnings)).toEqual(['no_main']);
    expect(r.fixedKcal).toBe(91);
    expect(r.variantKcal).toBe(82);
    expect(r.gapKcal).toBe(277);
    expect(r.items.every((i) => !i.isMain)).toBe(true);
  });

  it('多個主力 → 只有第一個當主力,其餘視為替換 + multiple_main', () => {
    const r = planGapFill({
      items: [
        item(rice, 'fixed', 100), // 130
        item(duckBreast, 'main', 0),
        item(porkLoin, 'main', 50), // 降為 variant:55
      ],
      mealTarget: 450,
    });
    expect(kinds(r.warnings)).toEqual(['multiple_main']);
    expect(r.main.name).toBe('鴨柳條');
    expect(r.items[2].role).toBe('variant');
    expect(r.items[2].isMain).toBe(false);
    expect(r.variantKcal).toBe(55);
    // (450 − 130 − 55) / 1.1 = 240.9 → 241
    expect(r.main.gramsPerMeal).toBe(241);
  });

  it('主力為蔬菜 → 0 g + main_no_energy', () => {
    const r = planGapFill({
      items: [item(rice, 'fixed', 70), item(cucumber, 'main', 0)],
      mealTarget: 450,
    });
    expect(r.main.gramsPerMeal).toBe(0);
    expect(r.main.kcalPerMeal).toBe(0);
    expect(kinds(r.warnings)).toEqual(['main_no_energy']);
  });

  it('主力 0 kcal → 0 g + main_no_energy', () => {
    const zero = food(110, '零熱量', 'starch', 0);
    const r = planGapFill({
      items: [item(zero, 'main', 0)],
      mealTarget: 450,
    });
    expect(r.main.gramsPerMeal).toBe(0);
    expect(kinds(r.warnings)).toEqual(['main_no_energy']);
  });

  it('固定 + 替換已超過目標(gap ≤ 0)→ 主力 0 g + over_target', () => {
    const r = planGapFill({
      items: [
        item(rice, 'fixed', 200), // 260
        item(mackerel, 'variant', 100), // 205
        item(duckBreast, 'main', 0),
      ],
      mealTarget: 450,
    });
    expect(r.gapKcal).toBe(-15);
    expect(r.main.gramsPerMeal).toBe(0);
    expect(r.warnings).toEqual([{ kind: 'over_target', excessKcal: 15 }]);
    expect(r.status.status).toBe('met');
  });

  it('缺口剛好為 0 也算 over_target(excess 0)', () => {
    const r = planGapFill({
      items: [item(rice, 'fixed', 100), item(duckBreast, 'main', 0)], // 130
      mealTarget: 130,
    });
    expect(r.gapKcal).toBe(0);
    expect(r.main.gramsPerMeal).toBe(0);
    expect(r.warnings).toEqual([{ kind: 'over_target', excessKcal: 0 }]);
  });

  it('無目標(0 / 負 / NaN)→ 缺口 0、主力 0 g + no_target', () => {
    const items = [item(rice, 'fixed', 70), item(duckBreast, 'main', 0)];
    for (const mealTarget of [0, -10, NaN, undefined]) {
      const r = planGapFill({ items, mealTarget });
      expect(r.gapKcal).toBe(-91);
      expect(r.main.gramsPerMeal).toBe(0);
      expect(kinds(r.warnings)).toEqual(['no_target']);
      expect(r.status.ratio).toBe(0);
    }
  });

  it('沒有食材 → 空結果 + no_main', () => {
    const r = planGapFill({ items: [], mealTarget: 450 });
    expect(r.items).toEqual([]);
    expect(r.main).toBeNull();
    expect(r.fixedKcal).toBe(0);
    expect(r.gapKcal).toBe(450);
    expect(kinds(r.warnings)).toEqual(['no_main']);
    expect(r.perMeal.totals.calories).toBe(0);
    expect(r.perMealGrams).toBe(0);
    expect(r.status.status).toBe('under');
  });

  it('非法 role 視為 fixed;非法克數視為 0 並取一位小數', () => {
    const r = planGapFill({
      items: [
        { ...rice, role: 'bogus', gramsPerMeal: 70.26 },
        { ...barley, role: 'fixed', gramsPerMeal: -5 },
        { ...porkLoin, role: 'variant', gramsPerMeal: NaN },
      ],
      mealTarget: 450,
    });
    expect(r.items[0].role).toBe('fixed');
    expect(r.items[0].gramsPerMeal).toBe(70.3);
    expect(r.items[1].gramsPerMeal).toBe(0);
    expect(r.items[2].gramsPerMeal).toBe(0);
    expect(r.fixedKcal).toBe(91);
  });
});

describe('planGapFill – 每餐上限警告', () => {
  const base = [item(rice, 'fixed', 70), item(duckBreast, 'main', 0)];

  it('蔬菜合計 80 g → 警告(多種蔬菜彙總)', () => {
    const r = planGapFill({
      items: [...base, item(cucumber, 'fixed', 50), item(celery, 'fixed', 30)],
      mealTarget: 450,
    });
    expect(r.capWarnings).toEqual([
      { kind: 'veg', grams: 80, cap: 50, label: '蔬菜' },
    ]);
  });

  it('蔬菜 50 g → 不警告', () => {
    const r = planGapFill({
      items: [...base, item(cucumber, 'fixed', 50)],
      mealTarget: 450,
    });
    expect(r.capWarnings).toEqual([]);
  });

  it('內臟 12 g 不警告、13 g 警告', () => {
    const ok = planGapFill({
      items: [...base, item(duckOrgan, 'fixed', 12)],
      mealTarget: 450,
    });
    expect(ok.capWarnings).toEqual([]);
    const over = planGapFill({
      items: [...base, item(duckOrgan, 'fixed', 13)],
      mealTarget: 450,
    });
    expect(over.capWarnings).toEqual([
      { kind: 'organ', grams: 13, cap: 12, label: '內臟' },
    ]);
  });

  it('鯖魚 65 g 不警告、66 g 警告', () => {
    const ok = planGapFill({
      items: [...base, item(mackerel, 'variant', 65)],
      mealTarget: 450,
    });
    expect(ok.capWarnings).toEqual([]);
    const over = planGapFill({
      items: [...base, item(mackerel, 'variant', 66)],
      mealTarget: 450,
    });
    expect(over.capWarnings).toEqual([
      { kind: 'fatty_fish', grams: 66, cap: 65, label: '高脂魚' },
    ]);
  });

  it('主力若屬上限類別,反推後的克數也納入檢查', () => {
    // 缺口 450 − 91 = 359 → 鯖魚 359 / 2.05 = 175.1 → 176 g > 65
    const r = planGapFill({
      items: [item(rice, 'fixed', 70), item(mackerel, 'main', 0)],
      mealTarget: 450,
    });
    expect(r.main.gramsPerMeal).toBe(176);
    expect(r.capWarnings).toEqual([
      { kind: 'fatty_fish', grams: 176, cap: 65, label: '高脂魚' },
    ]);
  });
});

describe('planGapFill – 餐數與採買總量', () => {
  it('mealsCount 非法 → 1;小數無條件捨去', () => {
    const items = [item(rice, 'fixed', 70), item(duckBreast, 'main', 0)];
    for (const mealsCount of [0, -3, NaN, null, undefined, 'abc']) {
      expect(
        planGapFill({ items, mealTarget: 450, mealsCount }).mealsCount,
      ).toBe(1);
    }
    expect(
      planGapFill({ items, mealTarget: 450, mealsCount: 6.9 }).mealsCount,
    ).toBe(6);
    expect(
      planGapFill({ items, mealTarget: 450, mealsCount: '8' }).mealsCount,
    ).toBe(8);
  });

  it('採買總量 = 每餐克數 × 餐數,主力不因餐數改變', () => {
    const one = planGapFill({ items: exampleItems, mealTarget: 450 });
    const r = planGapFill({
      items: exampleItems,
      mealTarget: 450,
      mealsCount: 14,
    });
    expect(r.main.gramsPerMeal).toBe(one.main.gramsPerMeal);
    r.items.forEach((i, idx) => {
      expect(i.gramsPerMeal).toBe(one.items[idx].gramsPerMeal);
      expect(i.batchGrams).toBeCloseTo(i.gramsPerMeal * 14, 6);
    });
    expect(r.items[6].batchGrams).toBe(122 * 14);
    expect(r.batch.totals.grams).toBeCloseTo(one.perMealGrams * 14, 6);
    // 每餐未四捨五入 91 + 70.2 + 0 + 18 + 82 + 55 + 134.2 = 450.4 → × 14 = 6305.6
    expect(one.perMeal.totals.calories).toBe(450);
    expect(r.batch.totals.calories).toBe(6306);
    expect(r.perMeal.totals.calories).toBe(one.perMeal.totals.calories);
  });

  it('daysCovered = 餐數 ÷ 每日餐數(一位小數),預設每日 2 餐', () => {
    const items = [item(duckBreast, 'main', 0)];
    expect(
      planGapFill({ items, mealTarget: 450, mealsCount: 14 }).daysCovered,
    ).toBe(7);
    expect(
      planGapFill({ items, mealTarget: 450, mealsCount: 5, mealsPerDay: 3 })
        .daysCovered,
    ).toBe(1.7);
    expect(
      planGapFill({ items, mealTarget: 450, mealsCount: 3, mealsPerDay: 0 })
        .daysCovered,
    ).toBe(1.5);
  });

  it('蛋殼粉補充品整批 ≈ 每餐 × 餐數,鈣磷比相同', () => {
    const r = planGapFill({
      items: exampleItems,
      mealTarget: 450,
      mealsCount: 10,
    });
    expect(r.perMeal.analysis.status).toBe('low');
    const perMealEgg = eggshellGrams(r.perMeal.supplements);
    const batchEgg = eggshellGrams(r.batch.supplements);
    expect(perMealEgg).toBeGreaterThan(0);
    expect(batchEgg).toBeCloseTo(perMealEgg * 10, 0);
    expect(r.batch.analysis.ratio).toBe(r.perMeal.analysis.ratio);
  });

  it('蔬菜在營養分析中不計熱量 / 蛋白質 / 脂肪,鈣磷與重量照算', () => {
    const r = planGapFill({
      items: [item(cucumber, 'fixed', 50)],
      mealTarget: 450,
    });
    expect(r.perMeal.totals.calories).toBe(0);
    expect(r.perMeal.totals.protein).toBe(0);
    expect(r.perMeal.totals.fat).toBe(0);
    expect(r.perMeal.totals.ca).toBe(8);
    expect(r.perMeal.totals.p).toBe(12);
    expect(r.perMeal.totals.grams).toBe(50);
    // 回傳的 item 仍保留原始食材資料(calories 不被改寫)
    expect(r.items[0].calories).toBe(14);
  });
});

describe('capKindOf / defaultGramsPerMeal', () => {
  it('capKindOf:蔬菜看 type,其餘看 subtype', () => {
    expect(capKindOf(cucumber)).toBe('veg');
    expect(capKindOf(duckOrgan)).toBe('organ');
    expect(capKindOf(mackerel)).toBe('fatty_fish');
    expect(capKindOf(porkLoin)).toBeNull();
    expect(capKindOf(rice)).toBeNull();
    expect(capKindOf({ type: 'protein', subtype: 'weird' })).toBeNull();
    expect(capKindOf({ type: 'protein' })).toBeNull();
    expect(capKindOf(null)).toBeNull();
    expect(capKindOf(undefined)).toBeNull();
    // 蔬菜即使帶 subtype 也歸類為蔬菜
    expect(capKindOf({ type: 'veg', subtype: 'organ' })).toBe('veg');
  });

  it('defaultGramsPerMeal:veg 50、organ 12、fatty_fish 65、其他 0', () => {
    expect(defaultGramsPerMeal(cucumber)).toBe(50);
    expect(defaultGramsPerMeal(duckOrgan)).toBe(12);
    expect(defaultGramsPerMeal(mackerel)).toBe(65);
    expect(defaultGramsPerMeal(porkLoin)).toBe(0);
    expect(defaultGramsPerMeal(rice)).toBe(0);
    expect(defaultGramsPerMeal(undefined)).toBe(0);
    expect(defaultGramsPerMeal(cucumber)).toBe(MEAL_CAPS.veg.grams);
  });
});

describe('角色常數與蔬菜工具', () => {
  it('ITEM_ROLES / ITEM_ROLE_LABELS', () => {
    expect(ITEM_ROLES).toEqual(['fixed', 'variant', 'main']);
    expect(Object.keys(ITEM_ROLE_LABELS)).toEqual(ITEM_ROLES);
    expect(ITEM_ROLE_LABELS.main).toBe('主力瘦肉');
  });

  it('isVegetable / withoutVegetableEnergy', () => {
    expect(isVegetable(cucumber)).toBe(true);
    expect(isVegetable(rice)).toBe(false);
    expect(isVegetable(null)).toBe(false);
    const [veg, meat] = withoutVegetableEnergy([
      { ...cucumber, protein: 3, fat: 1 },
      porkLoin,
    ]);
    expect(veg).toMatchObject({ calories: 0, protein: 0, fat: 0, ca: 16 });
    expect(meat).toBe(porkLoin);
    expect(withoutVegetableEnergy(null)).toEqual([]);
  });
});

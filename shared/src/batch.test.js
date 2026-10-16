import { describe, it, expect } from 'vitest';
import {
  allocateBatchForServings,
  canAllocateBatch,
  planBatch,
  toVegWeightPct,
} from './batch.js';
import { getFoodById } from './foodDatabase.js';

const asItem = (food, grams) => ({ ...food, grams });
const chicken = getFoodById(1);
const pumpkin = getFoodById(3);
const carrot = getFoodById(4);
const sweetPotato = getFoodById(5);
const eggshellGrams = (supplements) => {
  const s = supplements.find((x) => x.name === '蛋殼粉');
  return s ? parseFloat(s.amount) : null;
};

describe('planBatch', () => {
  const items = [asItem(chicken, 1000), asItem(pumpkin, 500)];

  it('雞胸肉 1000 g + 南瓜 500 g (蔬菜不計熱量), target 361 -> 3 servings of 350 kcal', () => {
    expect(chicken.name).toBe('雞胸肉');
    expect(pumpkin.name).toBe('南瓜');
    const r = planBatch({ items, mealTarget: 361 });
    expect(r.batch.totals.calories).toBe(1050);
    expect(r.batch.totals.grams).toBe(1500);
    expect(r.suggestedServings).toBe(3);
    expect(r.servings).toBe(3);
    expect(r.perServing.calories).toBe(350);
    expect(r.perServing.grams).toBe(500);
    expect(r.perServing.items.map((i) => i.grams)).toEqual([333.3, 166.7]);
    expect(r.perServing.items[0].name).toBe('雞胸肉');
    expect(r.perServing.analysis.totals.calories).toBe(350);
    expect(r.status.status).toBe('met');
    expect(r.status.ratio).toBeCloseTo(1050 / 3 / 361, 10);
    expect(r.daysCovered).toBe(1.5);
  });

  it('explicit servings override the suggestion', () => {
    const r = planBatch({
      items,
      servings: 5,
      mealTarget: 361,
      mealsPerDay: 3,
    });
    expect(r.suggestedServings).toBe(3);
    expect(r.servings).toBe(5);
    expect(r.perServing.calories).toBe(210);
    expect(r.perServing.grams).toBe(300);
    expect(r.status.status).toBe('under');
    expect(r.daysCovered).toBe(1.7);
  });

  it('ignores invalid servings and falls back to the suggestion', () => {
    expect(planBatch({ items, servings: 0, mealTarget: 361 }).servings).toBe(3);
    expect(planBatch({ items, servings: null, mealTarget: 361 }).servings).toBe(
      3,
    );
  });

  it('suggestion is at least 1 and null without a target', () => {
    const small = planBatch({ items: [asItem(chicken, 50)], mealTarget: 361 });
    expect(small.suggestedServings).toBe(1);
    const noTarget = planBatch({ items, mealTarget: 0 });
    expect(noTarget.suggestedServings).toBeNull();
    expect(noTarget.servings).toBe(1);
  });

  it('zero items -> empty plan with 1 serving', () => {
    const r = planBatch({ items: [], mealTarget: 361 });
    expect(r.suggestedServings).toBeNull();
    expect(r.servings).toBe(1);
    expect(r.batch.totals.calories).toBe(0);
    expect(r.perServing.calories).toBe(0);
    expect(r.perServing.grams).toBe(0);
    expect(r.perServing.items).toEqual([]);
    expect(r.status.status).toBe('under');
    expect(r.daysCovered).toBe(0.5);
  });

  it('scales the eggshell supplement per serving', () => {
    const r = planBatch({ items, servings: 4, mealTarget: 361 });
    expect(r.batch.analysis.status).toBe('low');
    const batchEgg = eggshellGrams(r.batch.supplements);
    const servingEgg = eggshellGrams(r.perServing.analysis.supplements);
    expect(batchEgg).toBeGreaterThan(0);
    expect(servingEgg).toBeCloseTo(batchEgg / 4, 1);
    expect(r.perServing.analysis.analysis.ratio).toBe(r.batch.analysis.ratio);
  });

  it('vegetables keep Ca/P and weight but contribute no energy or macros', () => {
    const r = planBatch({ items: [asItem(pumpkin, 500)], mealTarget: 361 });
    expect(r.batch.totals.calories).toBe(0);
    expect(r.batch.totals.protein).toBe(0);
    expect(r.batch.totals.fat).toBe(0);
    expect(r.batch.totals.ca).toBe(105);
    expect(r.batch.totals.p).toBe(220);
    expect(r.batch.totals.grams).toBe(500);
    expect(r.suggestedServings).toBeNull();
  });

  it('fruit and starch still count calories', () => {
    const r = planBatch({ items: [asItem(sweetPotato, 100)], mealTarget: 86 });
    expect(r.batch.totals.calories).toBe(86);
  });
});

const draftItem = (food, grams) => ({ food, grams });
const kcalOf = (plan) =>
  plan.reduce(
    (sum, { food, grams }) =>
      food.type === 'veg' ? sum : sum + (food.calories * grams) / 100,
    0,
  );
const gramsWhere = (plan, pred) =>
  plan.filter(({ food }) => pred(food)).reduce((s, { grams }) => s + grams, 0);

describe('allocateBatchForServings', () => {
  it('scales non-veg by input ratio and sizes veg by weight share', () => {
    // 雞胸 1000 g(1050 kcal)→ 4 × 361 = 1444 kcal → 1375 g
    // 南瓜占整鍋 20% → 1375.2 × 20 / 80 = 344 g
    const plan = allocateBatchForServings(
      [draftItem(chicken, 1000), draftItem(pumpkin, 500)],
      4,
      361,
      20,
    );
    expect(plan.map((p) => p.grams)).toEqual([1375, 344]);
    expect(kcalOf(plan)).toBeCloseTo(1444, -1);
  });

  it('keeps the input ratio between non-veg foods', () => {
    const plan = allocateBatchForServings(
      [draftItem(chicken, 600), draftItem(sweetPotato, 300)],
      2,
      361,
      0,
    );
    expect(plan[0].grams / plan[1].grams).toBeCloseTo(2, 1);
    expect(kcalOf(plan)).toBeCloseTo(722, -1);
  });

  it('splits veg weight by input ratio, or evenly when all are 0 g', () => {
    const byRatio = allocateBatchForServings(
      [
        draftItem(chicken, 1000),
        draftItem(pumpkin, 300),
        draftItem(carrot, 100),
      ],
      3,
      350,
      30,
    );
    expect(byRatio[1].grams / byRatio[2].grams).toBeCloseTo(3, 1);
    const veg = gramsWhere(byRatio, (f) => f.type === 'veg');
    const total = gramsWhere(byRatio, () => true);
    expect(veg / total).toBeCloseTo(0.3, 2);

    const even = allocateBatchForServings(
      [draftItem(chicken, 1000), draftItem(pumpkin, 0), draftItem(carrot, 0)],
      3,
      350,
      30,
    );
    expect(even[1].grams).toBe(even[2].grams);
  });

  it('falls back to 70/30 kcal when all non-veg are 0 g', () => {
    const plan = allocateBatchForServings(
      [draftItem(chicken, 0), draftItem(sweetPotato, 0), draftItem(pumpkin, 0)],
      4,
      361,
      20,
    );
    // 0.7 × 1444 / 105 × 100 = 963;0.3 × 1444 / 86 × 100 = 504
    expect(plan[0].grams).toBe(963);
    expect(plan[1].grams).toBe(504);
    expect(plan[2].grams).toBe(367);
  });

  it('meat only with 0 g gets 100% of the target', () => {
    const plan = allocateBatchForServings([draftItem(chicken, 0)], 1, 361, 20);
    expect(plan[0].grams).toBe(Math.round((361 / 105) * 100));
  });

  it('leaves grams unchanged without an energy source', () => {
    const items = [draftItem(pumpkin, 200)];
    expect(canAllocateBatch(items)).toBe(false);
    expect(allocateBatchForServings(items, 4, 361, 20)).toEqual(items);
  });

  it('invalid servings count as 1', () => {
    const a = allocateBatchForServings([draftItem(chicken, 100)], 0, 361);
    const b = allocateBatchForServings([draftItem(chicken, 100)], 1, 361);
    expect(a).toEqual(b);
  });
});

describe('toVegWeightPct', () => {
  it('defaults to 20 and clamps to 0-90', () => {
    expect(toVegWeightPct(undefined)).toBe(20);
    expect(toVegWeightPct('')).toBe(20);
    expect(toVegWeightPct(-5)).toBe(0);
    expect(toVegWeightPct(95)).toBe(90);
    expect(toVegWeightPct('35')).toBe(35);
  });
});

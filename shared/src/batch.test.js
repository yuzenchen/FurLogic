import { describe, it, expect } from 'vitest';
import { allocateBatchForServings, planBatch } from './batch.js';
import { getFoodById } from './foodDatabase.js';

const asItem = (food, grams) => ({ ...food, grams });
const chicken = getFoodById(1);
const pumpkin = getFoodById(3);
const eggshellGrams = (supplements) => {
  const s = supplements.find((x) => x.name === '蛋殼粉');
  return s ? parseFloat(s.amount) : null;
};

describe('planBatch', () => {
  const items = [asItem(chicken, 1000), asItem(pumpkin, 500)];

  it('雞胸肉 1000 g + 南瓜 500 g, meal target 361 -> 3 servings of 393 kcal', () => {
    expect(chicken.name).toBe('雞胸肉');
    expect(pumpkin.name).toBe('南瓜');
    const r = planBatch({ items, mealTarget: 361 });
    expect(r.batch.totals.calories).toBe(1180);
    expect(r.batch.totals.grams).toBe(1500);
    expect(r.suggestedServings).toBe(3);
    expect(r.servings).toBe(3);
    expect(r.perServing.calories).toBe(393);
    expect(r.perServing.grams).toBe(500);
    expect(r.perServing.items.map((i) => i.grams)).toEqual([333.3, 166.7]);
    expect(r.perServing.items[0].name).toBe('雞胸肉');
    expect(r.perServing.analysis.totals.calories).toBe(393);
    expect(r.status.status).toBe('met');
    expect(r.status.ratio).toBeCloseTo(1180 / 3 / 361, 10);
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
    expect(r.perServing.calories).toBe(236);
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
});

describe('allocateBatchForServings', () => {
  it('4 servings sums to about 4 × meal target', () => {
    const plan = allocateBatchForServings([chicken, pumpkin], 4, 361);
    const kcal = plan.reduce(
      (sum, { food, grams }) => sum + (food.calories * grams) / 100,
      0,
    );
    expect(kcal).toBeCloseTo(4 * 361, -1);
    expect(plan.map((p) => p.food.id)).toEqual([1, 3]);
    // 70% 給蛋白質:0.7 × 1444 / 105 × 100 = 963
    expect(plan[0].grams).toBe(963);
  });

  it('invalid servings count as 1', () => {
    const a = allocateBatchForServings([chicken], 0, 361);
    const b = allocateBatchForServings([chicken], 1, 361);
    expect(a).toEqual(b);
  });
});

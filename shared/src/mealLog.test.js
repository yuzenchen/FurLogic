import { describe, it, expect } from 'vitest';
import {
  mealTargetCalories,
  computeIntake,
  analyzeMeal,
  allocatePortionsForTarget,
  dailyStatus,
  DAILY_STATUS_LABELS,
} from './mealLog.js';
import {
  calculateRER,
  calculateDER,
  calculateActivityFactor,
} from './nutritionCalculator.js';
import { DEFAULT_MEALS_PER_DAY, MEALS_PER_DAY } from './nutritionConstants.js';
import { getFoodById } from './foodDatabase.js';
import * as shared from './index.js';

const asItem = (food, grams) => ({
  calories: food.calories,
  protein: food.protein,
  fat: food.fat,
  ca: food.ca,
  p: food.p,
  grams,
});

const totalsOf = (items) => analyzeMeal(items).totals;

describe('index re-exports', () => {
  it('exposes calculator, constants, food db and meal log', () => {
    expect(typeof shared.generateRecipe).toBe('function');
    expect(typeof shared.computeMacros).toBe('function');
    expect(typeof shared.buildSupplements).toBe('function');
    expect(typeof shared.analyzeMeal).toBe('function');
    expect(typeof shared.planBatch).toBe('function');
    expect(shared.toDateKey).toBeUndefined();
    expect(shared.MEAL_LABELS).toBeUndefined();
    expect(shared.FOOD_DATABASE).toHaveLength(37);
    expect(shared.MEALS_PER_DAY).toBe(2);
    expect(shared.DEFAULT_MEALS_PER_DAY).toBe(2);
  });
});

describe('mealTargetCalories', () => {
  it('spec example: 12 kg neutered normal -> RER 451, DER 722, meal 361', () => {
    const rer = calculateRER(12);
    const der = calculateDER(rer, calculateActivityFactor(true, 'normal'));
    expect(rer).toBe(451);
    expect(der).toBe(722);
    expect(DEFAULT_MEALS_PER_DAY).toBe(2);
    expect(MEALS_PER_DAY).toBe(2);
    expect(Math.round(mealTargetCalories(der, 2))).toBe(361);
    expect(Math.round(mealTargetCalories(der))).toBe(361);
  });

  it('is unrounded', () => {
    expect(mealTargetCalories(721, 2)).toBe(360.5);
  });

  it('clamps meals per day to 1..4', () => {
    expect(mealTargetCalories(800, 0)).toBe(800);
    expect(mealTargetCalories(800, -3)).toBe(800);
    expect(mealTargetCalories(800, 10)).toBe(200);
    expect(mealTargetCalories(900, 3)).toBe(300);
    expect(mealTargetCalories(800, NaN)).toBe(400);
  });
});

describe('computeIntake / analyzeMeal totals', () => {
  const chicken = getFoodById(1);
  const sweetPotato = getFoodById(5);

  it('雞胸肉 200 g + 地瓜 80 g -> 279 kcal', () => {
    expect(chicken.name).toBe('雞胸肉');
    expect(sweetPotato.name).toBe('地瓜');
    const totals = totalsOf([asItem(chicken, 200), asItem(sweetPotato, 80)]);
    expect(totals.calories).toBe(279);
    expect(totals.grams).toBe(280);
    expect(totals.protein).toBeCloseTo(47.3, 5); // 46 + 1.28
    expect(totals.fat).toBeCloseTo(2.1, 5); // 2 + 0.08
    expect(Number.isInteger(totals.ca)).toBe(true);
    expect(Number.isInteger(totals.p)).toBe(true);
  });

  it('returns unrounded sums from computeIntake', () => {
    const sum = computeIntake([asItem(sweetPotato, 80)]);
    expect(sum.calories).toBeCloseTo(68.8, 10);
    expect(sum.grams).toBe(80);
  });

  it('ignores items with invalid grams', () => {
    const sum = computeIntake([
      asItem(chicken, 0),
      asItem(chicken, -10),
      asItem(chicken, NaN),
      asItem(chicken, Infinity),
      { ...asItem(chicken, 0), grams: '100' },
      asItem(chicken, 100),
    ]);
    expect(sum.calories).toBe(105);
    expect(sum.grams).toBe(100);
  });

  it('empty input -> zeros', () => {
    expect(totalsOf([])).toEqual({
      calories: 0,
      protein: 0,
      fat: 0,
      ca: 0,
      p: 0,
      grams: 0,
    });
  });
});

describe('analyzeMeal', () => {
  it('returns totals, macros, Ca:P analysis and supplements', () => {
    const r = analyzeMeal([
      asItem(getFoodById(1), 200),
      asItem(getFoodById(5), 80),
    ]);
    expect(r.totals.calories).toBe(279);
    expect(r.macros.protein.g).toBe(47);
    expect(r.analysis.status).toBe('low'); // 肉類磷高
    expect(r.supplements.map((s) => s.name)).toContain('蛋殼粉');
    expect(r.supplements.map((s) => s.name)).toContain('魚油');
  });
});

describe('allocatePortionsForTarget', () => {
  const meatA = { id: 'a', recipeRole: 'protein', calories: 100 };
  const meatB = { id: 'b', recipeRole: 'protein', calories: 200 };
  const veg = { id: 'v', recipeRole: 'plant', calories: 50 };
  const starch = { id: 's', recipeRole: 'plant', calories: 100 };

  it('splits 70% to proteins and 30% to the rest, preserving order', () => {
    const r = allocatePortionsForTarget([veg, meatA, starch, meatB], 400);
    expect(r.map((x) => x.food.id)).toEqual(['v', 'a', 's', 'b']);
    // protein: 280 kcal / 2 = 140 each; plant: 120 / 2 = 60 each
    expect(r.map((x) => x.grams)).toEqual([120, 140, 60, 70]);
  });

  it('falls back to type === protein when recipeRole missing', () => {
    const legacyMeat = { id: 'm', type: 'protein', calories: 100 };
    const legacyVeg = { id: 'g', type: 'veg', calories: 100 };
    const r = allocatePortionsForTarget([legacyVeg, legacyMeat], 100);
    expect(r.map((x) => x.grams)).toEqual([30, 70]);
  });

  it('no-meat case splits 100% evenly', () => {
    const r = allocatePortionsForTarget([veg, starch], 200);
    expect(r.map((x) => x.grams)).toEqual([200, 100]);
  });

  it('excluded / zero-calorie foods get 0 g and do not take a share', () => {
    const toxic = { id: 't', recipeRole: 'excluded', calories: 300 };
    const water = { id: 'w', recipeRole: 'plant', calories: 0 };
    const r = allocatePortionsForTarget([toxic, meatA, water, veg], 100);
    expect(r.map((x) => x.food.id)).toEqual(['t', 'a', 'w', 'v']);
    expect(r.map((x) => x.grams)).toEqual([0, 70, 0, 60]);
  });

  it('only proteins -> 70% of target', () => {
    const r = allocatePortionsForTarget([meatA], 100);
    expect(r[0].grams).toBe(70);
  });

  it('rounds grams to integers', () => {
    const r = allocatePortionsForTarget(
      [{ recipeRole: 'plant', calories: 86 }],
      361,
    );
    expect(r[0].grams).toBe(420); // 361/86*100 = 419.77
  });

  it('empty input -> []', () => {
    expect(allocatePortionsForTarget([], 400)).toEqual([]);
  });

  it('agrees with real food data', () => {
    const r = allocatePortionsForTarget([getFoodById(1), getFoodById(5)], 361);
    expect(r[0].grams).toBe(Math.round(((361 * 0.7) / 105) * 100));
    expect(r[1].grams).toBe(Math.round(((361 * 0.3) / 86) * 100));
  });
});

describe('dailyStatus', () => {
  it('boundaries 0.9 / 1.1', () => {
    expect(dailyStatus(899, 1000).status).toBe('under');
    expect(dailyStatus(900, 1000).status).toBe('met');
    expect(dailyStatus(1000, 1000).status).toBe('met');
    expect(dailyStatus(1100, 1000).status).toBe('met');
    expect(dailyStatus(1101, 1000).status).toBe('over');
    expect(dailyStatus(500, 1000).ratio).toBe(0.5);
  });

  it('der <= 0 -> ratio 0', () => {
    expect(dailyStatus(500, 0)).toEqual({ ratio: 0, status: 'under' });
  });

  it('has labels', () => {
    expect(DAILY_STATUS_LABELS).toEqual({
      under: '不足',
      met: '達標',
      over: '超過',
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  batchDraftReducer,
  emptyBatchDraft,
  snapshotFood,
  toMealTargetOverride,
  toMealsCount,
  toPlanItems,
} from './batchDraft';

const chicken = {
  id: 1,
  name: '雞胸肉',
  type: 'protein',
  subtype: null,
  recipeRole: 'protein',
  safety: 'safe',
  warning: null,
  description: '很長的說明',
  calories: 105,
  protein: 23,
  fat: 1,
  ca: 5,
  p: 200,
  source: 'builtin',
  sourceRef: null,
  isBuiltin: true,
};
const mackerel = {
  id: 2,
  name: '鯖魚',
  type: 'protein',
  subtype: 'fatty_fish',
  recipeRole: 'protein',
  safety: 'safe',
  calories: 205,
  protein: 19,
  fat: 14,
  ca: 12,
  p: 217,
  source: 'builtin',
};
const pumpkin = {
  id: 3,
  name: '南瓜',
  type: 'veg',
  recipeRole: 'plant',
  safety: 'safe',
  calories: 26,
  protein: 1,
  fat: 0.1,
  ca: 21,
  p: 44,
  source: 'builtin',
};
const liver = {
  id: 4,
  name: '鴨內臟',
  type: 'protein',
  subtype: 'organ',
  recipeRole: 'protein',
  safety: 'safe',
  calories: 150,
};
const rice = {
  id: 5,
  name: '白飯',
  type: 'starch',
  recipeRole: 'plant',
  safety: 'safe',
  calories: 130,
};
const grape = {
  id: 99,
  name: '葡萄',
  type: 'fruit',
  recipeRole: 'excluded',
  safety: 'toxic',
  calories: 69,
};

const empty = emptyBatchDraft();
const run = (state, ...actions) => actions.reduce(batchDraftReducer, state);
const add = (food) => ({ type: 'addFood', food });
const rolesOf = (s) => s.items.map((i) => [i.food.id, i.role]);

describe('snapshotFood', () => {
  it('keeps only draft fields (including subtype)', () => {
    expect(snapshotFood(chicken)).toEqual({
      id: 1,
      name: '雞胸肉',
      type: 'protein',
      subtype: null,
      recipeRole: 'protein',
      safety: 'safe',
      warning: null,
      calories: 105,
      protein: 23,
      fat: 1,
      ca: 5,
      p: 200,
      source: 'builtin',
    });
  });
});

describe('toMealsCount', () => {
  it('normalises to an integer in 1..60', () => {
    expect(toMealsCount(null)).toBe(1);
    expect(toMealsCount('')).toBe(1);
    expect(toMealsCount('abc')).toBe(1);
    expect(toMealsCount(0)).toBe(1);
    expect(toMealsCount(-4)).toBe(1);
    expect(toMealsCount(3.6)).toBe(4);
    expect(toMealsCount('7')).toBe(7);
    expect(toMealsCount(999)).toBe(60);
  });
});

describe('toMealTargetOverride', () => {
  it('keeps positive numbers to one decimal, otherwise null', () => {
    expect(toMealTargetOverride(null)).toBeNull();
    expect(toMealTargetOverride('')).toBeNull();
    expect(toMealTargetOverride('abc')).toBeNull();
    expect(toMealTargetOverride(0)).toBeNull();
    expect(toMealTargetOverride(-10)).toBeNull();
    expect(toMealTargetOverride(Infinity)).toBeNull();
    expect(toMealTargetOverride('450')).toBe(450);
    expect(toMealTargetOverride(450.26)).toBe(450.3);
  });
});

describe('batchDraftReducer', () => {
  it('starts with 2 meals, no override and no items', () => {
    expect(empty).toEqual({
      mealsCount: 2,
      mealTargetOverride: null,
      items: [],
    });
  });

  it('setMealsCount clamps to 1–60 and keeps identity when unchanged', () => {
    const s = run(empty, { type: 'setMealsCount', mealsCount: 4 });
    expect(s.mealsCount).toBe(4);
    expect(run(s, { type: 'setMealsCount', mealsCount: 0 }).mealsCount).toBe(1);
    expect(run(s, { type: 'setMealsCount', mealsCount: 100 }).mealsCount).toBe(
      60,
    );
    expect(batchDraftReducer(s, { type: 'setMealsCount', mealsCount: 4 })).toBe(
      s,
    );
  });

  it('setMealTargetOverride stores a positive kcal or null', () => {
    const s = run(empty, { type: 'setMealTargetOverride', mealTarget: 450 });
    expect(s.mealTargetOverride).toBe(450);
    expect(
      run(s, { type: 'setMealTargetOverride', mealTarget: null })
        .mealTargetOverride,
    ).toBeNull();
    expect(
      run(s, { type: 'setMealTargetOverride', mealTarget: -1 })
        .mealTargetOverride,
    ).toBeNull();
    expect(
      batchDraftReducer(s, { type: 'setMealTargetOverride', mealTarget: 450 }),
    ).toBe(s);
  });

  it('addFood skips duplicates and toxic foods', () => {
    const s = run(empty, add(chicken), add(chicken), add(grape));
    expect(s.items).toHaveLength(1);
    expect(s.items[0].food).toEqual(snapshotFood(chicken));
  });

  it('addFood defaults roles: first protein → main, later proteins → variant, others → fixed', () => {
    const s = run(empty, add(rice), add(chicken), add(mackerel), add(pumpkin));
    expect(rolesOf(s)).toEqual([
      [5, 'fixed'],
      [1, 'main'],
      [2, 'variant'],
      [3, 'fixed'],
    ]);
  });

  it('addFood defaults gramsPerMeal from the meal caps (veg 50 / organ 12 / fatty fish 65 / else 0)', () => {
    const s = run(empty, add(pumpkin), add(liver), add(mackerel), add(rice));
    expect(s.items.map((i) => i.gramsPerMeal)).toEqual([50, 12, 65, 0]);
  });

  it('removes a food by id', () => {
    const s = run(empty, add(chicken), add(pumpkin), {
      type: 'removeFood',
      id: 1,
    });
    expect(s.items.map((i) => i.food.id)).toEqual([3]);
  });

  it('setRole changes a role and demotes the previous main to variant', () => {
    const base = run(empty, add(chicken), add(mackerel));
    expect(rolesOf(base)).toEqual([
      [1, 'main'],
      [2, 'variant'],
    ]);
    const s = run(base, { type: 'setRole', id: 2, role: 'main' });
    expect(rolesOf(s)).toEqual([
      [1, 'variant'],
      [2, 'main'],
    ]);
    const t = run(s, { type: 'setRole', id: 2, role: 'fixed' });
    expect(rolesOf(t)).toEqual([
      [1, 'variant'],
      [2, 'fixed'],
    ]);
  });

  it('setRole ignores unknown roles, unknown ids and no-op changes', () => {
    const base = run(empty, add(chicken));
    expect(batchDraftReducer(base, { type: 'setRole', id: 1, role: 'x' })).toBe(
      base,
    );
    expect(
      batchDraftReducer(base, { type: 'setRole', id: 42, role: 'fixed' }),
    ).toBe(base);
    expect(
      batchDraftReducer(base, { type: 'setRole', id: 1, role: 'main' }),
    ).toBe(base);
  });

  it('setGramsPerMeal clamps to ≥ 0, one decimal, and turns NaN into 0', () => {
    const base = run(empty, add(chicken));
    const grams = (g) =>
      run(base, { type: 'setGramsPerMeal', id: 1, grams: g }).items[0]
        .gramsPerMeal;
    expect(grams(100)).toBe(100);
    expect(grams(-5)).toBe(0);
    expect(grams(NaN)).toBe(0);
    expect(grams('')).toBe(0);
    expect(grams('12.56')).toBe(12.6);
  });

  it('bump steps by 10 with a floor of 0', () => {
    const base = run(empty, add(chicken), {
      type: 'setGramsPerMeal',
      id: 1,
      grams: 5,
    });
    expect(
      run(base, { type: 'bump', id: 1, delta: 1 }).items[0].gramsPerMeal,
    ).toBe(15);
    expect(
      run(base, { type: 'bump', id: 1, delta: -1 }).items[0].gramsPerMeal,
    ).toBe(0);
  });

  it('clear empties items and override but keeps mealsCount', () => {
    const s = run(
      empty,
      add(chicken),
      { type: 'setMealsCount', mealsCount: 5 },
      { type: 'setMealTargetOverride', mealTarget: 400 },
      { type: 'clear' },
    );
    expect(s).toEqual({ mealsCount: 5, mealTargetOverride: null, items: [] });
  });

  it('returns the same state for unknown actions', () => {
    expect(batchDraftReducer(empty, { type: 'nope' })).toBe(empty);
  });
});

describe('toPlanItems', () => {
  it('merges food fields with role and gramsPerMeal', () => {
    const s = run(empty, add(mackerel), {
      type: 'setGramsPerMeal',
      id: 2,
      grams: 40,
    });
    expect(toPlanItems(s.items)[0]).toMatchObject({
      name: '鯖魚',
      subtype: 'fatty_fish',
      calories: 205,
      role: 'main',
      gramsPerMeal: 40,
    });
  });
});

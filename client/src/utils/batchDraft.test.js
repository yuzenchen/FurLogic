import { describe, expect, it } from 'vitest';
import {
  batchDraftReducer,
  categoryOfItem,
  emptyBatchDraft,
  presentCategories,
  snapshotFood,
  toMealTargetOverride,
  toMealsCount,
  toPct,
  toRatioItems,
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
const duck = {
  id: 6,
  name: '鴨柳',
  type: 'protein',
  recipeRole: 'protein',
  safety: 'safe',
  calories: 110,
};
const melon = {
  id: 7,
  name: '冬瓜',
  type: 'veg',
  recipeRole: 'plant',
  safety: 'safe',
  calories: 12,
};
const apple = {
  id: 8,
  name: '蘋果',
  type: 'fruit',
  recipeRole: 'plant',
  safety: 'safe',
  calories: 52,
};
const snack = {
  id: 9,
  name: '零食',
  type: 'snack',
  recipeRole: 'plant',
  safety: 'safe',
  calories: 300,
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
const pctsOf = (s) => s.items.map((i) => [i.food.id, i.pct]);

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

describe('toPct', () => {
  it('clamps to 0..100 with one decimal; invalid → 0', () => {
    expect(toPct('')).toBe(0);
    expect(toPct('abc')).toBe(0);
    expect(toPct(-5)).toBe(0);
    expect(toPct(NaN)).toBe(0);
    expect(toPct('12.34')).toBe(12.3);
    expect(toPct(150)).toBe(100);
    expect(toPct(40)).toBe(40);
  });
});

describe('batchDraftReducer', () => {
  it('starts with 2 meals, no override, no categories and no items', () => {
    expect(empty).toEqual({
      mealsCount: 2,
      mealTargetOverride: null,
      categoryPct: {},
      items: [],
    });
  });

  it('setMealsCount clamps to 1–60 and keeps identity when unchanged', () => {
    const s = run(empty, { type: 'setMealsCount', mealsCount: 999 });
    expect(s.mealsCount).toBe(60);
    expect(
      batchDraftReducer(s, { type: 'setMealsCount', mealsCount: 60 }),
    ).toBe(s);
    expect(
      run(empty, { type: 'setMealsCount', mealsCount: 'x' }).mealsCount,
    ).toBe(1);
  });

  it('setMealTargetOverride stores a positive kcal or null', () => {
    const s = run(empty, { type: 'setMealTargetOverride', mealTarget: '450' });
    expect(s.mealTargetOverride).toBe(450);
    expect(
      batchDraftReducer(s, { type: 'setMealTargetOverride', mealTarget: 450 }),
    ).toBe(s);
    expect(
      run(s, { type: 'setMealTargetOverride', mealTarget: 0 })
        .mealTargetOverride,
    ).toBeNull();
  });

  it('addFood skips duplicates, toxic foods and invalid input', () => {
    const s = run(empty, add(chicken), add(chicken), add(grape), add(null));
    expect(s.items).toHaveLength(1);
    expect(s.items[0].food).toEqual(snapshotFood(chicken));
  });

  it('first food of a single category gets 100%', () => {
    const s = run(empty, add(chicken));
    expect(s.categoryPct).toEqual({ protein: 100 });
    expect(pctsOf(s)).toEqual([[1, 100]]);
  });

  it('builds the sketch: new categories rebalance all, same category splits evenly', () => {
    const s = run(empty, add(chicken), add(rice));
    expect(s.categoryPct).toEqual({ protein: 86, starch: 14 });
    const t = run(s, add(pumpkin));
    expect(t.categoryPct).toEqual({ protein: 60, produce: 30, starch: 10 });
    expect(pctsOf(t)).toEqual([
      [1, 60],
      [5, 10],
      [3, 30],
    ]);
    // 同類新增:只重分該類,其他類不動
    const u = run(t, add(duck), add(melon));
    expect(u.categoryPct).toEqual({ protein: 60, produce: 30, starch: 10 });
    expect(pctsOf(u)).toEqual([
      [1, 30],
      [5, 10],
      [3, 15],
      [6, 30],
      [7, 15],
    ]);
  });

  it('adding to an existing category keeps a user-set category pct', () => {
    const s = run(
      empty,
      add(chicken),
      add(pumpkin),
      { type: 'setCategoryPct', cat: 'protein', pct: 70 },
      add(duck),
    );
    expect(s.categoryPct.protein).toBe(70);
    expect(pctsOf(s)).toEqual([
      [1, 35],
      [3, 33],
      [6, 35],
    ]);
  });

  it('fruit counts as produce; unknown types as other', () => {
    expect(categoryOfItem({ food: apple })).toBe('produce');
    expect(categoryOfItem({ food: snack })).toBe('other');
    const s = run(empty, add(snack));
    expect(s.categoryPct).toEqual({ other: 100 });
    expect(presentCategories(run(s, add(apple), add(pumpkin)).items)).toEqual([
      'other',
      'produce',
    ]);
  });

  it('splits uneven pcts with the remainder on the first item', () => {
    const s = run(empty, add(chicken), add(duck), add(liver));
    expect(pctsOf(s)).toEqual([
      [1, 33.4],
      [6, 33.3],
      [4, 33.3],
    ]);
  });

  it('removeFood re-splits the category, or rebalances when the category disappears', () => {
    const s = run(empty, add(chicken), add(duck), add(pumpkin), add(rice));
    const a = run(s, { type: 'removeFood', id: 6 });
    expect(a.categoryPct).toEqual({ protein: 60, produce: 30, starch: 10 });
    expect(pctsOf(a)).toEqual([
      [1, 60],
      [3, 30],
      [5, 10],
    ]);
    const b = run(a, { type: 'removeFood', id: 5 });
    expect(b.categoryPct).toEqual({ protein: 67, produce: 33 });
    expect(pctsOf(b)).toEqual([
      [1, 67],
      [3, 33],
    ]);
    const c = run(
      b,
      { type: 'removeFood', id: 1 },
      { type: 'removeFood', id: 3 },
    );
    expect(c.categoryPct).toEqual({});
    expect(c.items).toEqual([]);
    expect(batchDraftReducer(c, { type: 'removeFood', id: 123 })).toBe(c);
  });

  it('setCategoryPct normalises and splits evenly; ignores absent categories', () => {
    const s = run(empty, add(chicken), add(duck), add(pumpkin));
    const t = run(s, { type: 'setCategoryPct', cat: 'protein', pct: '55.55' });
    expect(t.categoryPct.protein).toBe(55.6);
    expect(pctsOf(t)).toEqual([
      [1, 27.8],
      [6, 27.8],
      [3, 33],
    ]);
    expect(
      run(t, { type: 'setCategoryPct', cat: 'protein', pct: 200 }).categoryPct
        .protein,
    ).toBe(100);
    expect(
      batchDraftReducer(t, { type: 'setCategoryPct', cat: 'starch', pct: 10 }),
    ).toBe(t);
  });

  it('setItemPct changes only that item; splitCategory evens it back out', () => {
    const s = run(empty, add(chicken), add(duck), add(pumpkin));
    const t = run(s, { type: 'setItemPct', id: 1, pct: 40 });
    expect(pctsOf(t)).toEqual([
      [1, 40],
      [6, 33.5],
      [3, 33],
    ]);
    expect(t.categoryPct).toEqual(s.categoryPct);
    expect(batchDraftReducer(t, { type: 'setItemPct', id: 1, pct: 40 })).toBe(
      t,
    );
    expect(batchDraftReducer(t, { type: 'setItemPct', id: 999, pct: 1 })).toBe(
      t,
    );
    expect(run(t, { type: 'setItemPct', id: 1, pct: -1 }).items[0].pct).toBe(0);
    const u = run(t, { type: 'splitCategory', cat: 'protein' });
    expect(pctsOf(u)).toEqual(pctsOf(s));
    expect(batchDraftReducer(u, { type: 'splitCategory', cat: 'other' })).toBe(
      u,
    );
  });

  it('clear empties items, categories and override but keeps mealsCount', () => {
    const s = run(
      empty,
      { type: 'setMealsCount', mealsCount: 8 },
      { type: 'setMealTargetOverride', mealTarget: 400 },
      add(chicken),
      { type: 'clear' },
    );
    expect(s).toEqual({ ...emptyBatchDraft(), mealsCount: 8 });
  });

  it('returns the same state for unknown actions', () => {
    expect(batchDraftReducer(empty, { type: 'nope' })).toBe(empty);
    expect(batchDraftReducer(empty, undefined)).toBe(empty);
  });
});

describe('toRatioItems', () => {
  it('merges food fields with pct', () => {
    const s = run(empty, add(chicken), add(pumpkin));
    expect(toRatioItems(s.items)).toEqual([
      { ...snapshotFood(chicken), pct: 67 },
      { ...snapshotFood(pumpkin), pct: 33 },
    ]);
    expect(toRatioItems()).toEqual([]);
  });
});

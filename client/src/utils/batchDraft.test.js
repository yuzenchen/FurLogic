import { describe, expect, it } from 'vitest';
import {
  batchDraftReducer,
  emptyBatchDraft,
  flattenDraftItems,
  snapshotFood,
  toServings,
} from './batchDraft';

const chicken = {
  id: 1,
  name: '雞胸肉',
  type: 'protein',
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

describe('snapshotFood', () => {
  it('keeps only draft fields', () => {
    expect(snapshotFood(chicken)).toEqual({
      id: 1,
      name: '雞胸肉',
      type: 'protein',
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

describe('toServings', () => {
  it('normalises to an integer in 1..60 or null', () => {
    expect(toServings(null)).toBeNull();
    expect(toServings('')).toBeNull();
    expect(toServings('abc')).toBeNull();
    expect(toServings(0)).toBe(1);
    expect(toServings(-4)).toBe(1);
    expect(toServings(3.6)).toBe(4);
    expect(toServings('7')).toBe(7);
    expect(toServings(999)).toBe(60);
  });
});

describe('batchDraftReducer', () => {
  it('starts with no servings override and no items', () => {
    expect(empty).toEqual({ servings: null, vegWeightPct: 20, items: [] });
  });

  it('setServings stores an integer or null (use suggestion)', () => {
    const s = run(empty, { type: 'setServings', servings: 4 });
    expect(s.servings).toBe(4);
    expect(run(s, { type: 'setServings', servings: null }).servings).toBeNull();
    expect(run(s, { type: 'setServings', servings: 0 }).servings).toBe(1);
    expect(batchDraftReducer(s, { type: 'setServings', servings: 4 })).toBe(s);
  });

  it('adds foods with 0 g and skips duplicates and toxic foods', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'addFood', food: chicken },
      { type: 'addFood', food: grape },
    );
    expect(s.items).toHaveLength(1);
    expect(s.items[0].grams).toBe(0);
    expect(s.items[0].food).toEqual(snapshotFood(chicken));
  });

  it('removes a food by id', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'addFood', food: pumpkin },
      { type: 'removeFood', id: 1 },
    );
    expect(s.items.map((i) => i.food.id)).toEqual([3]);
  });

  it('setGrams clamps to ≥ 0 and turns NaN into 0', () => {
    const base = run(empty, { type: 'addFood', food: chicken });
    const grams = (g) =>
      run(base, { type: 'setGrams', id: 1, grams: g }).items[0].grams;
    expect(grams(1000)).toBe(1000);
    expect(grams(-5)).toBe(0);
    expect(grams(NaN)).toBe(0);
    expect(grams('')).toBe(0);
    expect(grams('12.5')).toBe(12.5);
  });

  it('bump steps by 50 with a floor of 0', () => {
    const base = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'setGrams', id: 1, grams: 30 },
    );
    expect(run(base, { type: 'bump', id: 1, delta: 1 }).items[0].grams).toBe(
      80,
    );
    expect(run(base, { type: 'bump', id: 1, delta: -1 }).items[0].grams).toBe(
      0,
    );
  });

  it('applyAllocation scales meat to the target and sizes veg by weight %', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'addFood', food: pumpkin },
      { type: 'setGrams', id: 1, grams: 1000 },
      { type: 'setGrams', id: 3, grams: 500 },
      { type: 'applyAllocation', servings: 4, mealTarget: 361 },
    );
    // 雞胸 1000 g → 1444 kcal 需 1375 g;南瓜占整鍋 20% → 344 g
    expect(s.items.map((i) => i.grams)).toEqual([1375, 344]);
  });

  it('applyAllocation uses the draft vegWeightPct', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'addFood', food: pumpkin },
      { type: 'setVegWeightPct', pct: 50 },
      { type: 'applyAllocation', servings: 1, mealTarget: 361 },
    );
    expect(s.items[0].grams).toBe(344);
    expect(s.items[1].grams).toBe(344);
  });

  it('setVegWeightPct clamps to 0–90', () => {
    expect(run(empty, { type: 'setVegWeightPct', pct: 120 }).vegWeightPct).toBe(
      90,
    );
    expect(run(empty, { type: 'setVegWeightPct', pct: -1 }).vegWeightPct).toBe(
      0,
    );
    expect(batchDraftReducer(empty, { type: 'setVegWeightPct', pct: 20 })).toBe(
      empty,
    );
  });

  it('applyAllocation treats a missing servings count as 1', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'applyAllocation', servings: null, mealTarget: 361 },
    );
    // 只有肉、且為 0 g → 肉負責 100% 熱量
    expect(s.items[0].grams).toBe(Math.round((361 / 105) * 100));
  });

  it('clear resets items and servings but keeps vegWeightPct', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'setServings', servings: 5 },
      { type: 'setVegWeightPct', pct: 30 },
      { type: 'clear' },
    );
    expect(s).toEqual({ servings: null, vegWeightPct: 30, items: [] });
  });

  it('returns the same state for unknown actions', () => {
    expect(batchDraftReducer(empty, { type: 'nope' })).toBe(empty);
  });
});

describe('flattenDraftItems', () => {
  it('merges food fields with grams', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'setGrams', id: 1, grams: 1000 },
    );
    expect(flattenDraftItems(s.items)[0]).toMatchObject({
      name: '雞胸肉',
      calories: 105,
      grams: 1000,
    });
  });
});

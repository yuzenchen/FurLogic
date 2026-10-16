import { describe, expect, it } from 'vitest';
import {
  buildMealPayload,
  flattenDraftItems,
  mealDraftReducer,
  snapshotFood,
} from './mealDraft';

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
  id: 20,
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
  protein: 0.7,
  fat: 0.2,
  ca: 10,
  p: 20,
};

const empty = { label: 'dinner', items: [] };
const run = (state, ...actions) => actions.reduce(mealDraftReducer, state);

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

describe('mealDraftReducer', () => {
  it('sets a valid label and ignores unknown labels', () => {
    expect(run(empty, { type: 'setLabel', label: 'lunch' }).label).toBe(
      'lunch',
    );
    expect(run(empty, { type: 'setLabel', label: 'brunch' }).label).toBe(
      'dinner',
    );
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
    expect(s.items.map((i) => i.food.id)).toEqual([20]);
  });

  it('setGrams clamps to ≥ 0 and turns NaN into 0', () => {
    const base = run(empty, { type: 'addFood', food: chicken });
    expect(
      run(base, { type: 'setGrams', id: 1, grams: 120 }).items[0].grams,
    ).toBe(120);
    expect(
      run(base, { type: 'setGrams', id: 1, grams: -5 }).items[0].grams,
    ).toBe(0);
    expect(
      run(base, { type: 'setGrams', id: 1, grams: NaN }).items[0].grams,
    ).toBe(0);
    expect(
      run(base, { type: 'setGrams', id: 1, grams: '' }).items[0].grams,
    ).toBe(0);
    expect(
      run(base, { type: 'setGrams', id: 1, grams: '12.5' }).items[0].grams,
    ).toBe(12.5);
  });

  it('bump steps by 10 with a floor of 0', () => {
    const base = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'setGrams', id: 1, grams: 5 },
    );
    expect(run(base, { type: 'bump', id: 1, delta: 10 }).items[0].grams).toBe(
      15,
    );
    expect(run(base, { type: 'bump', id: 1, delta: -10 }).items[0].grams).toBe(
      0,
    );
  });

  it('applyAllocation uses the shared 70/30 rule', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'addFood', food: pumpkin },
      { type: 'applyAllocation', target: 500 },
    );
    // 350 kcal / 105 * 100 = 333;150 kcal / 26 * 100 = 577
    expect(s.items.map((i) => i.grams)).toEqual([333, 577]);
  });

  it('clear resets items and uses the given label', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'clear', label: 'snack' },
    );
    expect(s).toEqual({ label: 'snack', items: [] });
  });

  it('returns the same state for unknown actions', () => {
    expect(mealDraftReducer(empty, { type: 'nope' })).toBe(empty);
  });
});

describe('flattenDraftItems', () => {
  it('merges food fields with grams', () => {
    const s = run(
      empty,
      { type: 'addFood', food: chicken },
      { type: 'setGrams', id: 1, grams: 100 },
    );
    expect(flattenDraftItems(s.items)[0]).toMatchObject({
      name: '雞胸肉',
      calories: 105,
      grams: 100,
    });
  });
});

describe('buildMealPayload', () => {
  const now = new Date(2026, 9, 16, 18, 30, 5);

  it('builds the exact server shape and drops 0 g items', () => {
    const items = [
      { food: snapshotFood(chicken), grams: 150 },
      { food: snapshotFood(pumpkin), grams: 0 },
      {
        food: { id: -3, name: '自製湯', type: 'veg', calories: 20 },
        grams: 50,
      },
    ];
    const payload = buildMealPayload({ petId: 1, label: 'dinner', items, now });
    expect(Object.keys(payload)).toEqual([
      'petId',
      'label',
      'eatenAt',
      'items',
    ]);
    expect(payload.petId).toBe(1);
    expect(payload.label).toBe('dinner');
    expect(payload.eatenAt).toMatch(/^2026-10-16T18:30:05[+-]\d{2}:\d{2}$/);
    expect(payload.items).toEqual([
      {
        foodId: 1,
        name: '雞胸肉',
        recipeRole: 'protein',
        calories: 105,
        protein: 23,
        fat: 1,
        ca: 5,
        p: 200,
        grams: 150,
      },
      {
        name: '自製湯',
        recipeRole: 'plant',
        calories: 20,
        protein: 0,
        fat: 0,
        ca: 0,
        p: 0,
        grams: 50,
      },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { planByRatio } from '@furlogic/shared';
import { buildReviewPayload, toReviewBody } from './review';

const foods = [
  {
    id: 1,
    name: '雞胸肉',
    type: 'protein',
    calories: 120,
    protein: 22,
    fat: 2,
    ca: 5,
    p: 200,
    pct: 60,
  },
  {
    id: 2,
    name: '南瓜',
    type: 'veg',
    calories: 30,
    protein: 1,
    fat: 0,
    ca: 20,
    p: 40,
    pct: 30,
  },
  { id: 3, name: '白飯', type: 'starch', calories: 180, pct: 10 },
];

const plan = (mealTarget = 450.6) =>
  planByRatio({ items: foods, mealTarget, mealsCount: 4, mealsPerDay: 2 });

describe('buildReviewPayload', () => {
  it('maps planByRatio output to exactly the API fields', () => {
    const result = plan();
    const payload = buildReviewPayload({
      pet: { id: 'x', name: 'JOJO', weight: 8.5, isNeutered: true },
      mealTarget: 450.6,
      mealsCount: 4,
      mealsPerDay: 2,
      result,
    });
    expect(Object.keys(payload).sort()).toEqual(
      [
        'appResult',
        'items',
        'mealTarget',
        'mealsCount',
        'mealsPerDay',
        'pet',
      ].sort(),
    );
    expect(payload.pet).toEqual({ name: 'JOJO', weight: 8.5 });
    expect(payload.mealTarget).toBe(450.6); // 不四捨五入
    expect(payload.items).toHaveLength(3);
    expect(Object.keys(payload.items[0]).sort()).toEqual(
      [
        'name',
        'type',
        'subtype',
        'calories',
        'protein',
        'fat',
        'ca',
        'p',
        'pct',
        'gramsPerMeal',
      ].sort(),
    );
    expect(payload.items[0]).toMatchObject({
      name: '雞胸肉',
      type: 'protein',
      subtype: null,
      pct: 60,
      gramsPerMeal: result.items[0].gramsPerMeal,
    });
    // 數值缺漏 → 0
    expect(payload.items[2]).toMatchObject({ protein: 0, fat: 0, ca: 0, p: 0 });
    expect(Object.keys(payload.appResult).sort()).toEqual(
      [
        'totalGramsPerMeal',
        'perMealKcal',
        'protein',
        'fat',
        'ca',
        'p',
        'caPRatio',
        'capWarnings',
      ].sort(),
    );
    expect(payload.appResult).toMatchObject({
      totalGramsPerMeal: result.totalGramsPerMeal,
      perMealKcal: result.perMeal.totals.calories,
      protein: result.perMeal.totals.protein,
    });
    expect(typeof payload.appResult.caPRatio).toBe('number');
    expect(Array.isArray(payload.appResult.capWarnings)).toBe(true);
  });

  it('formats cap warnings and clamps meta fields', () => {
    const result = {
      ...plan(),
      capWarnings: [{ kind: 'veg', grams: 120.5, cap: 50, label: '蔬菜' }],
    };
    const payload = buildReviewPayload({
      pet: { name: '  ', weight: undefined },
      mealTarget: 450,
      mealsCount: 4,
      mealsPerDay: 7.4,
      result,
    });
    expect(payload.appResult.capWarnings).toEqual([
      '蔬菜每餐建議 ≤ 50 g,目前 120.5 g',
    ]);
    expect(payload.pet).toEqual({ name: '毛孩', weight: 0 });
    expect(payload.mealsPerDay).toBe(4);
    expect(
      buildReviewPayload({
        pet: null,
        mealTarget: 450,
        mealsCount: 4,
        mealsPerDay: 0,
        result,
      }).mealsPerDay,
    ).toBe(1);
  });

  it('truncates long names', () => {
    const result = plan();
    result.items[0] = { ...result.items[0], name: 'a'.repeat(60) };
    const payload = buildReviewPayload({
      pet: { name: 'b'.repeat(50), weight: 5 },
      mealTarget: 450,
      mealsCount: 4,
      mealsPerDay: 2,
      result,
    });
    expect(payload.items[0].name).toHaveLength(40);
    result.items[1] = { ...result.items[1], name: '  ', calories: -5 };
    const again = buildReviewPayload({
      pet: { name: 'A', weight: 5 },
      mealTarget: 450,
      mealsCount: 4,
      mealsPerDay: 2,
      result,
    });
    expect(again.items[1]).toMatchObject({ name: '未命名食材', calories: 0 });
    expect(payload.pet.name).toHaveLength(30);
  });

  it('sets caPRatio null when Ca:P cannot be computed', () => {
    const result = plan();
    result.perMeal = {
      ...result.perMeal,
      analysis: { ratio: 0, status: 'unknown' },
    };
    const payload = buildReviewPayload({
      pet: { name: 'A', weight: 5 },
      mealTarget: 450,
      mealsCount: 4,
      mealsPerDay: 2,
      result,
    });
    expect(payload.appResult.caPRatio).toBeNull();
  });

  it('returns null for failed results or non-positive targets', () => {
    const base = { pet: null, mealsCount: 2, mealsPerDay: 2 };
    expect(
      buildReviewPayload({ ...base, mealTarget: 0, result: plan() }),
    ).toBeNull();
    expect(
      buildReviewPayload({ ...base, mealTarget: 450, result: plan(0) }),
    ).toBeNull();
  });
});

describe('toReviewBody', () => {
  it('drops computedAt', () => {
    expect(toReviewBody({ computedAt: 'x', mealTarget: 1 })).toEqual({
      mealTarget: 1,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLegacyData,
  getActiveTab,
  getBatchDraft,
  readLegacyPetProfile,
  saveActiveTab,
  saveBatchDraft,
} from './storage';

const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
};

let storage;
beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('window', { localStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

describe('active tab', () => {
  it('defaults to batch and migrates legacy values', () => {
    expect(getActiveTab()).toBe('batch');
    for (const old of ['today', 'history', 'log', 'home', '"kitchen"']) {
      storage.setItem('furlogic_active_tab', old);
      expect(getActiveTab()).toBe('batch');
    }
    storage.setItem('furlogic_active_tab', 'search');
    expect(getActiveTab()).toBe('foods');
    storage.setItem('furlogic_active_tab', '"foods"');
    expect(getActiveTab()).toBe('foods');
    storage.setItem('furlogic_active_tab', 'bogus');
    expect(getActiveTab()).toBe('batch');
  });

  it('round-trips valid tabs and ignores invalid ones', () => {
    saveActiveTab('foods');
    expect(getActiveTab()).toBe('foods');
    saveActiveTab('history');
    expect(getActiveTab()).toBe('foods');
  });

  it('survives a throwing localStorage', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('denied');
      },
    });
    expect(getActiveTab()).toBe('batch');
    expect(() => saveActiveTab('foods')).not.toThrow();
    expect(getBatchDraft()).toBeNull();
  });
});

describe('batch draft', () => {
  it('validates the ratio shape on read', () => {
    const draft = {
      mealsCount: 4,
      mealTargetOverride: 450,
      categoryPct: { protein: 60, produce: 40 },
      items: [
        { food: { id: 1, name: '雞胸', type: 'protein' }, pct: 60 },
        { food: { id: 3, name: '南瓜', type: 'veg' }, pct: 40 },
      ],
    };
    saveBatchDraft(draft);
    expect(getBatchDraft()).toEqual(draft);
    saveBatchDraft({ ...draft, mealTargetOverride: null });
    expect(getBatchDraft().mealTargetOverride).toBeNull();
    // 缺 mealTargetOverride 視為 null;空清單缺 categoryPct 視為 {}
    storage.setItem('furlogic_batch_draft', '{"mealsCount":2,"items":[]}');
    expect(getBatchDraft()).toEqual({
      mealsCount: 2,
      mealTargetOverride: null,
      categoryPct: {},
      items: [],
    });
    const food = '{"name":"a","type":"protein"}';
    const bad = [
      '{"items":[]}', // 缺 mealsCount
      '{"mealsCount":0,"items":[]}',
      '{"mealsCount":61,"items":[]}',
      '{"mealsCount":2.5,"items":[]}',
      '{"mealsCount":2,"mealTargetOverride":0,"items":[]}',
      '{"mealsCount":2,"mealTargetOverride":"450","items":[]}',
      '{"mealsCount":2,"items":[{}]}',
      `{"mealsCount":2,"categoryPct":{"protein":100},"items":[{"food":${food},"pct":-1}]}`,
      `{"mealsCount":2,"categoryPct":{"protein":100},"items":[{"food":${food},"pct":101}]}`,
      `{"mealsCount":2,"categoryPct":{"protein":100},"items":[{"food":${food},"pct":"5"}]}`,
      // 有食材但缺該類別 %
      `{"mealsCount":2,"categoryPct":{},"items":[{"food":${food},"pct":100}]}`,
      `{"mealsCount":2,"categoryPct":{"weird":10},"items":[]}`,
      `{"mealsCount":2,"categoryPct":{"protein":120},"items":[{"food":${food},"pct":100}]}`,
      // 上一版形狀但克數非法
      '{"mealsCount":2,"items":[{"food":{"name":"a"},"role":"fixed","batchGrams":-1}]}',
      '{"mealsCount":2,"items":[{"food":{"name":"a"},"role":"fixed","gramsPerMeal":-1}]}',
      '{"mealsCount":2,"items":[{"food":{"name":"a"},"role":"fixed"}]}',
      'not json',
    ];
    for (const raw of bad) {
      storage.setItem('furlogic_batch_draft', raw);
      expect(getBatchDraft(), raw).toBeNull();
    }
  });

  it('migrates the previous gap-fill shape by re-adding foods in order', () => {
    storage.setItem(
      'furlogic_batch_draft',
      JSON.stringify({
        mealsCount: 4,
        mealTargetOverride: 400,
        inputMode: 'perMeal',
        items: [
          {
            food: { id: 1, name: '雞胸', type: 'protein' },
            role: 'main',
            batchGrams: 0,
          },
          {
            food: { id: 3, name: '南瓜', type: 'veg' },
            role: 'fixed',
            gramsPerMeal: 12.3,
          },
          {
            food: { id: 2, name: '鴨柳', type: 'protein' },
            role: 'variant',
            batchGrams: 100,
          },
          {
            food: { id: 5, name: '白飯', type: 'starch' },
            role: 'fixed',
            batchGrams: 100,
          },
        ],
      }),
    );
    expect(getBatchDraft()).toEqual({
      mealsCount: 4,
      mealTargetOverride: 400,
      categoryPct: { protein: 60, produce: 30, starch: 10 },
      items: [
        { food: { id: 1, name: '雞胸', type: 'protein' }, pct: 30 },
        { food: { id: 3, name: '南瓜', type: 'veg' }, pct: 30 },
        { food: { id: 2, name: '鴨柳', type: 'protein' }, pct: 30 },
        { food: { id: 5, name: '白飯', type: 'starch' }, pct: 10 },
      ],
    });
  });

  it('treats the old servings/grams shape as invalid (no migration)', () => {
    storage.setItem(
      'furlogic_batch_draft',
      JSON.stringify({
        servings: 4,
        vegWeightPct: 25,
        items: [{ food: { id: 1, name: '雞胸' }, grams: 1000 }],
      }),
    );
    expect(getBatchDraft()).toBeNull();
    storage.setItem(
      'furlogic_batch_draft',
      JSON.stringify({
        mealsCount: 2,
        items: [{ food: { id: 1, name: '雞胸' }, grams: 1000 }],
      }),
    );
    expect(getBatchDraft()).toBeNull();
  });

  it('removes the old meal draft key on load', () => {
    const oldKey = ['furlogic', 'meal', 'draft'].join('_');
    storage.setItem(oldKey, '{"label":"dinner","items":[]}');
    getBatchDraft();
    expect(storage.map.has(oldKey)).toBe(false);
  });
});

describe('legacy profile', () => {
  it('reads a valid profile and clears legacy keys', () => {
    storage.setItem(
      'furlogic_pet_profile',
      JSON.stringify({
        name: 'Mochi',
        weight: 10,
        isNeutered: true,
        activityLevel: 'high',
        extra: 1,
      }),
    );
    storage.setItem('furlogic_kitchen_ingredients', '[]');
    expect(readLegacyPetProfile()).toEqual({
      name: 'Mochi',
      weight: 10,
      isNeutered: true,
      activityLevel: 'high',
    });
    clearLegacyData();
    expect(readLegacyPetProfile()).toBeNull();
    expect(storage.map.size).toBe(0);
  });

  it('rejects invalid profiles', () => {
    storage.setItem('furlogic_pet_profile', '{"name":"","weight":5}');
    expect(readLegacyPetProfile()).toBeNull();
    storage.setItem('furlogic_pet_profile', '{"name":"A","weight":0}');
    expect(readLegacyPetProfile()).toBeNull();
  });
});

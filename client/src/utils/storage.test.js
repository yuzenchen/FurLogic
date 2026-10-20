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
  it('validates shape on read', () => {
    const draft = {
      mealsCount: 4,
      mealTargetOverride: 450,
      inputMode: 'perMeal',
      items: [
        { food: { id: 1, name: '雞胸' }, role: 'main', batchGrams: 0 },
        { food: { id: 3, name: '南瓜' }, role: 'fixed', batchGrams: 200 },
      ],
    };
    saveBatchDraft(draft);
    expect(getBatchDraft()).toEqual(draft);
    saveBatchDraft({ ...draft, mealTargetOverride: null });
    expect(getBatchDraft().mealTargetOverride).toBeNull();
    // 缺 mealTargetOverride 視為 null;缺 inputMode 視為 batch
    storage.setItem('furlogic_batch_draft', '{"mealsCount":2,"items":[]}');
    expect(getBatchDraft()).toEqual({
      mealsCount: 2,
      mealTargetOverride: null,
      inputMode: 'batch',
      items: [],
    });
    // 非法 inputMode → batch(不視為整份無效)
    storage.setItem(
      'furlogic_batch_draft',
      '{"mealsCount":2,"inputMode":"weird","items":[]}',
    );
    expect(getBatchDraft().inputMode).toBe('batch');
    const bad = [
      '{"items":[]}', // 缺 mealsCount
      '{"mealsCount":0,"items":[]}',
      '{"mealsCount":61,"items":[]}',
      '{"mealsCount":2.5,"items":[]}',
      '{"mealsCount":2,"mealTargetOverride":0,"items":[]}',
      '{"mealsCount":2,"mealTargetOverride":"450","items":[]}',
      '{"mealsCount":2,"items":[{}]}',
      '{"mealsCount":2,"items":[{"food":{"name":"a"},"role":"x","batchGrams":1}]}',
      '{"mealsCount":2,"items":[{"food":{"name":"a"},"role":"fixed","batchGrams":-1}]}',
      '{"mealsCount":2,"items":[{"food":{"name":"a"},"role":"fixed","batchGrams":"5"}]}',
      '{"mealsCount":2,"items":[{"food":{"name":"a"},"role":"fixed","gramsPerMeal":-1}]}',
      '{"mealsCount":2,"items":[{"food":{"name":"a"},"role":"fixed"}]}',
      'not json',
    ];
    for (const raw of bad) {
      storage.setItem('furlogic_batch_draft', raw);
      expect(getBatchDraft(), raw).toBeNull();
    }
  });

  it('migrates the previous gramsPerMeal shape to batchGrams = gramsPerMeal × mealsCount', () => {
    storage.setItem(
      'furlogic_batch_draft',
      JSON.stringify({
        mealsCount: 4,
        items: [
          { food: { id: 1, name: '雞胸' }, role: 'main', gramsPerMeal: 0 },
          { food: { id: 3, name: '南瓜' }, role: 'fixed', gramsPerMeal: 12.3 },
          // 兩者皆有時以 batchGrams 為準
          {
            food: { id: 2, name: '鯖魚' },
            role: 'variant',
            gramsPerMeal: 65,
            batchGrams: 100,
          },
        ],
      }),
    );
    expect(getBatchDraft()).toEqual({
      mealsCount: 4,
      mealTargetOverride: null,
      inputMode: 'batch',
      items: [
        { food: { id: 1, name: '雞胸' }, role: 'main', batchGrams: 0 },
        { food: { id: 3, name: '南瓜' }, role: 'fixed', batchGrams: 49.2 },
        { food: { id: 2, name: '鯖魚' }, role: 'variant', batchGrams: 100 },
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

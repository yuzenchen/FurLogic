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
      servings: 4,
      vegWeightPct: 25,
      items: [{ food: { id: 1, name: '雞胸' }, grams: 1000 }],
    };
    saveBatchDraft(draft);
    expect(getBatchDraft()).toEqual(draft);
    saveBatchDraft({ ...draft, servings: null });
    expect(getBatchDraft().servings).toBeNull();
    storage.setItem('furlogic_batch_draft', '{"items":[]}');
    // 舊草稿沒有 vegWeightPct → 補預設 20
    expect(getBatchDraft()).toEqual({
      servings: null,
      vegWeightPct: 20,
      items: [],
    });
    storage.setItem('furlogic_batch_draft', '{"servings":0,"items":[]}');
    expect(getBatchDraft()).toBeNull();
    storage.setItem('furlogic_batch_draft', '{"servings":2,"items":[{}]}');
    expect(getBatchDraft()).toBeNull();
    storage.setItem('furlogic_batch_draft', 'not json');
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

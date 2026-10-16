import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLegacyData,
  getActiveTab,
  getMealDraft,
  readLegacyPetProfile,
  saveActiveTab,
  saveMealDraft,
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
  it('defaults to today and migrates legacy values', () => {
    expect(getActiveTab()).toBe('today');
    storage.setItem('furlogic_active_tab', '"kitchen"');
    expect(getActiveTab()).toBe('log');
    storage.setItem('furlogic_active_tab', 'search');
    expect(getActiveTab()).toBe('foods');
    storage.setItem('furlogic_active_tab', 'bogus');
    expect(getActiveTab()).toBe('today');
  });

  it('round-trips valid tabs and ignores invalid ones', () => {
    saveActiveTab('history');
    expect(getActiveTab()).toBe('history');
    saveActiveTab('nope');
    expect(getActiveTab()).toBe('history');
  });

  it('survives a throwing localStorage', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('denied');
      },
    });
    expect(getActiveTab()).toBe('today');
    expect(() => saveActiveTab('log')).not.toThrow();
  });
});

describe('meal draft', () => {
  it('validates shape on read', () => {
    const draft = {
      label: 'dinner',
      items: [{ food: { id: 'chicken', name: '雞胸' }, grams: 120 }],
    };
    saveMealDraft(draft);
    expect(getMealDraft()).toEqual(draft);
    storage.setItem('furlogic_meal_draft', '{"label":"x","items":[{}]}');
    expect(getMealDraft()).toBeNull();
    storage.setItem('furlogic_meal_draft', 'not json');
    expect(getMealDraft()).toBeNull();
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

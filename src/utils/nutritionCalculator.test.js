import { describe, it, expect } from 'vitest';
import {
  calculateRER,
  calculateDER,
  calculateActivityFactor,
  calculateWaterNeed,
  analyzeCaPRatio,
  generateRecipe,
} from './nutritionCalculator';

describe('calculateRER', () => {
  it('handles a 12 kg dog', () => {
    // 70 * 12^0.75 ≈ 451.38 -> 451
    expect(calculateRER(12)).toBe(451);
  });

  it('handles a 5 kg dog', () => {
    // 70 * 5^0.75 = 234.07 -> 234
    expect(calculateRER(5)).toBe(234);
  });
});

describe('calculateActivityFactor', () => {
  it('neutered + normal = 1.6', () => {
    expect(calculateActivityFactor(true, 'normal')).toBeCloseTo(1.6);
  });
  it('intact + normal = 1.8', () => {
    expect(calculateActivityFactor(false, 'normal')).toBeCloseTo(1.8);
  });
  it('neutered + low = 1.4', () => {
    expect(calculateActivityFactor(true, 'low')).toBeCloseTo(1.4);
  });
  it('intact + high = 2.2', () => {
    expect(calculateActivityFactor(false, 'high')).toBeCloseTo(2.2);
  });
});

describe('calculateDER', () => {
  it('rounds to integer', () => {
    expect(calculateDER(451, 1.6)).toBe(722);
  });
});

describe('calculateWaterNeed', () => {
  it('60 ml per kg', () => {
    expect(calculateWaterNeed(12)).toBe(720);
  });
});

describe('analyzeCaPRatio', () => {
  it('marks low when ratio < 1', () => {
    const r = analyzeCaPRatio(50, 200);
    expect(r.status).toBe('low');
  });
  it('marks good when 1 <= ratio <= 2', () => {
    const r = analyzeCaPRatio(150, 100);
    expect(r.status).toBe('good');
  });
  it('marks high when ratio > 2', () => {
    const r = analyzeCaPRatio(300, 100);
    expect(r.status).toBe('high');
  });
  it('handles zero phosphorus', () => {
    const r = analyzeCaPRatio(50, 0);
    expect(r.status).toBe('unknown');
    expect(r.ratio).toBe(0);
  });
});

describe('generateRecipe', () => {
  const chicken = {
    id: 1,
    name: 'chicken',
    type: 'protein',
    calories: 100,
    ca: 5,
    p: 200,
  };
  const pumpkin = {
    id: 2,
    name: 'pumpkin',
    type: 'veg',
    calories: 26,
    ca: 21,
    p: 44,
  };

  it('70/30 split when meat present', () => {
    const r = generateRecipe([chicken, pumpkin], 1000);
    const chickenItem = r.items.find((i) => i.name === 'chicken');
    const pumpkinItem = r.items.find((i) => i.name === 'pumpkin');
    // 70% of 1000 = 700 kcal of chicken @100 kcal/100g = 700g
    expect(chickenItem.amount).toBe(700);
    // 30% = 300 kcal of pumpkin @26 kcal/100g = 1154g
    expect(pumpkinItem.amount).toBe(1154);
  });

  it('100% to plants when no meat', () => {
    const r = generateRecipe([pumpkin], 260);
    expect(r.items[0].amount).toBe(1000); // 260 kcal / 26 * 100 = 1000g
  });

  it('flags low Ca:P and adds eggshell powder', () => {
    const r = generateRecipe([chicken], 1000);
    expect(r.analysis.status).toBe('low');
    expect(r.supplements.find((s) => s.name === '蛋殼粉')).toBeTruthy();
  });

  it('always includes fish oil', () => {
    const r = generateRecipe([pumpkin], 100);
    expect(r.supplements.find((s) => s.name === '魚油')).toBeTruthy();
  });

  it('respects recipeRole over type for category split', () => {
    // type=protein but recipeRole=plant → treat as plant
    const oddCase = { ...chicken, recipeRole: 'plant' };
    const r = generateRecipe([oddCase, pumpkin], 1000);
    // No protein items → all 1000 kcal split between two plants (500 each)
    const oddItem = r.items.find((i) => i.id === oddCase.id);
    expect(oddItem.amount).toBe(500); // 500 kcal / 100 * 100 = 500g
  });
});

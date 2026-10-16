import { describe, expect, it } from 'vitest';
import {
  formatDateKey,
  formatKcal,
  timeOfEatenAt,
  weekdayShort,
} from './format';

describe('formatDateKey / weekdayShort', () => {
  it('formats month, day and weekday', () => {
    expect(formatDateKey('2026-10-16')).toBe('10月16日 週五');
    expect(weekdayShort('2026-10-18')).toBe('日');
    expect(weekdayShort('2026-10-19')).toBe('一');
  });

  it('handles month and year boundaries', () => {
    expect(formatDateKey('2026-02-28')).toBe('2月28日 週六');
    expect(formatDateKey('2026-03-01')).toBe('3月1日 週日');
    expect(formatDateKey('2025-12-31')).toBe('12月31日 週三');
    expect(formatDateKey('2026-01-01')).toBe('1月1日 週四');
    expect(formatDateKey('2024-02-29')).toBe('2月29日 週四');
  });

  it('tolerates invalid input', () => {
    expect(weekdayShort('nope')).toBe('');
    expect(formatDateKey('nope')).toBe('nope');
    expect(formatDateKey(undefined)).toBe('');
  });
});

describe('timeOfEatenAt', () => {
  it('uses the wall clock written in the string', () => {
    expect(timeOfEatenAt('2026-10-16T23:45:10+08:00')).toBe('23:45');
    expect(timeOfEatenAt('2026-10-16T00:05:00.000Z')).toBe('00:05');
    expect(timeOfEatenAt('bad')).toBe('');
    expect(timeOfEatenAt(null)).toBe('');
  });
});

describe('formatKcal', () => {
  it('rounds and adds thousands separators', () => {
    expect(formatKcal(812.6)).toBe('813');
    expect(formatKcal(12345.4)).toBe('12,345');
    expect(formatKcal(0)).toBe('0');
    expect(formatKcal(NaN)).toBe('0');
  });
});

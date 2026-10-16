import { describe, expect, it } from 'vitest';
import { groupMealsByDate, summarizeWeek } from './weekSummary';

describe('summarizeWeek', () => {
  it('averages only days with records and counts met days', () => {
    const series = [
      { dateKey: '2026-10-10', calories: 0, count: 0 },
      { dateKey: '2026-10-11', calories: 1000, count: 2 },
      { dateKey: '2026-10-12', calories: 500, count: 1 },
      { dateKey: '2026-10-13', calories: 1200, count: 3 },
      { dateKey: '2026-10-14', calories: 951, count: 2 },
    ];
    expect(summarizeWeek(series, 1000)).toEqual({
      average: 913, // (1000+500+1200+951)/4 = 912.75
      daysWithRecords: 4,
      metDays: 2,
    });
  });

  it('returns zeros for an empty week', () => {
    expect(summarizeWeek([], 1000)).toEqual({
      average: 0,
      daysWithRecords: 0,
      metDays: 0,
    });
    expect(summarizeWeek(null, 1000).average).toBe(0);
  });
});

describe('groupMealsByDate', () => {
  it('groups newest date first and sums calories', () => {
    const meals = [
      { id: 'a', dateKey: '2026-10-15', totals: { calories: 300 } },
      { id: 'b', dateKey: '2026-10-16', totals: { calories: 200 } },
      { id: 'c', dateKey: '2026-10-15', totals: { calories: 150 } },
      { id: 'd', dateKey: '2025-12-31', totals: { calories: 100 } },
    ];
    const groups = groupMealsByDate(meals);
    expect(groups.map((g) => g.dateKey)).toEqual([
      '2026-10-16',
      '2026-10-15',
      '2025-12-31',
    ]);
    expect(groups[1].meals.map((m) => m.id)).toEqual(['a', 'c']);
    expect(groups[1].totalCalories).toBe(450);
  });

  it('handles empty input', () => {
    expect(groupMealsByDate([])).toEqual([]);
    expect(groupMealsByDate(null)).toEqual([]);
  });
});

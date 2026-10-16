import { dailyStatus } from '@furlogic/shared';

/**
 * 一週統計:平均(只算有紀錄的日子,四捨五入)、有紀錄天數、達標天數。
 * @param {Array<{dateKey: string, calories: number, count: number}>} series
 * @param {number} der
 */
export const summarizeWeek = (series = [], der = 0) => {
  const recorded = (series ?? []).filter((d) => d && d.count > 0);
  const total = recorded.reduce((sum, d) => sum + (d.calories ?? 0), 0);
  return {
    average: recorded.length > 0 ? Math.round(total / recorded.length) : 0,
    daysWithRecords: recorded.length,
    metDays: recorded.filter(
      (d) => dailyStatus(d.calories ?? 0, der).status === 'met',
    ).length,
  };
};

/**
 * 依 dateKey 分組,日期新到舊;組內維持輸入順序(API 已是新到舊)。
 * @returns {Array<{ dateKey: string, meals: object[], totalCalories: number }>}
 */
export const groupMealsByDate = (meals = []) => {
  const groups = new Map();
  (meals ?? []).forEach((meal) => {
    if (!meal?.dateKey) return;
    let group = groups.get(meal.dateKey);
    if (!group) {
      group = { dateKey: meal.dateKey, meals: [], totalCalories: 0 };
      groups.set(meal.dateKey, group);
    }
    group.meals.push(meal);
    group.totalCalories += meal.totals?.calories ?? 0;
  });
  return Array.from(groups.values()).sort((a, b) =>
    a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0,
  );
};

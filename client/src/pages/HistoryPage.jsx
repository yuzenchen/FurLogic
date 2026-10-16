import React, { useMemo, useState } from 'react';
import { BarChart3, Plus } from 'lucide-react';
import {
  DAILY_STATUS_LABELS,
  addDays,
  dailyStatus,
  toDateKey,
} from '@furlogic/shared';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Stat,
  StatusBadge,
} from '../components/ui';
import MealRow from '../components/history/MealRow';
import MealDetailSheet from '../components/history/MealDetailSheet';
import WeeklyBarChart from '../components/history/WeeklyBarChart';
import {
  groupMealsByDate,
  summarizeWeek,
} from '../components/history/weekSummary';
import { usePet } from '../context/PetContext';
import { useNav } from '../context/NavContext';
import useDailyStats from '../hooks/useDailyStats';
import useMeals from '../hooks/useMeals';
import { formatDateKey, formatKcal } from '../utils/format';

const Loading = () => (
  <p className="py-10 text-center text-sm text-stone-600" role="status">
    載入中…
  </p>
);

/** 紀錄:近 7 天長條圖 + 近 30 天餐點 */
export default function HistoryPage() {
  const { pet, metrics } = usePet();
  const { setTab } = useNav();
  const der = metrics?.der ?? 0;
  const todayKey = toDateKey(new Date());

  const stats = useDailyStats({ petId: pet?.id, days: 7, today: todayKey });
  const meals = useMeals({
    petId: pet?.id,
    from: addDays(todayKey, -29),
    to: todayKey,
  });
  const [openMeal, setOpenMeal] = useState(null);

  const summary = useMemo(
    () => summarizeWeek(stats.data ?? [], der),
    [stats.data, der],
  );
  const groups = useMemo(
    () => groupMealsByDate(meals.data ?? []),
    [meals.data],
  );

  const refetchAll = () => {
    meals.refetch();
    stats.refetch();
  };

  const statsReady = stats.data != null;
  const mealsReady = meals.data != null;
  const noRecords = mealsReady && groups.length === 0;

  return (
    <>
      <PageHeader title="紀錄" subtitle="最近 7 天" />

      <div className="space-y-6">
        {!statsReady && stats.loading && <Loading />}
        {!statsReady && !stats.loading && stats.error && (
          <ErrorState message={stats.error.message} onRetry={stats.refetch} />
        )}
        {statsReady && (
          <Card>
            <WeeklyBarChart series={stats.data} der={der} today={todayKey} />
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-stone-100">
              <Stat
                label="平均每日"
                value={formatKcal(summary.average)}
                unit="kcal"
                hint={`${summary.daysWithRecords} 天有紀錄`}
              />
              <Stat
                label="達標天數"
                value={`${summary.metDays} / ${stats.data.length}`}
              />
              <Stat label="目標" value={formatKcal(der)} unit="kcal" />
            </div>
          </Card>
        )}

        {!mealsReady && meals.loading && <Loading />}
        {!mealsReady && !meals.loading && meals.error && (
          <ErrorState message={meals.error.message} onRetry={meals.refetch} />
        )}
        {mealsReady && meals.error && (
          <p role="alert" className="text-sm text-rose-700">
            更新失敗:{meals.error.message}
          </p>
        )}

        {noRecords && (
          <EmptyState
            icon={BarChart3}
            title="還沒有任何紀錄"
            action={
              <Button icon={Plus} onClick={() => setTab('log')}>
                記一餐
              </Button>
            }
          />
        )}

        {mealsReady &&
          groups.map((group) => {
            const { status } = dailyStatus(group.totalCalories, der);
            const headingId = `history-day-${group.dateKey}`;
            return (
              <section key={group.dateKey} aria-labelledby={headingId}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2
                    id={headingId}
                    className="text-base font-semibold text-stone-900"
                  >
                    {formatDateKey(group.dateKey)}
                  </h2>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-stone-600 tabular-nums">
                      合計 {formatKcal(group.totalCalories)} kcal
                    </span>
                    <StatusBadge status={status}>
                      {DAILY_STATUS_LABELS[status]}
                    </StatusBadge>
                  </div>
                </div>
                <ul className="space-y-2">
                  {group.meals.map((meal) => (
                    <li key={meal.id}>
                      <MealRow meal={meal} onOpen={setOpenMeal} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
      </div>

      <MealDetailSheet
        meal={openMeal}
        onClose={() => setOpenMeal(null)}
        onDeleted={refetchAll}
      />
    </>
  );
}

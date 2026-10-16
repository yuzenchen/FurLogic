import React, { useState } from 'react';
import { Plus, Utensils } from 'lucide-react';
import { DAILY_STATUS_LABELS, dailyStatus, toDateKey } from '@furlogic/shared';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressRing,
  Stat,
  StatusBadge,
} from '../components/ui';
import MealRow from '../components/history/MealRow';
import MealDetailSheet from '../components/history/MealDetailSheet';
import { usePet } from '../context/PetContext';
import { useNav } from '../context/NavContext';
import useMeals from '../hooks/useMeals';
import { formatDateKey, formatKcal } from '../utils/format';

const RING_TONE = { under: 'orange', met: 'emerald', over: 'rose' };

const statusText = (status, eaten, der) => {
  if (status === 'over') return `超過 ${formatKcal(eaten - der)} kcal`;
  if (status === 'met')
    return `已達標・剩 ${formatKcal(Math.max(0, der - eaten))} kcal`;
  return `還差 ${formatKcal(der - eaten)} kcal`;
};

/** 今日:熱量環 + 指標 + 今天的餐次 */
export default function TodayPage() {
  const { pet, metrics } = usePet();
  const { setTab } = useNav();
  const todayKey = toDateKey(new Date());
  const { data, loading, error, refetch } = useMeals({
    petId: pet?.id,
    from: todayKey,
    to: todayKey,
  });
  const [openMeal, setOpenMeal] = useState(null);

  const meals = data ?? [];
  const der = metrics?.der ?? 0;
  const eaten = meals.reduce((sum, m) => sum + (m.totals?.calories ?? 0), 0);
  const { ratio, status } = dailyStatus(eaten, der);
  const percent = Math.round(ratio * 100);
  const hasData = data != null;

  return (
    <>
      <PageHeader title="今日" subtitle={formatDateKey(todayKey)} />

      {!hasData && loading && (
        <p className="py-10 text-center text-sm text-stone-600" role="status">
          載入中…
        </p>
      )}

      {!hasData && !loading && error && (
        <ErrorState message={error.message} onRetry={refetch} />
      )}

      {hasData && (
        <div className="space-y-4">
          <Card padding="p-5" className="flex flex-col items-center">
            <ProgressRing
              // 達標區間可到 110%;ProgressRing 超過 max 會自動轉 rose,
              // 因此達標時把值夾在 der,讓環維持 emerald 並畫滿
              value={status === 'met' ? Math.min(eaten, der) : eaten}
              max={der}
              size={200}
              stroke={16}
              tone={RING_TONE[status]}
              label={`今日已吃 ${formatKcal(eaten)} / ${formatKcal(der)} kcal,${DAILY_STATUS_LABELS[status]}`}
            >
              <span className="text-4xl font-bold text-stone-900 tabular-nums">
                {formatKcal(eaten)}
              </span>
              <span className="text-sm text-stone-600 tabular-nums">
                / {formatKcal(der)} kcal
              </span>
            </ProgressRing>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <StatusBadge status={status}>
                {DAILY_STATUS_LABELS[status]}
              </StatusBadge>
              <span className="text-sm font-semibold text-stone-800 tabular-nums">
                {statusText(status, eaten, der)}
              </span>
              <span className="text-sm text-stone-600 tabular-nums">
                {percent}%
              </span>
            </div>
          </Card>

          <Card>
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="單餐目標"
                value={formatKcal(metrics?.mealTarget)}
                unit="kcal"
              />
              <Stat
                label="已記餐數"
                value={`${meals.length} / ${metrics?.mealsPerDay ?? '-'}`}
                unit="餐"
              />
              <Stat
                label="建議飲水"
                value={formatKcal(metrics?.waterNeed)}
                unit="ml"
              />
            </div>
            <p className="mt-3 text-xs text-stone-600 tabular-nums">
              RER {formatKcal(metrics?.rer)} kcal・活動係數 ×{metrics?.factor}
              ・DER {formatKcal(der)} kcal
            </p>
          </Card>

          <Button size="lg" block icon={Plus} onClick={() => setTab('log')}>
            記一餐
          </Button>

          <section aria-labelledby="today-meals-heading">
            <h2
              id="today-meals-heading"
              className="text-base font-semibold text-stone-900 mb-2"
            >
              今天的餐次
            </h2>
            {error && (
              <p role="alert" className="mb-2 text-sm text-rose-700">
                更新失敗:{error.message}
              </p>
            )}
            {meals.length === 0 ? (
              <EmptyState
                icon={Utensils}
                title="今天還沒有紀錄"
                description="記下第一餐吧"
              />
            ) : (
              <ul className="space-y-2">
                {meals.map((meal) => (
                  <li key={meal.id}>
                    <MealRow meal={meal} onOpen={setOpenMeal} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <MealDetailSheet
        meal={openMeal}
        onClose={() => setOpenMeal(null)}
        onDeleted={refetch}
      />
    </>
  );
}

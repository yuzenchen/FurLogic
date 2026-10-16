import React from 'react';
import { DAILY_STATUS_LABELS, dailyStatus } from '@furlogic/shared';
import { StatusBadge } from '../ui';

/**
 * 黏在頁面頂端的本餐熱量列:目前 / 目標 kcal、進度條、狀態膠囊。
 * current、targetRaw 為未四捨五入的 kcal;狀態規則同每日(90–110% 為達標)。
 */
export default function MealTargetBar({ current, target, targetRaw }) {
  const { status } = dailyStatus(current, targetRaw);
  const pct = targetRaw > 0 ? Math.min(100, (current / targetRaw) * 100) : 0;
  const shown = Math.round(current);

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 bg-cream/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-stone-800 tabular-nums">
          本餐{' '}
          <span className="text-lg font-semibold text-stone-900">{shown}</span>{' '}
          / 目標 {target} kcal
        </p>
        <StatusBadge status={status}>{DAILY_STATUS_LABELS[status]}</StatusBadge>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-label="本餐熱量進度"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(shown, target)}
        aria-valuetext={`${shown} / ${target} kcal`}
      >
        <div
          className="h-full rounded-full bg-orange-500 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

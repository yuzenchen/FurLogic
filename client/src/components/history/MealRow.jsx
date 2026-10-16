import React from 'react';
import { ChevronRight } from 'lucide-react';
import { MEAL_LABELS } from '@furlogic/shared';
import { FOCUS_RING, cx } from '../ui';
import { formatKcal, timeOfEatenAt } from '../../utils/format';

/** 一餐的摘要列;點擊開啟明細 */
export default function MealRow({ meal, onOpen }) {
  const label = MEAL_LABELS[meal.label] ?? meal.label;
  const time = timeOfEatenAt(meal.eatenAt);
  const names = (meal.items ?? []).map((item) => item.name).join('、');
  const kcal = formatKcal(meal.totals?.calories);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(meal)}
      aria-label={`${label} ${time},${names},${kcal} kcal,查看明細`}
      className={cx(
        'w-full min-h-11 flex items-center gap-3 px-4 py-3 text-left',
        'bg-white rounded-2xl border border-stone-200 shadow-sm hover:bg-stone-50 transition-colors',
        FOCUS_RING,
      )}
    >
      <span className="shrink-0 flex flex-col">
        <span className="font-semibold text-stone-900">{label}</span>
        <span className="text-xs text-stone-600 tabular-nums">{time}</span>
      </span>
      <span className="flex-1 min-w-0 truncate text-sm text-stone-600">
        {names}
      </span>
      <span className="shrink-0 text-sm font-semibold text-stone-900 tabular-nums">
        {kcal} kcal
      </span>
      <ChevronRight
        size={18}
        className="shrink-0 text-stone-500"
        aria-hidden="true"
      />
    </button>
  );
}

import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { MEAL_LABELS, analyzeMeal } from '@furlogic/shared';
import { BottomSheet, Button } from '../ui';
import CaPRatioGauge from '../log/CaPRatioGauge';
import MacroBars from '../log/MacroBars';
import { deleteMeal } from '../../api/client';
import { formatDateKey, formatKcal, timeOfEatenAt } from '../../utils/format';

const itemKcal = (item) =>
  Math.round(((item.calories ?? 0) * (item.grams ?? 0)) / 100);

function DeleteFooter({ mealId, onDeleted, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMeal(mealId);
      onDeleted?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || '刪除失敗,請稍後再試');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-stone-900">
            確定刪除?此動作無法復原
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              block
              disabled={deleting}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
            >
              取消
            </Button>
            <Button
              variant="danger"
              block
              loading={deleting}
              onClick={handleDelete}
            >
              刪除
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="danger"
          block
          icon={Trash2}
          onClick={() => setConfirming(true)}
        >
          刪除這餐
        </Button>
      )}
    </div>
  );
}

/**
 * 單餐明細抽屜。meal 為 null 時關閉。
 * 刪除成功後呼叫 onDeleted() 再 onClose()。
 */
export default function MealDetailSheet({ meal, onClose, onDeleted }) {
  const result = useMemo(
    () => (meal ? analyzeMeal(meal.items ?? []) : null),
    [meal],
  );

  if (!meal) return null;

  const label = MEAL_LABELS[meal.label] ?? meal.label;
  const totals = meal.totals ?? {};

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`${label} · ${timeOfEatenAt(meal.eatenAt)}`}
      footer={
        <DeleteFooter
          key={meal.id}
          mealId={meal.id}
          onDeleted={onDeleted}
          onClose={onClose}
        />
      }
    >
      <p className="text-sm text-stone-600 -mt-1 mb-4">
        {formatDateKey(meal.dateKey)}
      </p>

      <ul className="divide-y divide-stone-100 border-y border-stone-100">
        {(meal.items ?? []).map((item, i) => (
          <li
            key={item.id ?? i}
            className="flex items-center gap-3 py-2.5 text-sm"
          >
            <span className="flex-1 min-w-0 truncate text-stone-900">
              {item.name}
            </span>
            <span className="shrink-0 text-stone-600 tabular-nums">
              {item.grams} g
            </span>
            <span className="shrink-0 w-20 text-right font-semibold text-stone-900 tabular-nums">
              {formatKcal(itemKcal(item))} kcal
            </span>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-4 gap-2 mt-4 mb-4">
        {[
          ['熱量', formatKcal(totals.calories), 'kcal'],
          ['蛋白質', totals.protein ?? 0, 'g'],
          ['脂肪', totals.fat ?? 0, 'g'],
          ['克數', totals.grams ?? 0, 'g'],
        ].map(([name, value, unit]) => (
          <div key={name} className="min-w-0">
            <dt className="text-xs text-stone-600">{name}</dt>
            <dd className="font-semibold text-stone-900 tabular-nums">
              {value}
              <span className="ml-0.5 text-xs font-normal text-stone-600">
                {unit}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="space-y-4">
        <CaPRatioGauge analysis={result.analysis} />
        <MacroBars macros={result.macros} actualCalories={totals.calories} />
        {meal.note && (
          <div>
            <h3 className="text-sm font-semibold text-stone-900">備註</h3>
            <p className="text-sm text-stone-600 mt-1 whitespace-pre-wrap break-words">
              {meal.note}
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

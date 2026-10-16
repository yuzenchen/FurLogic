import React, { useState } from 'react';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import { FOOD_TYPES } from '@furlogic/shared';
import { Button, Card } from '../ui';
import SafetyBadge from './SafetyBadge';
import SourceBadge from './SourceBadge';
import useTwoStepConfirm from './useTwoStepConfirm';

const fmt = (v) => (Number.isFinite(v) ? v : '–');

/**
 * 食材卡片。onAdd:加入這餐;onEdit / onDelete 只對非內建食材顯示。
 * onDelete 回傳 Promise,失敗時在卡片內顯示錯誤。
 */
export default function FoodCard({ food, onAdd, onEdit, onDelete }) {
  const { confirming, request, reset } = useTwoStepConfirm();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const isToxic = food.safety === 'toxic';
  const isCustom = !food.isBuiltin;

  const handleDelete = async () => {
    if (!confirming) {
      request();
      return;
    }
    reset();
    setDeleting(true);
    setError(null);
    try {
      await onDelete?.(food);
    } catch (err) {
      setError(err?.message || '刪除失敗');
      setDeleting(false);
    }
  };

  return (
    <Card as="article" aria-label={food.name}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-stone-900 break-words">
            {food.name}
          </h3>
          <p className="text-xs text-stone-600">
            {FOOD_TYPES[food.type] ?? food.type}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {isCustom && <SourceBadge source={food.source} compact />}
          <SafetyBadge safety={food.safety} />
        </div>
      </div>

      <p className="mt-2 text-sm text-stone-800 tabular-nums">
        每 100g:{fmt(food.calories)} kcal · 蛋白質 {fmt(food.protein)} g · 鈣{' '}
        {fmt(food.ca)} mg · 磷 {fmt(food.p)} mg
      </p>

      {food.description && (
        <p className="mt-1 text-sm text-stone-600">{food.description}</p>
      )}

      {food.warning && (
        <p
          className={`mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
            isToxic ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          {food.warning}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isToxic ? (
          <Button variant="secondary" icon={Plus} disabled>
            不可食用
          </Button>
        ) : (
          <Button variant="secondary" icon={Plus} onClick={() => onAdd?.(food)}>
            加入這餐
          </Button>
        )}
        {isCustom && (
          <>
            <Button
              variant="ghost"
              icon={Pencil}
              onClick={() => onEdit?.(food)}
            >
              編輯
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              loading={deleting}
              onClick={handleDelete}
              onBlur={reset}
              className="ml-auto"
            >
              {confirming ? '確定刪除?' : '刪除'}
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}
    </Card>
  );
}

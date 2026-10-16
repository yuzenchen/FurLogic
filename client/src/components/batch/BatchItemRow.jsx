import React, { useEffect, useState } from 'react';
import { Drumstick, Leaf, Minus, Plus, Trash2 } from 'lucide-react';
import { FOCUS_RING, cx } from '../ui';
import { isVegetable } from '@furlogic/shared';
import { BUMP_STEP } from '../../utils/batchDraft';

const ICON_BUTTON = cx(
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed',
  FOCUS_RING,
);

const gramsText = (grams) => (grams > 0 ? String(grams) : '');

/**
 * 整鍋中的一項食材:圖示、名稱、每 100g 熱量、警語、整鍋克數調整、本項熱量。
 * 蔬菜不計熱量,改顯示「不計熱量」。
 * 輸入框保留使用者正在打的字串(例如「12.」),只在外部改變克數時同步。
 */
export default function BatchItemRow({ item, onSetGrams, onBump, onRemove }) {
  const { food, grams } = item;
  const [text, setText] = useState(() => gramsText(grams));

  useEffect(() => {
    setText((current) => {
      const parsed = Number(current);
      const same =
        (current.trim() === '' && grams === 0) ||
        (Number.isFinite(parsed) && parsed === grams);
      return same ? current : gramsText(grams);
    });
  }, [grams]);

  const isProtein = food.recipeRole === 'protein';
  const RoleIcon = isProtein ? Drumstick : Leaf;
  const isVeg = isVegetable(food);
  const kcal = isVeg ? 0 : Math.round(((food.calories ?? 0) * grams) / 100);

  const handleChange = (e) => {
    const value = e.target.value.replace(',', '.');
    setText(value);
    onSetGrams(food.id, value.trim() === '' ? 0 : Number(value));
  };

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <RoleIcon
          size={20}
          className={cx(
            'mt-0.5 shrink-0',
            isProtein ? 'text-orange-500' : 'text-emerald-600',
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-stone-900 break-words">
            {food.name}
          </p>
          <p className="text-xs text-stone-600 tabular-nums">
            {isVeg ? '蔬菜 · 不計熱量' : `${food.calories ?? 0} kcal/100g`}
          </p>
          {food.safety === 'caution' && food.warning && (
            <p className="mt-0.5 text-xs text-amber-700">{food.warning}</p>
          )}
        </div>
        {!isVeg && (
          <p className="shrink-0 text-sm font-semibold text-stone-900 tabular-nums">
            {kcal}
            <span className="ml-0.5 text-xs font-normal text-stone-600">
              kcal
            </span>
          </p>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1 pl-8">
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => onBump(food.id, -BUMP_STEP)}
          aria-label={`${food.name} 減少 ${BUMP_STEP} 克`}
          disabled={grams <= 0}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          placeholder="0"
          onChange={handleChange}
          onBlur={() => setText(gramsText(grams))}
          aria-label={`${food.name} 整鍋克數`}
          className={cx(
            'h-11 w-20 rounded-xl border border-stone-300 bg-white px-3 text-right text-stone-900 tabular-nums',
            FOCUS_RING,
          )}
        />
        <span className="text-sm text-stone-600" aria-hidden="true">
          g
        </span>
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => onBump(food.id, BUMP_STEP)}
          aria-label={`${food.name} 增加 ${BUMP_STEP} 克`}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cx(
            ICON_BUTTON,
            'ml-auto text-stone-600 hover:text-rose-700',
          )}
          onClick={() => onRemove(food.id)}
          aria-label={`移除 ${food.name}`}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

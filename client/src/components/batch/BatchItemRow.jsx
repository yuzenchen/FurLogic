import React, { useEffect, useState } from 'react';
import {
  Beef,
  Drumstick,
  Fish,
  Leaf,
  Minus,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';
import { FOCUS_RING, cx } from '../ui';
import { ITEM_ROLES, ITEM_ROLE_LABELS, isVegetable } from '@furlogic/shared';
import { BUMP_STEP_BATCH, BUMP_STEP_PER_MEAL } from '../../utils/batchDraft';

const ICON_BUTTON = cx(
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed',
  FOCUS_RING,
);

const gramsText = (grams) => (grams > 0 ? String(grams) : '');
const round1 = (n) => Math.round(n * 10) / 10;

/** 角色圖示:主力 Drumstick(橘)、替換 Beef / Fish(高脂魚)、固定 Leaf;蔬菜一律 Leaf */
const roleIcon = (food, role) => {
  if (isVegetable(food)) return { Icon: Leaf, tone: 'text-emerald-600' };
  if (role === 'main') return { Icon: Drumstick, tone: 'text-orange-500' };
  if (role === 'variant') {
    return {
      Icon: food.subtype === 'fatty_fish' ? Fish : Beef,
      tone: 'text-stone-700',
    };
  }
  return { Icon: Leaf, tone: 'text-emerald-600' };
};

/**
 * 食材的一列:角色圖示、名稱、kcal/100g、警語、本餐 kcal;
 * 角色選單 + 克數控制:inputMode 'batch' 輸入採買總量(±50,右側顯示每餐克數);
 * 'perMeal' 輸入每餐克數(= batchGrams ÷ mealsCount,±10,右側顯示共買總量);
 * 主力不輸入,兩種模式都顯示自動補齊的每餐克數與要買的總量。
 * 輸入框保留使用者正在打的字串(例如「12.」),只在外部改變克數時同步。
 * @param {object} item 草稿項目 { food, role, batchGrams }
 * @param {'batch'|'perMeal'} inputMode 輸入模式
 * @param {number} mealsCount 餐數(perMeal 模式換算用)
 * @param {object} [planItem] planGapFill 回傳的同一項(含反推後的 gramsPerMeal、batchGrams、kcalPerMeal)
 * @param {object} [capWarning] 該列所屬類別的每餐上限警告 { grams, cap, label }
 */
export default function BatchItemRow({
  item,
  planItem,
  capWarning,
  inputMode = 'batch',
  mealsCount = 1,
  onSetRole,
  onSetBatchGrams,
  onSetGramsPerMeal,
  onBump,
  onRemove,
}) {
  const { food, role } = item;
  const isMain = role === 'main';
  const isPerMeal = inputMode === 'perMeal';
  const batchGrams = item.batchGrams;
  // 輸入框顯示的值:batch 模式為採買總量;perMeal 模式為換算後的每餐克數
  const grams = isPerMeal
    ? round1(batchGrams / Math.max(1, mealsCount))
    : batchGrams;
  const step = isPerMeal ? BUMP_STEP_PER_MEAL : BUMP_STEP_BATCH;
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

  const isVeg = isVegetable(food);
  const { Icon, tone } = roleIcon(food, role);
  const kcal = planItem?.kcalPerMeal ?? 0;
  const perMealGrams = planItem?.gramsPerMeal ?? 0;
  const planBatchGrams = planItem?.batchGrams ?? 0;

  const handleChange = (e) => {
    const value = e.target.value.replace(',', '.');
    setText(value);
    const n = value.trim() === '' ? 0 : Number(value);
    if (isPerMeal) onSetGramsPerMeal(food.id, n);
    else onSetBatchGrams(food.id, n);
  };

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <Icon
          size={20}
          className={cx('mt-0.5 shrink-0', tone)}
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
        {/* 移除鈕放第一行,第二行才塞得下角色選單 + 步進器(390px) */}
        <button
          type="button"
          className={cx(
            ICON_BUTTON,
            '-mt-2 -mr-2 text-stone-600 hover:text-rose-700',
          )}
          onClick={() => onRemove(food.id)}
          aria-label={`移除 ${food.name}`}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1 pl-8">
        <select
          value={role}
          onChange={(e) => onSetRole(food.id, e.target.value)}
          aria-label={`${food.name} 角色`}
          className={cx(
            'h-11 rounded-xl border border-stone-300 bg-white px-2 text-sm text-stone-900',
            FOCUS_RING,
          )}
        >
          {ITEM_ROLES.map((value) => (
            <option key={value} value={value}>
              {ITEM_ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        {isMain ? (
          <p
            className={cx(
              'ml-1 flex min-h-11 items-center gap-1.5 text-sm font-semibold tabular-nums',
              perMealGrams > 0 ? 'text-orange-700' : 'text-stone-600',
            )}
          >
            <Wand2 size={16} className="shrink-0" aria-hidden="true" />
            自動補齊 每餐 {perMealGrams} g · 共買 {planBatchGrams} g
          </p>
        ) : (
          <>
            <button
              type="button"
              className={ICON_BUTTON}
              onClick={() => onBump(food.id, -1)}
              aria-label={`${food.name} 減少 ${step} 克`}
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
              aria-label={`${food.name} ${isPerMeal ? '每餐克數' : '採買總量'}`}
              className={cx(
                'h-11 w-16 rounded-xl border border-stone-300 bg-white px-2 text-right text-stone-900 tabular-nums',
                FOCUS_RING,
              )}
            />
            <span className="text-sm text-stone-600" aria-hidden="true">
              g
            </span>
            <button
              type="button"
              className={ICON_BUTTON}
              onClick={() => onBump(food.id, 1)}
              aria-label={`${food.name} 增加 ${step} 克`}
            >
              <Plus size={18} aria-hidden="true" />
            </button>
            {/* 放不下時(390px)自動換到下一行 */}
            <span className="ml-1 text-xs text-stone-600 tabular-nums">
              {isPerMeal ? `共買 ${batchGrams} g` : `每餐 ${perMealGrams} g`}
            </span>
          </>
        )}
      </div>
      {capWarning && (
        <p className="mt-1 pl-8 text-xs text-amber-700 tabular-nums">
          {capWarning.label}每餐建議 ≤ {capWarning.cap} g,目前合計{' '}
          {capWarning.grams} g
        </p>
      )}
    </li>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Info, Minus, Plus, Trash2, Utensils } from 'lucide-react';
import {
  DAILY_STATUS_LABELS,
  DEFAULT_MEALS_PER_DAY,
  RATIO_CATEGORIES,
  RATIO_CATEGORY_LABELS,
  isVegetable,
  planByRatio,
} from '@furlogic/shared';
import FoodSearchSheet from '../components/batch/FoodSearchSheet';
import MealAnalysisCard from '../components/batch/MealAnalysisCard';
import useTwoStepConfirm from '../components/foods/useTwoStepConfirm';
import {
  Button,
  Card,
  EmptyState,
  FOCUS_RING,
  PageHeader,
  StatusBadge,
  cx,
} from '../components/ui';
import { usePet } from '../context/PetContext';
import useBatchDraft from '../hooks/useBatchDraft';
import {
  MAX_MEALS_COUNT,
  MIN_MEALS_COUNT,
  categoryOfItem,
  toMealTargetOverride,
  toMealsCount,
  toPct,
  toRatioItems,
} from '../utils/batchDraft';

const ICON_BUTTON = cx(
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed',
  FOCUS_RING,
);

/** 比例合計與目標值的容許誤差(%),與 shared planByRatio 一致 */
const PCT_TOLERANCE = 0.05;

const round1 = (n) => Math.round(n * 10) / 10;

/** 數字顯示:整數不帶小數,其餘一位小數 */
const fmt1 = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const sumPct = (list) => round1(list.reduce((s, v) => s + (v || 0), 0));

const offBy = (a, b) => Math.abs(a - b) > PCT_TOLERANCE;

/** 約可吃天數 = 餐數 ÷ 每日餐數(非法 → 預設每日餐數) */
const daysCoveredOf = (mealsCount, mealsPerDay) => {
  const perDay =
    Number.isFinite(mealsPerDay) && mealsPerDay > 0
      ? mealsPerDay
      : DEFAULT_MEALS_PER_DAY;
  return round1(mealsCount / perDay);
};

/** 計算結果錯誤的說明文字 */
const ERROR_TEXT = {
  total_not_100: (e) => `食材比例合計須為 100%(目前 ${fmt1(e.totalPct)}%)`,
  no_target: () => '請先設定單餐目標',
  no_energy: () => '所選食材沒有熱量(蔬菜不計熱量),無法換算克數',
};

/** 計算:設定各類別與各食材占每餐總重的 %,按「計算」後依單餐目標算出每餐克數(不存伺服器) */
export default function BatchPage() {
  const { metrics } = usePet();
  const draft = useBatchDraft();
  const { items, mealsCount, mealTargetOverride, categoryPct } = draft;
  const [searchOpen, setSearchOpen] = useState(false);
  const [calc, setCalc] = useState(null); // { signature, result }
  const resultRef = useRef(null);
  const clearConfirm = useTwoStepConfirm();

  const petMealTarget = metrics?.mealTarget ?? 0;
  const petMealTargetRaw = metrics?.mealTargetRaw ?? 0;
  const mealsPerDay = metrics?.mealsPerDay;
  const mealTargetRaw = mealTargetOverride ?? petMealTargetRaw;
  const hasTarget = mealTargetRaw > 0;
  const hasItems = items.length > 0;

  const addedIds = useMemo(
    () => new Set(items.map((item) => item.food.id)),
    [items],
  );

  // 依 RATIO_CATEGORIES 順序分組,只留有食材的類別
  const groups = useMemo(
    () =>
      RATIO_CATEGORIES.map((cat) => {
        const catItems = items.filter((item) => categoryOfItem(item) === cat);
        const pct = categoryPct[cat] ?? 0;
        const itemsPct = sumPct(catItems.map((item) => item.pct));
        return {
          cat,
          label: RATIO_CATEGORY_LABELS[cat],
          pct,
          items: catItems,
          itemsPct,
          mismatch: offBy(itemsPct, pct),
        };
      }).filter((g) => g.items.length > 0),
    [items, categoryPct],
  );
  const categoryTotal = sumPct(groups.map((g) => g.pct));

  // 停用原因:依序檢查,顯示第一個未滿足的條件
  const blocker = (() => {
    if (!hasItems) return '請先加入食材';
    const bad = groups.find((g) => g.mismatch);
    if (bad) return `${bad.label}食材合計須等於 ${fmt1(bad.pct)}%`;
    if (offBy(categoryTotal, 100))
      return `類別合計須為 100%(目前 ${fmt1(categoryTotal)}%)`;
    if (!hasTarget) return '請先設定單餐目標';
    return null;
  })();

  // 目前輸入的簽章:與上次計算時不同就提示重新計算
  const signature = JSON.stringify({
    items: items.map((item) => [item.food.id ?? item.food.name, item.pct]),
    categoryPct,
    mealTargetRaw,
    mealsCount,
    mealsPerDay: mealsPerDay ?? null,
  });
  const stale = calc !== null && calc.signature !== signature;

  const handleCalculate = () => {
    if (blocker) return;
    setCalc({
      signature,
      result: planByRatio({
        items: toRatioItems(items),
        mealTarget: mealTargetRaw,
        mealsCount,
        mealsPerDay,
      }),
    });
  };

  // 按下「計算」後把結果捲進畫面(結果在按鈕下方,手機上常在可視範圍外)
  useEffect(() => {
    if (!calc) return;
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    resultRef.current?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [calc]);

  const handleClear = () => {
    if (!clearConfirm.confirming) {
      clearConfirm.request();
      return;
    }
    clearConfirm.reset();
    draft.clear();
    setCalc(null);
  };

  return (
    <>
      <PageHeader
        title="計算"
        subtitle="設定食材重量比例,計算每餐克數"
        action={
          hasItems && (
            <Button
              variant="ghost"
              onClick={handleClear}
              onBlur={clearConfirm.reset}
            >
              {clearConfirm.confirming ? '確定清空?' : '清空'}
            </Button>
          )
        }
      />

      <p className="mb-3 flex items-center gap-1.5 text-xs text-stone-600">
        <Info size={14} className="shrink-0" aria-hidden="true" />
        營養數值為生食基準,請輸入下鍋前的生重
      </p>

      <MealTargetCard
        petMealTarget={petMealTarget}
        mealsPerDay={mealsPerDay}
        override={mealTargetOverride}
        hasTarget={hasTarget}
        onChange={draft.setMealTargetOverride}
      />

      <Card
        as="section"
        aria-labelledby="ratio-title"
        padding="px-4 pt-4 pb-4"
        className="mb-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="ratio-title" className="font-semibold text-stone-900">
            食材比例
          </h2>
          {hasItems && (
            <span
              className={cx(
                'shrink-0 text-sm tabular-nums',
                offBy(categoryTotal, 100)
                  ? 'text-rose-700'
                  : 'text-emerald-700',
              )}
            >
              合計 {fmt1(categoryTotal)}%
            </span>
          )}
        </div>
        {hasItems ? (
          <>
            <div className="mt-2">
              {groups.map((group, i) => (
                <CategoryBlock
                  key={group.cat}
                  group={group}
                  first={i === 0}
                  onSetCategoryPct={draft.setCategoryPct}
                  onSetItemPct={draft.setItemPct}
                  onSplit={draft.splitCategory}
                  onRemove={draft.removeFood}
                />
              ))}
            </div>
            <Button
              variant="secondary"
              icon={Plus}
              block
              className="mt-3"
              onClick={() => setSearchOpen(true)}
            >
              加入食材
            </Button>
          </>
        ) : (
          <EmptyState
            icon={Utensils}
            title="還沒加入食材"
            action={
              <Button icon={Plus} onClick={() => setSearchOpen(true)}>
                加入食材
              </Button>
            }
          />
        )}
      </Card>

      {hasItems && (
        <MealsCountCard
          mealsCount={mealsCount}
          mealsPerDay={mealsPerDay}
          daysCovered={daysCoveredOf(mealsCount, mealsPerDay)}
          onChange={draft.setMealsCount}
        />
      )}

      <div className="mb-4">
        <Button
          icon={Calculator}
          size="lg"
          block
          disabled={blocker !== null}
          aria-describedby={blocker ? 'calc-blocker' : undefined}
          onClick={handleCalculate}
        >
          計算
        </Button>
        {blocker && (
          <p id="calc-blocker" className="mt-2 text-xs text-stone-600">
            {blocker}
          </p>
        )}
      </div>

      {calc && (
        <div ref={resultRef} className="scroll-mt-20">
          <ResultSection result={calc.result} stale={stale} />
        </div>
      )}

      {searchOpen && (
        <FoodSearchSheet
          addedIds={addedIds}
          onAdd={draft.addFood}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </>
  );
}

/**
 * % 輸入框:輸入中保留文字(允許「12.」等中間狀態),每次變更以 toPct 正規化後回報;
 * 外部改值(平均分配、類別連動)時同步顯示。
 */
function PctInput({ value, onChange, label, className }) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((current) => (Number(current) === value ? current : String(value)));
  }, [value]);

  const handleChange = (e) => {
    const next = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
    setText(next);
    onChange(toPct(next));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onBlur={() => setText(String(value))}
      aria-label={label}
      className={cx(
        'h-11 rounded-xl bg-white px-2 text-right text-stone-900 tabular-nums',
        FOCUS_RING,
        className,
      )}
    />
  );
}

/** 單一類別區塊:類別 % + 類內各食材 % */
function CategoryBlock({
  group,
  first,
  onSetCategoryPct,
  onSetItemPct,
  onSplit,
  onRemove,
}) {
  const { cat, label, pct, items, itemsPct, mismatch } = group;
  return (
    <section
      aria-label={label}
      className={cx('py-3', !first && 'border-t border-stone-100')}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-stone-900">{label}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <PctInput
            value={pct}
            onChange={(v) => onSetCategoryPct(cat, v)}
            label={`${label} 占比`}
            className="w-20 border-2 border-stone-400 font-semibold"
          />
          <span className="text-sm text-stone-600">%</span>
        </div>
      </div>
      <ul className="mt-2 space-y-2 border-l-2 border-stone-200 pl-4">
        {items.map((item) => {
          const { food } = item;
          const veg = isVegetable(food);
          return (
            <li
              key={food.id ?? food.name}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="break-words text-stone-900">{food.name}</p>
                <p className="text-xs text-stone-600 tabular-nums">
                  {veg ? '蔬菜 · 不計熱量' : `${food.calories ?? 0} kcal/100g`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <PctInput
                  value={item.pct}
                  onChange={(v) => onSetItemPct(food.id, v)}
                  label={`${food.name} 占比`}
                  className="w-16 border border-stone-300"
                />
                <span className="text-sm text-stone-600">%</span>
                <button
                  type="button"
                  className={cx(
                    'inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 hover:text-rose-700',
                    FOCUS_RING,
                  )}
                  onClick={() => onRemove(food.id)}
                  aria-label={`移除 ${food.name}`}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {mismatch && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-700 tabular-nums">
            {label}食材合計 {fmt1(itemsPct)}%,應為 {fmt1(pct)}%
          </p>
          <Button
            variant="ghost"
            className="shrink-0"
            onClick={() => onSplit(cat)}
          >
            平均分配
          </Button>
        </div>
      )}
    </section>
  );
}

/** 計算結果 + 每餐營養 */
function ResultSection({ result, stale }) {
  if (!result.ok) {
    return (
      <Card as="section" aria-label="計算結果" className="mb-4 space-y-1">
        {result.errors.map((e) => (
          <p key={e.kind} className="text-sm text-rose-700">
            {ERROR_TEXT[e.kind]?.(e) ?? '無法計算'}
          </p>
        ))}
      </Card>
    );
  }
  return (
    <>
      <ResultCard result={result} stale={stale} className="mb-4" />
      <div className="mb-4">
        <MealAnalysisCard
          title="每餐營養"
          result={result.perMeal}
          batchSupplements={result.batch.supplements}
        />
      </div>
    </>
  );
}

/** 計算結果卡:每餐總重、熱量與各項克數(依類別分組) */
function ResultCard({ result, stale, className }) {
  const { perMeal, status, totalGramsPerMeal, items, capWarnings } = result;
  const target = Math.round(result.mealTarget);
  const groups = RATIO_CATEGORIES.map((cat) => {
    const catItems = items.filter(
      (item) => categoryOfItem({ food: item }) === cat,
    );
    return {
      cat,
      label: RATIO_CATEGORY_LABELS[cat],
      items: catItems,
      grams: round1(catItems.reduce((s, item) => s + item.gramsPerMeal, 0)),
    };
  }).filter((g) => g.items.length > 0);

  return (
    <Card
      as="section"
      aria-labelledby="calc-result-title"
      className={cx('space-y-4', className)}
    >
      <div className="rounded-xl bg-orange-50 p-4">
        <h2 id="calc-result-title" className="sr-only">
          計算結果
        </h2>
        {stale && (
          <p className="mb-2 text-sm text-amber-700">
            比例或目標已變更,請重新計算
          </p>
        )}
        <p className="text-stone-900 tabular-nums">
          <span className="text-lg font-semibold">每餐 </span>
          <span className="text-4xl font-bold">{totalGramsPerMeal}</span>
          <span className="text-lg font-semibold"> g</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-800 tabular-nums">
            {perMeal.totals.calories} kcal / 目標 {target} kcal
          </span>
          <StatusBadge status={status.status}>
            {DAILY_STATUS_LABELS[status.status]}
          </StatusBadge>
        </div>
      </div>
      {groups.map((group) => (
        <section key={group.cat} aria-label={group.label}>
          <h3 className="mb-1 flex items-baseline justify-between gap-3 text-sm font-semibold text-stone-900 tabular-nums">
            <span>{group.label}</span>
            <span>{fmt1(group.grams)} g</span>
          </h3>
          <ul className="space-y-1.5">
            {group.items.map((item) => (
              <li key={item.id ?? item.name} className="text-sm text-stone-800">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words">{item.name}</span>
                  <span className="shrink-0 font-semibold text-stone-900 tabular-nums">
                    {fmt1(item.gramsPerMeal)} g
                  </span>
                </div>
                <p className="text-xs text-stone-600 tabular-nums">
                  {fmt1(item.pct)}% · 共買 {fmt1(item.batchGrams)} g
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {capWarnings.length > 0 && (
        <ul className="space-y-1 border-t border-stone-200 pt-3">
          {capWarnings.map((w) => (
            <li key={w.kind} className="text-xs text-amber-700 tabular-nums">
              {w.label}每餐建議 ≤ {w.cap} g,目前 {fmt1(w.grams)} g
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** 單餐目標:毛孩設定值 + 本次覆寫輸入 */
function MealTargetCard({
  petMealTarget,
  mealsPerDay,
  override,
  hasTarget,
  onChange,
}) {
  const [text, setText] = useState(override == null ? '' : String(override));

  // 外部改變覆寫(還原、清空)時同步輸入框
  useEffect(() => {
    setText((current) => {
      if (override == null) return current.trim() === '' ? current : '';
      return Number(current) === override ? current : String(override);
    });
  }, [override]);

  const handleChange = (e) => {
    const value = e.target.value.replace(',', '.');
    setText(value);
    onChange(toMealTargetOverride(value));
  };

  const showRestore = override != null && override !== petMealTarget;

  return (
    <Card
      as="section"
      aria-labelledby="batch-target-title"
      className="mb-4 space-y-2"
    >
      <h2 id="batch-target-title" className="font-semibold text-stone-900">
        單餐目標
      </h2>
      <p className="text-sm text-stone-600 tabular-nums">
        毛孩設定 {petMealTarget} kcal(DER ÷ {mealsPerDay ?? '-'} 餐)
      </p>
      <div className="flex items-center gap-2">
        <label
          htmlFor="batch-target-input"
          className="text-sm font-semibold text-stone-900"
        >
          本次目標
        </label>
        <input
          id="batch-target-input"
          type="text"
          inputMode="numeric"
          value={text}
          placeholder={petMealTarget > 0 ? String(petMealTarget) : ''}
          onChange={handleChange}
          onBlur={() => setText(override == null ? '' : String(override))}
          className={cx(
            'h-11 w-24 rounded-xl border border-stone-300 bg-white px-3 text-right text-stone-900 tabular-nums',
            FOCUS_RING,
          )}
        />
        <span className="text-sm text-stone-600">kcal</span>
        {showRestore && (
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => onChange(null)}
          >
            還原
          </Button>
        )}
      </div>
      {!hasTarget && (
        <p className="text-xs text-amber-700">
          請先在「毛孩」設定體重,或輸入本次目標
        </p>
      )}
    </Card>
  );
}

/** 餐數步進器 + 可吃天數 */
function MealsCountCard({ mealsCount, mealsPerDay, daysCovered, onChange }) {
  const [text, setText] = useState(String(mealsCount));

  // 外部改變餐數(步進)時同步輸入框
  useEffect(() => {
    setText((current) =>
      Number(current) === mealsCount ? current : String(mealsCount),
    );
  }, [mealsCount]);

  const handleChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setText(value);
    if (value !== '') onChange(toMealsCount(value));
  };

  return (
    <Card
      as="section"
      aria-labelledby="batch-meals-title"
      className="mb-4 space-y-3"
    >
      <h2 id="batch-meals-title" className="font-semibold text-stone-900">
        餐數
      </h2>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => onChange(mealsCount - 1)}
          disabled={mealsCount <= MIN_MEALS_COUNT}
          aria-label="減少 1 餐"
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={handleChange}
          onBlur={() => setText(String(mealsCount))}
          aria-label="餐數"
          className={cx(
            'h-11 w-20 rounded-xl border border-stone-300 bg-white px-3 text-center text-lg font-semibold text-stone-900 tabular-nums',
            FOCUS_RING,
          )}
        />
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => onChange(mealsCount + 1)}
          disabled={mealsCount >= MAX_MEALS_COUNT}
          aria-label="增加 1 餐"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
        <span className="text-sm text-stone-600">餐</span>
      </div>
      <p className="text-sm text-stone-600 tabular-nums">
        約可吃 {daysCovered} 天(每日 {mealsPerDay} 餐)
      </p>
    </Card>
  );
}

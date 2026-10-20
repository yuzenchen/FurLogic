import React, { useEffect, useMemo, useState } from 'react';
import { Info, Minus, Plus, Utensils } from 'lucide-react';
import { DAILY_STATUS_LABELS, capKindOf, planGapFill } from '@furlogic/shared';
import BatchItemRow from '../components/batch/BatchItemRow';
import FoodSearchSheet from '../components/batch/FoodSearchSheet';
import MealAnalysisCard from '../components/batch/MealAnalysisCard';
import Segmented from '../components/foods/Segmented';
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
  toMealTargetOverride,
  toMealsCount,
  toPlanItems,
} from '../utils/batchDraft';

const ICON_BUTTON = cx(
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed',
  FOCUS_RING,
);

/** 每餐熱量 vs 單餐目標的說明文字 */
const statusText = (status, diff) => {
  if (status === 'under') return `比目標少 ${Math.abs(diff)} kcal`;
  if (status === 'over') return `比目標多 ${Math.abs(diff)} kcal`;
  return '接近目標';
};

/** 克數顯示:整數不帶小數,其餘一位小數 */
const fmtGrams = (g) => (Number.isInteger(g) ? String(g) : g.toFixed(1));

const INPUT_MODE_OPTIONS = [
  { value: 'batch', label: '採買總量' },
  { value: 'perMeal', label: '每餐' },
];

/** 批次製作:輸入各食材採買總量(或每餐份量)與餐數 → 每餐克數;缺口由主力瘦肉補齊(不存伺服器) */
export default function BatchPage() {
  const { metrics } = usePet();
  const draft = useBatchDraft();
  const { items, mealsCount, mealTargetOverride, inputMode } = draft;
  const [searchOpen, setSearchOpen] = useState(false);
  const clearConfirm = useTwoStepConfirm();

  const petMealTarget = metrics?.mealTarget ?? 0;
  const petMealTargetRaw = metrics?.mealTargetRaw ?? 0;
  const mealsPerDay = metrics?.mealsPerDay;
  const mealTargetRaw = mealTargetOverride ?? petMealTargetRaw;
  const mealTarget = Math.round(mealTargetRaw);
  const hasTarget = mealTargetRaw > 0;

  const planItems = useMemo(
    () => toPlanItems(items, mealsCount),
    [items, mealsCount],
  );
  const plan = useMemo(
    () =>
      planGapFill({
        items: planItems,
        mealTarget: mealTargetRaw,
        mealsCount,
        mealsPerDay,
      }),
    [planItems, mealTargetRaw, mealsCount, mealsPerDay],
  );
  const addedIds = useMemo(
    () => new Set(items.map((item) => item.food.id)),
    [items],
  );
  const capWarningByKind = useMemo(
    () => new Map(plan.capWarnings.map((w) => [w.kind, w])),
    [plan.capWarnings],
  );

  const hasItems = items.length > 0;
  const { perMeal, batch } = plan;
  const showResult = hasItems && hasTarget;

  const handleClear = () => {
    if (!clearConfirm.confirming) {
      clearConfirm.request();
      return;
    }
    clearConfirm.reset();
    draft.clear();
  };

  return (
    <>
      <PageHeader
        title="批次製作"
        subtitle="輸入採買總量或每餐份量,主力瘦肉依熱量缺口補齊"
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
        aria-labelledby="batch-items-title"
        padding="px-4 pt-4 pb-1"
        className="mb-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="batch-items-title" className="font-semibold text-stone-900">
            食材
          </h2>
          <div className="shrink-0">
            <Segmented
              label="輸入模式"
              value={inputMode}
              options={INPUT_MODE_OPTIONS}
              onChange={draft.setInputMode}
              fit
            />
          </div>
        </div>
        {hasItems ? (
          <>
            <ul className="divide-y divide-stone-100" aria-label="食材">
              {items.map((item, i) => (
                <BatchItemRow
                  key={item.food.id ?? item.food.name}
                  item={item}
                  planItem={plan.items[i]}
                  capWarning={capWarningByKind.get(capKindOf(item.food))}
                  inputMode={inputMode}
                  mealsCount={mealsCount}
                  onSetRole={draft.setRole}
                  onSetBatchGrams={draft.setBatchGrams}
                  onSetGramsPerMeal={draft.setGramsPerMeal}
                  onBump={draft.bump}
                  onRemove={draft.removeFood}
                />
              ))}
            </ul>
            <GapSummary plan={plan} />
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

      {/* 空清單時 EmptyState 已有「加入食材」,不重複顯示操作列 */}
      {hasItems && (
        <div className="mb-4">
          <Button
            variant="secondary"
            icon={Plus}
            block
            onClick={() => setSearchOpen(true)}
          >
            加入食材
          </Button>
        </div>
      )}

      {hasItems && (
        <MealsCountCard
          mealsCount={mealsCount}
          mealsPerDay={mealsPerDay}
          daysCovered={plan.daysCovered}
          onChange={draft.setMealsCount}
        />
      )}

      {showResult && (
        <>
          <PerMealCard plan={plan} mealTarget={mealTarget} className="mb-4" />
          {inputMode === 'perMeal' && (
            <PurchaseCard plan={plan} className="mb-4" />
          )}
          <div className="mb-4">
            <MealAnalysisCard
              title="每餐營養"
              result={perMeal}
              batchSupplements={batch.supplements}
            />
          </div>
        </>
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

const WARNING_TEXT = {
  no_main: {
    text: '請把一項肉類設為「主力瘦肉」,系統會算出它每餐需要幾克',
    tone: 'text-stone-600',
  },
  main_no_energy: {
    text: '主力瘦肉必須是有熱量的食材',
    tone: 'text-amber-700',
  },
};

/** 食材卡底:固定 / 替換 / 缺口 + 警告文字 */
function GapSummary({ plan }) {
  const { fixedKcal, variantKcal, gapKcal, warnings } = plan;
  const lines = warnings.flatMap((w) => {
    if (w.kind === 'over_target') {
      return w.excessKcal > 0
        ? [
            {
              key: w.kind,
              text: `固定 + 替換已超過目標 ${w.excessKcal} kcal,主力 0 g`,
              tone: 'text-rose-700',
            },
          ]
        : [
            {
              key: w.kind,
              text: '剛好達到目標,主力 0 g',
              tone: 'text-stone-600',
            },
          ];
    }
    const def = WARNING_TEXT[w.kind];
    return def ? [{ key: w.kind, ...def }] : [];
  });

  return (
    <div className="border-t border-stone-200 py-3">
      <dl className="grid grid-cols-3 gap-2 text-sm text-stone-800 tabular-nums">
        <div>
          <dt className="text-xs text-stone-600">固定</dt>
          <dd className="font-semibold">{fixedKcal}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-600">替換</dt>
          <dd className="font-semibold">{variantKcal}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-600">缺口</dt>
          <dd
            className={cx(
              'font-semibold',
              gapKcal < 0 ? 'text-rose-700' : 'text-stone-900',
            )}
          >
            {gapKcal} kcal
          </dd>
        </div>
      </dl>
      {lines.map((line) => (
        <p key={line.key} className={cx('mt-2 text-xs', line.tone)}>
          {line.text}
        </p>
      ))}
    </div>
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

/** 每餐結果:頁面唯一的視覺重點 */
function PerMealCard({ plan, mealTarget, className }) {
  const { perMeal, perMealGrams, status, items } = plan;
  const calories = perMeal.totals.calories;
  const diff = calories - mealTarget;
  const portionItems = items.filter((item) => item.gramsPerMeal > 0);

  return (
    <Card
      as="section"
      aria-labelledby="batch-result-title"
      className={cx('space-y-4', className)}
    >
      <div className="rounded-xl bg-orange-50 p-4">
        {/* 放在面板內,避免 sr-only 標題吃掉 space-y 的第一個間距 */}
        <h2 id="batch-result-title" className="sr-only">
          每餐結果
        </h2>
        <p className="text-stone-900 tabular-nums">
          <span className="text-lg font-semibold">每餐 </span>
          <span className="text-4xl font-bold">{calories}</span>
          <span className="text-lg font-semibold"> kcal</span>
        </p>
        <p className="mt-1 text-sm text-stone-600 tabular-nums">
          / 目標 {mealTarget} kcal
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={status.status}>
            {DAILY_STATUS_LABELS[status.status]}
          </StatusBadge>
          <span className="text-sm text-stone-800 tabular-nums">
            {statusText(status.status, diff)}
          </span>
        </div>
        <p className="mt-3 text-sm text-stone-800 tabular-nums">
          每餐生重約 {perMealGrams} g
        </p>
      </div>
      {portionItems.length > 0 && (
        <section aria-labelledby="batch-portion-title">
          <h3
            id="batch-portion-title"
            className="mb-2 text-sm font-semibold text-stone-900"
          >
            每餐含
          </h3>
          <ul className="space-y-1">
            {portionItems.map((item) => (
              <li
                key={item.id ?? item.name}
                className="flex items-baseline justify-between gap-3 text-sm text-stone-800"
              >
                <span className="min-w-0 break-words">
                  {item.name}
                  {item.isMain && (
                    <span className="ml-1 text-xs font-semibold text-orange-700">
                      主力
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums">
                  {fmtGrams(item.gramsPerMeal)} g
                  {item.isMain && (
                    <span className="ml-1 text-xs text-stone-600">
                      (共買 {fmtGrams(item.batchGrams)} g)
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

/** 採買總量清單(只在「每餐」輸入模式顯示;採買總量模式下輸入即總量,不重複) */
function PurchaseCard({ plan, className }) {
  const { items, mealsCount, batch } = plan;
  const rows = items.filter((item) => item.batchGrams > 0);

  return (
    <Card
      as="section"
      aria-labelledby="batch-purchase-title"
      className={cx('space-y-2', className)}
    >
      <h2 id="batch-purchase-title" className="font-semibold text-stone-900">
        採買總量({mealsCount} 餐)
      </h2>
      <ul className="space-y-1">
        {rows.map((item) => (
          <li
            key={item.id ?? item.name}
            className="flex items-baseline justify-between gap-3 text-sm text-stone-800"
          >
            <span className="min-w-0 break-words">{item.name}</span>
            <span className="shrink-0 tabular-nums">
              {fmtGrams(item.batchGrams)} g
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-stone-200 pt-2 text-right text-sm font-semibold text-stone-900 tabular-nums">
        合計 {fmtGrams(batch.totals.grams)} g
      </p>
    </Card>
  );
}

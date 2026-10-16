import React, { useEffect, useMemo, useState } from 'react';
import { Info, Minus, Plus, Utensils, Wand2 } from 'lucide-react';
import {
  DAILY_STATUS_LABELS,
  MAX_VEG_WEIGHT_PCT,
  canAllocateBatch,
  isVegetable,
  planBatch,
  toVegWeightPct,
} from '@furlogic/shared';
import BatchItemRow from '../components/batch/BatchItemRow';
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
  MAX_SERVINGS,
  MIN_SERVINGS,
  flattenDraftItems,
  toServings,
} from '../utils/batchDraft';

const ICON_BUTTON = cx(
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed',
  FOCUS_RING,
);

const clampServings = (n) => Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, n));

/** 每份熱量 vs 單餐目標的說明文字 */
const statusText = (status, diff) => {
  if (status === 'under') return `比目標少 ${Math.abs(diff)} kcal`;
  if (status === 'over') return `比目標多 ${Math.abs(diff)} kcal`;
  return '接近目標';
};

/** 批次製作:輸入整鍋生重 → 算出份數、每份營養與補充品(不存伺服器) */
export default function BatchPage() {
  const { metrics } = usePet();
  const draft = useBatchDraft();
  const { items } = draft;
  const [searchOpen, setSearchOpen] = useState(false);
  const clearConfirm = useTwoStepConfirm();

  const mealTarget = metrics?.mealTarget ?? 0;
  const mealTargetRaw = metrics?.mealTargetRaw ?? 0;
  const mealsPerDay = metrics?.mealsPerDay;

  const flat = useMemo(() => flattenDraftItems(items), [items]);
  const plan = useMemo(() => {
    const base = planBatch({
      items: flat,
      mealTarget: mealTargetRaw,
      mealsPerDay,
    });
    const servings =
      draft.servings ?? clampServings(base.suggestedServings ?? MIN_SERVINGS);
    return planBatch({
      items: flat,
      servings,
      mealTarget: mealTargetRaw,
      mealsPerDay,
    });
  }, [flat, draft.servings, mealTargetRaw, mealsPerDay]);
  const addedIds = useMemo(
    () => new Set(items.map((item) => item.food.id)),
    [items],
  );

  const hasItems = items.length > 0;
  const hasVeg = items.some((item) => isVegetable(item.food));
  const canAllocate = canAllocateBatch(items) && mealTargetRaw > 0;
  const { batch, perServing, suggestedServings, servings } = plan;
  const hasResult = batch.totals.calories > 0;

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
        subtitle="輸入整鍋食材的生重,算出可分幾份"
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

      <Card
        as="section"
        aria-labelledby="batch-items-title"
        padding="px-4 pt-4 pb-1"
        className="mb-4"
      >
        <h2 id="batch-items-title" className="font-semibold text-stone-900">
          整鍋食材
        </h2>
        {hasItems ? (
          <>
            <ul className="divide-y divide-stone-100" aria-label="整鍋食材">
              {items.map((item) => (
                <BatchItemRow
                  key={item.food.id ?? item.food.name}
                  item={item}
                  onSetGrams={draft.setGrams}
                  onBump={draft.bump}
                  onRemove={draft.removeFood}
                />
              ))}
            </ul>
            <p className="border-t border-stone-200 py-3 text-right text-sm font-semibold text-stone-900 tabular-nums">
              整鍋合計 {batch.totals.grams} g · {batch.totals.calories} kcal
            </p>
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
      <div className={hasItems ? 'mb-4' : 'hidden'}>
        {hasVeg && (
          <VegShareField
            value={draft.vegWeightPct}
            onChange={draft.setVegWeightPct}
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() => setSearchOpen(true)}
          >
            加入食材
          </Button>
          <Button
            variant="secondary"
            icon={Wand2}
            disabled={!canAllocate}
            onClick={() => draft.applyAllocation(servings, mealTargetRaw)}
          >
            依份數自動配量
          </Button>
        </div>
        {canAllocate && (
          <p className="mt-2 text-xs text-stone-600 tabular-nums">
            依 {servings} 份 × 單餐 {mealTarget} kcal 計算各食材總重
            {hasVeg && `(蔬菜不計熱量,占整鍋重量 ${draft.vegWeightPct}%)`}
          </p>
        )}
        {hasItems && !canAllocateBatch(items) && (
          <p className="mt-2 text-xs text-stone-600">
            蔬菜不計熱量,請先加入肉類或澱粉等有熱量的食材再自動配量
          </p>
        )}
      </div>

      {hasItems && (
        <ServingsCard
          servings={servings}
          suggested={suggestedServings}
          mealTarget={mealTarget}
          mealsPerDay={mealsPerDay}
          daysCovered={plan.daysCovered}
          onChange={draft.setServings}
        />
      )}

      {hasResult && (
        <>
          <PerServingCard
            plan={plan}
            mealTarget={mealTarget}
            className="mb-4"
          />
          <div className="mb-4">
            <MealAnalysisCard
              title="每份營養"
              result={perServing.analysis}
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

/** 自動配量時蔬菜占整鍋重量的百分比(0–90) */
function VegShareField({ value, onChange }) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((current) =>
      current !== '' && Number(current) === value ? current : String(value),
    );
  }, [value]);

  const handleChange = (e) => {
    const next = e.target.value.replace(/[^\d]/g, '').slice(0, 2);
    setText(next);
    if (next !== '') onChange(Number(next));
  };

  return (
    <div className="mb-2 flex items-center gap-2">
      <label
        htmlFor="batch-veg-pct"
        className="text-sm font-semibold text-stone-900"
      >
        蔬菜占整鍋重量
      </label>
      <input
        id="batch-veg-pct"
        type="text"
        inputMode="numeric"
        value={text}
        onChange={handleChange}
        onBlur={() => setText(String(toVegWeightPct(value)))}
        aria-describedby="batch-veg-pct-hint"
        className={cx(
          'h-11 w-16 rounded-xl border border-stone-300 bg-white px-3 text-right text-stone-900 tabular-nums',
          FOCUS_RING,
        )}
      />
      <span className="text-sm text-stone-600" aria-hidden="true">
        %
      </span>
      <span id="batch-veg-pct-hint" className="sr-only">
        0 到 {MAX_VEG_WEIGHT_PCT}
      </span>
    </div>
  );
}

/** 份數步進器 + 建議份數 + 可吃天數 */
function ServingsCard({
  servings,
  suggested,
  mealTarget,
  mealsPerDay,
  daysCovered,
  onChange,
}) {
  const [text, setText] = useState(String(servings));

  // 外部改變份數(步進、套用建議、食材變動改變建議)時同步輸入框
  useEffect(() => {
    setText((current) =>
      Number(current) === servings ? current : String(servings),
    );
  }, [servings]);

  const handleChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setText(value);
    const n = toServings(value);
    if (n !== null) onChange(n);
  };

  return (
    <Card
      as="section"
      aria-labelledby="batch-servings-title"
      className="mb-4 space-y-3"
    >
      <h2 id="batch-servings-title" className="font-semibold text-stone-900">
        份數
      </h2>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => onChange(servings - 1)}
          disabled={servings <= MIN_SERVINGS}
          aria-label="減少 1 份"
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={handleChange}
          onBlur={() => setText(String(servings))}
          aria-label="份數"
          className={cx(
            'h-11 w-20 rounded-xl border border-stone-300 bg-white px-3 text-center text-lg font-semibold text-stone-900 tabular-nums',
            FOCUS_RING,
          )}
        />
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => onChange(servings + 1)}
          disabled={servings >= MAX_SERVINGS}
          aria-label="增加 1 份"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
        <span className="text-sm text-stone-600">份</span>
      </div>
      {suggested !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-stone-800 tabular-nums">
            建議 {suggested} 份(依單餐目標 {mealTarget} kcal)
          </p>
          {servings !== suggested && (
            <Button variant="ghost" onClick={() => onChange(null)}>
              套用建議
            </Button>
          )}
        </div>
      )}
      <p className="text-sm text-stone-600 tabular-nums">
        約可吃 {daysCovered} 天(每日 {mealsPerDay} 餐)
      </p>
    </Card>
  );
}

/** 每份結果:頁面唯一的視覺重點 */
function PerServingCard({ plan, mealTarget, className }) {
  const { perServing, servings, status } = plan;
  const diff = perServing.calories - mealTarget;
  const portionItems = perServing.items.filter((item) => item.grams > 0);

  return (
    <Card
      as="section"
      aria-labelledby="batch-result-title"
      className={cx('space-y-4', className)}
    >
      <div className="rounded-xl bg-orange-50 p-4">
        {/* 放在面板內,避免 sr-only 標題吃掉 space-y 的第一個間距 */}
        <h2 id="batch-result-title" className="sr-only">
          每份結果
        </h2>
        <p className="text-stone-900 tabular-nums">
          <span className="text-lg font-semibold">每份 </span>
          <span className="text-4xl font-bold">{perServing.calories}</span>
          <span className="text-lg font-semibold"> kcal</span>
        </p>
        <p className="mt-1 text-sm text-stone-600 tabular-nums">
          / 單餐目標 {mealTarget} kcal
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
          每份生重約 {perServing.grams} g(整鍋 ÷ {servings})
        </p>
      </div>
      {portionItems.length > 0 && (
        <section aria-labelledby="batch-portion-title">
          <h3
            id="batch-portion-title"
            className="mb-2 text-sm font-semibold text-stone-900"
          >
            每份含
          </h3>
          <ul className="space-y-1">
            {portionItems.map((item) => (
              <li
                key={item.id ?? item.name}
                className="flex items-baseline justify-between gap-3 text-sm text-stone-800"
              >
                <span className="min-w-0 break-words">{item.name}</span>
                <span className="shrink-0 tabular-nums">{item.grams} g</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

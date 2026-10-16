import React, { useMemo, useState } from 'react';
import { Info, Plus, Utensils, Wand2 } from 'lucide-react';
import { MEAL_LABELS, analyzeMeal, computeIntake } from '@furlogic/shared';
import { createMeal } from '../api/client';
import Segmented from '../components/foods/Segmented';
import useTwoStepConfirm from '../components/foods/useTwoStepConfirm';
import FoodSearchSheet from '../components/log/FoodSearchSheet';
import MealAnalysisCard from '../components/log/MealAnalysisCard';
import MealItemRow from '../components/log/MealItemRow';
import MealTargetBar from '../components/log/MealTargetBar';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { useNav } from '../context/NavContext';
import { usePet } from '../context/PetContext';
import useMealDraft from '../hooks/useMealDraft';
import { buildMealPayload, flattenDraftItems } from '../utils/mealDraft';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const formatToday = (d = new Date()) =>
  `${d.getMonth() + 1}月${d.getDate()}日 週${WEEKDAYS[d.getDay()]}`;

const LABEL_OPTIONS = Object.entries(MEAL_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const saveErrorMessage = (err) => {
  if (err?.code === 'toxic_food')
    return '這餐含有對狗有毒的食材,請移除後再儲存';
  if (err?.code === 'empty_meal') return '請至少輸入一項食材的克數';
  return err?.message || '儲存失敗';
};

/** 記一餐:草稿(存在 localStorage)→ 調整克數 → 儲存 */
export default function LogMealPage() {
  const { setTab } = useNav();
  const { pet, metrics } = usePet();
  const draft = useMealDraft();
  const { label, items } = draft;
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const clearConfirm = useTwoStepConfirm();

  const flat = useMemo(() => flattenDraftItems(items), [items]);
  const intake = useMemo(() => computeIntake(flat), [flat]);
  const result = useMemo(() => analyzeMeal(flat), [flat]);
  const addedIds = useMemo(
    () => new Set(items.map((item) => item.food.id)),
    [items],
  );

  const mealTarget = metrics?.mealTarget ?? 0;
  const mealTargetRaw = metrics?.mealTargetRaw ?? 0;
  const hasItems = items.length > 0;
  const canSave = Boolean(pet) && items.some((item) => item.grams > 0);

  const handleClear = () => {
    if (!clearConfirm.confirming) {
      clearConfirm.request();
      return;
    }
    clearConfirm.reset();
    setSaveError(null);
    draft.clear();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createMeal(
        buildMealPayload({ petId: pet.id, label, items, now: new Date() }),
      );
      draft.clear();
      setTab('today');
    } catch (err) {
      setSaveError(saveErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="記一餐"
        subtitle={formatToday()}
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

      <div className="mb-4">
        <Segmented
          label="餐別"
          value={label}
          options={LABEL_OPTIONS}
          onChange={draft.setLabel}
        />
      </div>

      <MealTargetBar
        current={intake.calories}
        target={mealTarget}
        targetRaw={mealTargetRaw}
      />

      <p className="mb-3 flex items-center gap-1.5 text-xs text-stone-600">
        <Info size={14} className="shrink-0" aria-hidden="true" />
        營養數值為生食基準,請以生重秤量
      </p>

      {hasItems ? (
        <Card padding="px-4 py-1" className="mb-4">
          <ul className="divide-y divide-stone-100" aria-label="這餐的食材">
            {items.map((item) => (
              <MealItemRow
                key={item.food.id ?? item.food.name}
                item={item}
                onSetGrams={draft.setGrams}
                onBump={draft.bump}
                onRemove={draft.removeFood}
              />
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="mb-4">
          <EmptyState
            icon={Utensils}
            title="還沒加入食材"
            action={
              <Button icon={Plus} onClick={() => setSearchOpen(true)}>
                加入食材
              </Button>
            }
          />
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2">
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
          disabled={!hasItems || !(mealTargetRaw > 0)}
          onClick={() => draft.applyAllocation(mealTargetRaw)}
        >
          依目標自動配量
        </Button>
      </div>

      {result.totals.calories > 0 && (
        <div className="mb-4">
          <MealAnalysisCard result={result} />
        </div>
      )}

      {saveError && (
        <p role="alert" className="mb-3 text-sm text-rose-700">
          {saveError}
        </p>
      )}

      <Button
        size="lg"
        block
        loading={saving}
        disabled={!canSave}
        onClick={handleSave}
      >
        儲存這餐
      </Button>

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

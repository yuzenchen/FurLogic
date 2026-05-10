import React from 'react';
import { ChefHat, Check, Drumstick, Leaf, AlertTriangle } from 'lucide-react';
import { FOOD_DATABASE, FOOD_TYPES } from '../../data/foodDatabase';

const PICKER_FOODS = FOOD_DATABASE.filter((i) => i.recipeRole !== 'excluded');

// 依顯示分類分組,並依 FOOD_TYPES 的鍵順序排列
const PICKER_GROUPS = Object.keys(FOOD_TYPES)
  .map((type) => ({
    type,
    label: FOOD_TYPES[type],
    items: PICKER_FOODS.filter((f) => f.type === type),
  }))
  .filter((g) => g.items.length > 0);

const RoleIcon = ({ item, size = 14 }) =>
  item.recipeRole === 'protein' ? (
    <Drumstick size={size} className="text-orange-500" />
  ) : (
    <Leaf size={size} className="text-emerald-500" />
  );

export default function IngredientPicker({
  selected,
  onToggle,
  onClear,
  onGenerate,
  isCalculating,
  petName,
  mealCalories,
}) {
  const isSelected = (id) => selected.some((i) => i.id === id);
  const proteinCount = selected.filter(
    (i) => i.recipeRole === 'protein',
  ).length;
  const plantCount = selected.length - proteinCount;
  const balanceHint =
    selected.length > 0
      ? proteinCount === 0
        ? '只有蔬果 — 鈣磷比通常偏高,建議加一份肉。'
        : plantCount === 0
          ? '只有肉 — 鈣磷比會嚴重偏低,記得補充蛋殼粉。'
          : null
      : null;

  return (
    <div className="p-5 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-bold text-2xl text-gray-800">AI 智能配餐</h2>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-red-500 underline"
          >
            清空 ({selected.length})
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        點選冰箱有的食材,系統自動計算均衡食譜。
        {mealCalories ? (
          <span className="block mt-1 text-orange-600 font-medium">
            一餐目標 ≈ {mealCalories} kcal
          </span>
        ) : null}
      </p>

      <div className="flex-1 overflow-y-auto mb-32 -mx-1 px-1">
        <div className="space-y-5">
          {PICKER_GROUPS.map(({ type, label, items }) => (
            <section key={type}>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
                <span>{label}</span>
                <span className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-300">{items.length}</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {items.map((item) => {
                  const active = isSelected(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggle(item)}
                      aria-pressed={active}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative text-left active:scale-[0.98] ${
                        active
                          ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100 shadow-lg shadow-orange-200/50'
                          : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-md'
                      } ${item.safety === 'caution' ? 'border-l-amber-300 border-l-4' : ''}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <RoleIcon item={item} />
                        <span className="font-bold text-gray-800">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span className="capitalize">
                          {item.safety === 'caution' ? '⚠ 注意' : ''}
                        </span>
                        <span className="font-mono">{item.calories} kcal</span>
                      </div>
                      {active && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white rounded-full p-0.5 shadow">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="absolute bottom-20 left-0 w-full px-5 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent pt-12 pb-5 space-y-3">
        {selected.length > 0 && (
          <SelectionSummary
            proteinCount={proteinCount}
            plantCount={plantCount}
            hint={balanceHint}
          />
        )}

        <button
          type="button"
          onClick={onGenerate}
          disabled={selected.length === 0 || isCalculating}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex justify-center items-center gap-2 transform active:scale-95 transition ${
            selected.length === 0
              ? 'bg-gray-300 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-orange-500 to-red-500 hover:shadow-orange-300/50 hover:shadow-xl'
          }`}
        >
          {isCalculating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              計算營養與鈣磷比...
            </>
          ) : (
            <>
              <ChefHat size={20} />
              生成 {petName} 的專屬食譜
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SelectionSummary({ proteinCount, plantCount, hint }) {
  const total = proteinCount + plantCount;
  const proteinPct = total > 0 ? (proteinCount / total) * 100 : 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 font-medium">已選 {total} 項</span>
        <span className="flex gap-3 text-gray-700 font-mono">
          <span className="flex items-center gap-1">
            <Drumstick size={12} className="text-orange-500" />
            {proteinCount}
          </span>
          <span className="flex items-center gap-1">
            <Leaf size={12} className="text-emerald-500" />
            {plantCount}
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-emerald-200 overflow-hidden">
        <div
          className="h-full bg-orange-500 transition-all"
          style={{ width: `${proteinPct}%` }}
        />
      </div>
      {hint && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 leading-snug">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}

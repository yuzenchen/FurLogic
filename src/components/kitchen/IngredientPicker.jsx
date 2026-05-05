import React from 'react';
import { ChefHat, Check } from 'lucide-react';
import { FOOD_DATABASE, FOOD_TYPES } from '../../data/foodDatabase';

const PICKER_FOODS = FOOD_DATABASE.filter((i) => i.recipeRole !== 'excluded');

const labelFor = (item) =>
  item.recipeRole === 'protein' ? FOOD_TYPES.protein : '蔬果';

export default function IngredientPicker({
  selected,
  onToggle,
  onClear,
  onGenerate,
  isCalculating,
  petName,
}) {
  const isSelected = (id) => selected.some((i) => i.id === id);

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
      </p>

      <div className="flex-1 overflow-y-auto mb-20">
        <div className="grid grid-cols-2 gap-3 pb-24">
          {PICKER_FOODS.map((item) => {
            const active = isSelected(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item)}
                aria-pressed={active}
                className={`p-4 rounded-2xl border transition cursor-pointer relative text-left ${
                  active
                    ? 'border-orange-500 bg-orange-50 shadow-md ring-1 ring-orange-500'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="font-bold text-gray-800">{item.name}</span>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>{labelFor(item)}</span>
                  <span>{item.calories} kcal</span>
                </div>
                {active && (
                  <div className="absolute top-2 right-2 text-orange-500">
                    <Check size={16} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-20 left-0 w-full px-5 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-10 pb-5">
        <button
          type="button"
          onClick={onGenerate}
          disabled={selected.length === 0 || isCalculating}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex justify-center items-center gap-2 transform active:scale-95 transition ${
            selected.length === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gray-900'
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

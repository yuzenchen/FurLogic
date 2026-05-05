import React from 'react';
import { ChevronRight, Info, Utensils, Sparkles } from 'lucide-react';
import CaPRatioGauge from './CaPRatioGauge';
import MacroBars from './MacroBars';

export default function RecipeResult({ recipe, onBack, onClearAll }) {
  return (
    <div className="p-5 h-full overflow-y-auto pb-24 animate-in slide-in-from-bottom duration-500">
      <div className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-gray-500 font-medium hover:text-gray-800 active:scale-95 transition"
        >
          <ChevronRight className="rotate-180" size={18} /> 重新選擇
        </button>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-gray-400 hover:text-red-500 underline"
        >
          清空食材
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
        <header className="bg-gradient-to-br from-orange-500 via-orange-500 to-red-500 p-6 text-white relative overflow-hidden">
          <div className="absolute -top-6 -right-6 opacity-15">
            <Sparkles size={140} />
          </div>
          <div className="flex justify-between items-start relative">
            <div>
              <p className="text-orange-100 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sparkles size={12} /> Generated Recipe
              </p>
              <h2 className="text-2xl font-bold tracking-tight">
                營養均衡鮮食餐
              </h2>
            </div>
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-sm font-bold border border-white/30">
              {recipe.calories} kcal
            </div>
          </div>
        </header>

        <div className="p-6 space-y-7">
          <CaPRatioGauge analysis={recipe.analysis} />
          {recipe.macros && (
            <MacroBars
              macros={recipe.macros}
              actualCalories={recipe.actualCalories}
            />
          )}
          <IngredientList items={recipe.items} />
          <SupplementList supplements={recipe.supplements} />
        </div>
      </div>
    </div>
  );
}

function IngredientList({ items }) {
  return (
    <section>
      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Utensils size={16} /> 準備食材
      </h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
          >
            <span className="flex items-center gap-2 text-gray-700">
              <span
                className={`w-2 h-2 rounded-full ${
                  item.recipeRole === 'protein'
                    ? 'bg-orange-400'
                    : 'bg-emerald-400'
                }`}
                aria-hidden
              />
              {item.name}
            </span>
            <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-md text-sm font-mono">
              {item.amount}g
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SupplementList({ supplements }) {
  return (
    <section>
      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Info size={16} /> 營養師建議添加
      </h3>
      <ul className="bg-blue-50 rounded-2xl p-4 space-y-3">
        {supplements.map((sup) => (
          <li key={sup.name} className="flex justify-between items-center">
            <div>
              <span className="text-blue-900 font-bold text-sm block">
                {sup.name}
              </span>
              <span className="text-blue-500 text-xs">{sup.reason}</span>
            </div>
            <span className="font-bold text-blue-900">{sup.amount}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

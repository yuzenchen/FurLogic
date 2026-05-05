import React from 'react';
import {
  Check,
  ChevronRight,
  Info,
  AlertTriangle,
  Utensils,
} from 'lucide-react';

export default function RecipeResult({ recipe, onBack, onClearAll }) {
  return (
    <div className="p-5 h-full overflow-y-auto pb-24 animate-in slide-in-from-bottom duration-500">
      <div className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-gray-500 font-medium hover:text-gray-800"
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
        <header className="bg-gray-900 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
                Generated Recipe
              </p>
              <h2 className="text-2xl font-bold">營養均衡鮮食餐</h2>
            </div>
            <div className="bg-gray-800 px-3 py-1 rounded-lg text-sm font-bold border border-gray-700">
              {recipe.calories} kcal
            </div>
          </div>
        </header>

        <div className="p-6 space-y-8">
          <CaPRatioCard analysis={recipe.analysis} />
          <IngredientList items={recipe.items} />
          <SupplementList supplements={recipe.supplements} />
        </div>
      </div>
    </div>
  );
}

function CaPRatioCard({ analysis }) {
  const isGood = analysis.status === 'good';
  return (
    <section
      className={`p-4 rounded-2xl border ${
        isGood
          ? 'bg-green-50 border-green-200'
          : 'bg-orange-50 border-orange-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {isGood ? (
          <Check size={18} className="text-green-600" />
        ) : (
          <AlertTriangle size={18} className="text-orange-600" />
        )}
        <h3
          className={`font-bold text-sm ${
            isGood ? 'text-green-800' : 'text-orange-800'
          }`}
        >
          鈣磷比分析 (Ca:P = 1:{analysis.ratio})
        </h3>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{analysis.advice}</p>
    </section>
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
            <span className="text-gray-700">{item.name}</span>
            <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-md text-sm">
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

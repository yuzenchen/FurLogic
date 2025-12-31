import React, { useState, useEffect } from 'react';
import { ChefHat, Check, ChevronRight, Info, AlertTriangle, Utensils } from 'lucide-react';
import { FOOD_DATABASE } from '../data/foodDatabase';
import { generateRecipe } from '../utils/nutritionCalculator';
import { getKitchenIngredients, saveKitchenIngredients } from '../utils/storage';

/**
 * AI 智能配餐頁面
 */
export default function KitchenPage({ petProfile, der }) {
  // 從 localStorage 讀取初始食材選擇
  const [selectedIngredients, setSelectedIngredients] = useState(() => {
    const savedIngredients = getKitchenIngredients();
    // 驗證讀取的資料是否有效
    if (Array.isArray(savedIngredients) && savedIngredients.length > 0) {
      // 確保所有食材仍存在於資料庫中
      return savedIngredients.filter(savedItem => 
        FOOD_DATABASE.find(dbItem => dbItem.id === savedItem.id)
      );
    }
    return [];
  });
  
  const [recipeResult, setRecipeResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // 當食材選擇變更時儲存到 localStorage
  useEffect(() => {
    saveKitchenIngredients(selectedIngredients);
  }, [selectedIngredients]);

  const safeIngredients = FOOD_DATABASE.filter(i => i.safety !== 'toxic');

  const toggleIngredient = (item) => {
    if (selectedIngredients.find(i => i.id === item.id)) {
      setSelectedIngredients(prev => prev.filter(i => i.id !== item.id));
    } else {
      setSelectedIngredients(prev => [...prev, item]);
    }
  };

  const handleGenerateRecipe = () => {
    if (selectedIngredients.length === 0) return;
    setIsCalculating(true);

    setTimeout(() => {
      const mealCalories = Math.round(der / 2); // 一餐
      const result = generateRecipe(selectedIngredients, mealCalories);
      setRecipeResult(result);
      setIsCalculating(false);
    }, 1200);
  };

  const handleReset = () => {
    setRecipeResult(null);
    // 不清除食材選擇,讓使用者可以快速再次生成
  };

  const handleClearAll = () => {
    setSelectedIngredients([]);
    setRecipeResult(null);
  };

  if (recipeResult) {
    return (
      <div className="p-5 h-full overflow-y-auto pb-24 animate-in slide-in-from-bottom duration-500">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-gray-500 font-medium hover:text-gray-800"
          >
            <ChevronRight className="rotate-180" size={18} /> 重新選擇
          </button>
          <button
            onClick={handleClearAll}
            className="text-xs text-gray-400 hover:text-red-500 underline"
          >
            清空食材
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
          <div className="bg-gray-900 p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Generated Recipe
                </p>
                <h2 className="text-2xl font-bold">營養均衡鮮食餐</h2>
              </div>
              <div className="bg-gray-800 px-3 py-1 rounded-lg text-sm font-bold border border-gray-700">
                {recipeResult.calories} kcal
              </div>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* 鈣磷比分析 */}
            <div
              className={`p-4 rounded-2xl border ${
                recipeResult.analysis.status === 'good'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {recipeResult.analysis.status === 'good' ? (
                  <Check size={18} className="text-green-600" />
                ) : (
                  <AlertTriangle size={18} className="text-orange-600" />
                )}
                <h3
                  className={`font-bold text-sm ${
                    recipeResult.analysis.status === 'good'
                      ? 'text-green-800'
                      : 'text-orange-800'
                  }`}
                >
                  鈣磷比分析 (Ca:P = 1:{recipeResult.analysis.ratio})
                </h3>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {recipeResult.analysis.advice}
              </p>
            </div>

            {/* 食材清單 */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Utensils size={16} /> 準備食材
              </h3>
              <div className="space-y-3">
                {recipeResult.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-gray-700">{item.name}</span>
                    <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-md text-sm">
                      {item.amount}g
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 營養補充品 */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Info size={16} /> 營養師建議添加
              </h3>
              <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
                {recipeResult.supplements.map((sup, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <div>
                      <span className="text-blue-900 font-bold text-sm block">
                        {sup.name}
                      </span>
                      <span className="text-blue-500 text-xs">{sup.reason}</span>
                    </div>
                    <span className="font-bold text-blue-900">{sup.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-bold text-2xl text-gray-800">AI 智能配餐</h2>
        {selectedIngredients.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-gray-400 hover:text-red-500 underline"
          >
            清空 ({selectedIngredients.length})
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        點選冰箱有的食材,系統自動計算均衡食譜。
      </p>

      <div className="flex-1 overflow-y-auto mb-20">
        <div className="grid grid-cols-2 gap-3 pb-24">
          {safeIngredients.map(item => {
            const isSelected = selectedIngredients.find(i => i.id === item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleIngredient(item)}
                className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50 shadow-md ring-1 ring-orange-500'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="font-bold text-gray-800">{item.name}</span>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>{item.type === 'protein' ? '蛋白質' : '蔬果'}</span>
                  <span>{item.calories} kcal</span>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 text-orange-500">
                    <Check size={16} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-20 left-0 w-full px-5 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-10 pb-5">
        <button
          onClick={handleGenerateRecipe}
          disabled={selectedIngredients.length === 0 || isCalculating}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex justify-center items-center gap-2 transform active:scale-95 transition ${
            selectedIngredients.length === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gray-900'
          }`}
        >
          {isCalculating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              計算營養與鈣磷比...
            </>
          ) : (
            <>
              <ChefHat size={20} />
              生成 {petProfile.name} 的專屬食譜
            </>
          )}
        </button>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { Sparkles, ChefHat } from 'lucide-react';
import {
  generateRecipe,
  generateRecipeFromPortions,
} from '../utils/nutritionCalculator';
import { MEALS_PER_DAY } from '../utils/nutritionConstants';
import { FOOD_DATABASE } from '../data/foodDatabase';
import { usePet } from '../context/PetContext';
import useKitchenIngredients from '../hooks/useKitchenIngredients';
import useVisionWorker from '../hooks/useVisionWorker';
import IngredientPicker from './kitchen/IngredientPicker';
import RecipeResult from './kitchen/RecipeResult';
import PhotoCapture from './kitchen/PhotoCapture';
import PortionBuilder from './kitchen/PortionBuilder';

const RECIPE_GENERATION_DELAY_MS = 1200;

const TABS = [
  { id: 'auto', label: '智能配餐', icon: ChefHat },
  { id: 'photo', label: '拍照配餐', icon: Sparkles },
];

/**
 * 配餐頁面 — 兩個模式
 *  - auto: 既有「自動均衡」流程,需要一餐目標熱量,演算法分配份量
 *  - photo: 拍照 → AI 辨識(可略過) → 手動克數 → 真實累計營養
 */
export default function KitchenPage() {
  const [mode, setMode] = useState('auto');
  const [recipe, setRecipe] = useState(null);

  const handleClearRecipe = () => setRecipe(null);

  return (
    <div className="h-full flex flex-col">
      {!recipe && (
        <div className="px-5 pt-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-1 grid grid-cols-2 gap-1 shadow-sm">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  aria-pressed={active}
                  className={`py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition ${
                    active
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 relative">
        {recipe ? (
          <RecipeResult
            recipe={recipe}
            onBack={handleClearRecipe}
            onClearAll={handleClearRecipe}
          />
        ) : mode === 'auto' ? (
          <AutoFlow onResult={setRecipe} />
        ) : (
          <PhotoFlow onResult={setRecipe} />
        )}
      </div>
    </div>
  );
}

/* === 自動均衡模式 === */
function AutoFlow({ onResult }) {
  const { profile, metrics } = usePet();
  const { items, toggle, clear } = useKitchenIngredients();
  const [isCalculating, setIsCalculating] = useState(false);

  const handleGenerate = () => {
    if (items.length === 0) return;
    setIsCalculating(true);
    setTimeout(() => {
      const mealCalories = Math.round(metrics.der / MEALS_PER_DAY);
      onResult(generateRecipe(items, mealCalories));
      setIsCalculating(false);
    }, RECIPE_GENERATION_DELAY_MS);
  };

  const mealCalories = Math.round(metrics.der / MEALS_PER_DAY);

  return (
    <IngredientPicker
      selected={items}
      onToggle={toggle}
      onClear={clear}
      onGenerate={handleGenerate}
      isCalculating={isCalculating}
      petName={profile.name}
      mealCalories={mealCalories}
    />
  );
}

/* === 拍照模式 === */
function PhotoFlow({ onResult }) {
  const [step, setStep] = useState('capture'); // 'capture' | 'builder'
  const [entries, setEntries] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const vision = useVisionWorker();

  const catalogForVision = FOOD_DATABASE.filter(
    (f) => f.recipeRole !== 'excluded',
  ).map((f) => ({ id: f.id, name: f.name }));

  const handleAnalyze = async (dataUrl) => {
    try {
      const items = await vision.analyze(dataUrl, catalogForVision);
      setSuggestions(items);
      // 預填到 builder:把有對到 id 的轉成 entries(克數預設 50g)
      const seeded = items
        .map((it) => (it.id ? FOOD_DATABASE.find((f) => f.id === it.id) : null))
        .filter(Boolean)
        .map((food) => ({ food, grams: 50 }));
      setEntries(dedupe(seeded));
      setStep('builder');
    } catch (e) {
      // useVisionWorker 已記錯誤,UI 會顯示
    }
  };

  const handleSkip = () => {
    setSuggestions([]);
    setStep('builder');
  };

  const handleSubmit = () => {
    onResult(generateRecipeFromPortions(entries));
  };

  if (step === 'capture') {
    return (
      <PhotoCapture
        onAnalyze={handleAnalyze}
        onSkip={handleSkip}
        isAnalyzing={vision.isAnalyzing}
        error={vision.error}
        hasVision={vision.isAvailable}
      />
    );
  }
  return (
    <PortionBuilder
      entries={entries}
      suggestions={suggestions}
      onChange={setEntries}
      onSubmit={handleSubmit}
      onBack={() => setStep('capture')}
    />
  );
}

function dedupe(entries) {
  const seen = new Set();
  return entries.filter(({ food }) => {
    if (seen.has(food.id)) return false;
    seen.add(food.id);
    return true;
  });
}

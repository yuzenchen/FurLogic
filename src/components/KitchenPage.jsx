import React, { useState } from 'react';
import { generateRecipe } from '../utils/nutritionCalculator';
import { MEALS_PER_DAY } from '../utils/nutritionConstants';
import { usePet } from '../context/PetContext';
import useKitchenIngredients from '../hooks/useKitchenIngredients';
import IngredientPicker from './kitchen/IngredientPicker';
import RecipeResult from './kitchen/RecipeResult';

const RECIPE_GENERATION_DELAY_MS = 1200;

/**
 * AI 智能配餐頁面 — 容器
 */
export default function KitchenPage() {
  const { profile, metrics } = usePet();
  const { items, toggle, clear } = useKitchenIngredients();

  const [recipe, setRecipe] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleGenerate = () => {
    if (items.length === 0) return;
    setIsCalculating(true);
    setTimeout(() => {
      const mealCalories = Math.round(metrics.der / MEALS_PER_DAY);
      setRecipe(generateRecipe(items, mealCalories));
      setIsCalculating(false);
    }, RECIPE_GENERATION_DELAY_MS);
  };

  const handleClearAll = () => {
    clear();
    setRecipe(null);
  };

  if (recipe) {
    return (
      <RecipeResult
        recipe={recipe}
        onBack={() => setRecipe(null)}
        onClearAll={handleClearAll}
      />
    );
  }

  const mealCalories = Math.round(metrics.der / MEALS_PER_DAY);

  return (
    <IngredientPicker
      selected={items}
      onToggle={toggle}
      onClear={handleClearAll}
      onGenerate={handleGenerate}
      isCalculating={isCalculating}
      petName={profile.name}
      mealCalories={mealCalories}
    />
  );
}

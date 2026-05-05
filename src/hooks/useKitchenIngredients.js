import { useState, useEffect, useCallback } from 'react';
import { FOOD_DATABASE } from '../data/foodDatabase';
import {
  getKitchenIngredients,
  saveKitchenIngredients,
} from '../utils/storage';

/**
 * 廚房食材選擇 — 載入時過濾掉資料庫中已不存在的條目,
 * 自動寫回 localStorage,並提供 toggle / clear 操作。
 */
export default function useKitchenIngredients() {
  const [items, setItems] = useState(() => {
    const saved = getKitchenIngredients();
    if (!Array.isArray(saved) || saved.length === 0) return [];
    return saved.filter((s) => FOOD_DATABASE.some((d) => d.id === s.id));
  });

  useEffect(() => {
    saveKitchenIngredients(items);
  }, [items]);

  const toggle = useCallback((item) => {
    setItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item],
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, toggle, clear };
}

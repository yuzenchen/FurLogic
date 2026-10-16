import { useCallback, useMemo, useRef, useState } from 'react';
import { clearMealDraft, getMealDraft, saveMealDraft } from '../utils/storage';
import { emptyMealDraft, mealDraftReducer } from '../utils/mealDraft';

/** 從 localStorage 讀草稿;沒有食材的草稿重新依目前時間推測餐別 */
const loadDraft = () => {
  const stored = getMealDraft();
  if (!stored || stored.items.length === 0) return emptyMealDraft();
  return stored;
};

/**
 * 記餐草稿(存在 localStorage,切換分頁後重新掛載也會還原)。
 * 每個 action 先同步算出新狀態並寫入儲存,再更新 React 狀態 ——
 * 這樣即使呼叫後立刻切換分頁(元件卸載),草稿也不會遺失。
 */
export default function useMealDraft() {
  const [state, setState] = useState(loadDraft);
  const stateRef = useRef(state);

  const dispatch = useCallback((action) => {
    const next = mealDraftReducer(stateRef.current, action);
    if (next === stateRef.current) return;
    stateRef.current = next;
    if (action.type === 'clear') clearMealDraft();
    else saveMealDraft(next);
    setState(next);
  }, []);

  const actions = useMemo(
    () => ({
      setLabel: (label) => dispatch({ type: 'setLabel', label }),
      addFood: (food) => dispatch({ type: 'addFood', food }),
      removeFood: (id) => dispatch({ type: 'removeFood', id }),
      setGrams: (id, grams) => dispatch({ type: 'setGrams', id, grams }),
      bump: (id, delta) => dispatch({ type: 'bump', id, delta }),
      applyAllocation: (target) =>
        dispatch({ type: 'applyAllocation', target }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [dispatch],
  );

  return { ...state, ...actions };
}

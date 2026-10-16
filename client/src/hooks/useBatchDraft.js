import { useCallback, useMemo, useRef, useState } from 'react';
import { getBatchDraft, saveBatchDraft } from '../utils/storage';
import { batchDraftReducer, emptyBatchDraft } from '../utils/batchDraft';

const loadDraft = () => getBatchDraft() ?? emptyBatchDraft();

/**
 * 批次草稿(存在 localStorage,切換分頁後重新掛載也會還原;不送伺服器)。
 * 每個 action 先同步算出新狀態並寫入儲存,再更新 React 狀態 ——
 * 這樣即使呼叫後立刻切換分頁(元件卸載),草稿也不會遺失。
 */
export default function useBatchDraft() {
  const [state, setState] = useState(loadDraft);
  const stateRef = useRef(state);

  const dispatch = useCallback((action) => {
    const next = batchDraftReducer(stateRef.current, action);
    if (next === stateRef.current) return;
    stateRef.current = next;
    saveBatchDraft(next);
    setState(next);
  }, []);

  const actions = useMemo(
    () => ({
      setServings: (servings) => dispatch({ type: 'setServings', servings }),
      addFood: (food) => dispatch({ type: 'addFood', food }),
      removeFood: (id) => dispatch({ type: 'removeFood', id }),
      setGrams: (id, grams) => dispatch({ type: 'setGrams', id, grams }),
      bump: (id, delta) => dispatch({ type: 'bump', id, delta }),
      setVegWeightPct: (pct) => dispatch({ type: 'setVegWeightPct', pct }),
      applyAllocation: (servings, mealTarget) =>
        dispatch({ type: 'applyAllocation', servings, mealTarget }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [dispatch],
  );

  return { ...state, ...actions };
}

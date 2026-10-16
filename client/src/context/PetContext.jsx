import React, { createContext, useCallback, useContext, useMemo } from 'react';
import {
  DEFAULT_MEALS_PER_DAY,
  calculateActivityFactor,
  calculateDER,
  calculateRER,
  calculateWaterNeed,
  mealTargetCalories,
} from '@furlogic/shared';
import { getPets, updatePet } from '../api/client';
import useAsync from '../hooks/useAsync';

const PetContext = createContext(null);

/** 依毛孩資料計算 RER / DER / 單餐目標等指標 */
export function computePetMetrics(pet) {
  if (!pet) return null;
  const mealsPerDay = pet.mealsPerDay ?? DEFAULT_MEALS_PER_DAY;
  const rer = calculateRER(pet.weight);
  const factor = calculateActivityFactor(pet.isNeutered, pet.activityLevel);
  const der = calculateDER(rer, factor);
  const mealTargetRaw = mealTargetCalories(der, mealsPerDay);
  return {
    rer,
    factor: Math.round(factor * 100) / 100, // 去除浮點雜訊(1.4000000000000001)
    der,
    waterNeed: calculateWaterNeed(pet.weight),
    mealTarget: Math.round(mealTargetRaw),
    mealTargetRaw,
    mealsPerDay,
  };
}

export function PetProvider({ children }) {
  const {
    data: pets,
    loading,
    error,
    refetch,
    setData: setPets,
  } = useAsync((signal) => getPets({ signal }), []);
  const pet = pets?.[0] ?? null;
  const metrics = useMemo(() => computePetMetrics(pet), [pet]);

  /** PUT 部分欄位並更新本地資料;失敗時拋出 ApiError 給呼叫端顯示 */
  const savePet = useCallback(
    async (patch) => {
      if (!pet) throw new Error('尚未載入毛孩資料');
      const updated = await updatePet(pet.id, patch);
      setPets((list) =>
        (list ?? []).map((p) => (p.id === updated.id ? updated : p)),
      );
      return updated;
    },
    [pet, setPets],
  );

  const value = useMemo(
    () => ({ pet, loading, error, refetch, savePet, metrics }),
    [pet, loading, error, refetch, savePet, metrics],
  );
  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet() {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error('usePet must be used inside <PetProvider>');
  return ctx;
}

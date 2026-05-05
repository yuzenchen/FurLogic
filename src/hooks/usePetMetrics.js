import { useMemo } from 'react';
import {
  calculateRER,
  calculateDER,
  calculateActivityFactor,
  calculateWaterNeed,
} from '../utils/nutritionCalculator';

/**
 * 從毛孩檔案推算 RER / DER / 活動係數 / 飲水量。
 * 拆出來讓 PetContext 與測試共用。
 */
export default function usePetMetrics(profile) {
  return useMemo(() => {
    const rer = calculateRER(profile.weight);
    const factor = calculateActivityFactor(
      profile.isNeutered,
      profile.activityLevel,
    );
    const der = calculateDER(rer, factor);
    const waterNeed = calculateWaterNeed(profile.weight);
    return { rer, factor, der, waterNeed };
  }, [profile.weight, profile.isNeutered, profile.activityLevel]);
}

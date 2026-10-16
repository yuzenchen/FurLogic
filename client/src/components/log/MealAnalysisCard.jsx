import React from 'react';
import { Card, Stat } from '../ui';
import CaPRatioGauge from './CaPRatioGauge';
import MacroBars from './MacroBars';

/** 「營養分析」卡片;result 為 shared analyzeMeal 的回傳值 */
export default function MealAnalysisCard({ result }) {
  const { totals, macros, analysis, supplements } = result;
  return (
    <Card
      as="section"
      aria-labelledby="meal-analysis-title"
      className="space-y-4"
    >
      <h2 id="meal-analysis-title" className="font-semibold text-stone-900">
        營養分析
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="熱量" value={totals.calories} unit="kcal" />
        <Stat label="蛋白質" value={totals.protein} unit="g" />
        <Stat label="脂肪" value={totals.fat} unit="g" />
        <Stat label="碳水" value={macros.carbs.g} unit="g" />
      </div>
      <CaPRatioGauge analysis={analysis} />
      <MacroBars macros={macros} actualCalories={totals.calories} />
      {supplements.length > 0 && (
        <section aria-label="建議補充">
          <h3 className="mb-2 text-sm font-semibold text-stone-900">
            建議補充
          </h3>
          <ul className="space-y-1">
            {supplements.map((s) => (
              <li key={s.name} className="text-sm text-stone-800">
                <span className="font-semibold">{s.name}</span>
                <span className="tabular-nums"> — {s.amount}</span>
                <span className="text-stone-600">({s.reason})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

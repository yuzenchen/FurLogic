import React from 'react';
import { Card, Stat } from '../ui';
import CaPRatioGauge from './CaPRatioGauge';
import MacroBars from './MacroBars';

/** '3.1g' → '3.1 g'、'1顆' → '1 顆' */
const spaced = (amount) => String(amount).replace(/^([\d.]+)\s*/, '$1 ');

/** 克數類補充品(蛋殼粉)整批與每餐都要標;按顆計的(魚油)只標每餐 */
const isPerBatch = (amount) => /^[\d.]+\s*g$/.test(String(amount));

/**
 * 營養分析卡片。result 為 shared analyzeMeal 的回傳值(每餐);
 * batchSupplements 為整批的補充品清單,用來顯示「整批加 X・每餐 Y」。
 */
export default function MealAnalysisCard({
  result,
  title = '營養分析',
  batchSupplements,
}) {
  const { totals, macros, analysis, supplements } = result;
  const batchAmount = (name) =>
    batchSupplements?.find((s) => s.name === name)?.amount;

  return (
    <Card
      as="section"
      aria-labelledby="meal-analysis-title"
      className="space-y-4"
    >
      <h2 id="meal-analysis-title" className="font-semibold text-stone-900">
        {title}
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
            {supplements.map((s) => {
              const whole = batchAmount(s.name);
              const amountText =
                whole && isPerBatch(s.amount)
                  ? `整批加 ${spaced(whole)}・每餐 ${spaced(s.amount)}`
                  : `每餐 ${spaced(s.amount)}`;
              return (
                <li key={s.name} className="text-sm text-stone-800">
                  <span className="font-semibold">{s.name}</span>
                  <span className="tabular-nums"> — {amountText}</span>
                  <span className="text-stone-600">({s.reason})</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Card>
  );
}

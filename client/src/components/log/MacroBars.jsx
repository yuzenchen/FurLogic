import React from 'react';
import { Activity } from 'lucide-react';

/**
 * 蛋白質 / 脂肪 / 碳水的橫向 stacked bar + 各別 g 數
 */
export default function MacroBars({ macros, actualCalories }) {
  const rows = [
    {
      key: 'protein',
      label: '蛋白質',
      tone: 'bg-orange-500',
      text: 'text-orange-700',
    },
    { key: 'fat', label: '脂肪', tone: 'bg-amber-400', text: 'text-amber-700' },
    {
      key: 'carbs',
      label: '碳水',
      tone: 'bg-emerald-500',
      text: 'text-emerald-700',
    },
  ];

  return (
    <section>
      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Activity size={16} /> 巨集營養素{' '}
        {actualCalories != null && (
          <span className="text-xs font-normal text-gray-400">
            ({actualCalories} kcal 實際)
          </span>
        )}
      </h3>

      {/* Stacked overview bar */}
      <div className="h-2 rounded-full overflow-hidden flex bg-gray-100 mb-4">
        {rows.map(({ key, tone }) => (
          <div
            key={key}
            className={tone}
            style={{ width: `${macros[key].pct}%` }}
            aria-hidden
          />
        ))}
      </div>

      <ul className="space-y-2">
        {rows.map(({ key, label, tone, text }) => (
          <li key={key} className="flex items-center gap-3">
            <span className={`text-xs font-bold w-12 ${text}`}>{label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${tone} transition-all`}
                style={{ width: `${macros[key].pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 font-mono w-20 text-right">
              {macros[key].g}g · {macros[key].pct}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

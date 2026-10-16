import React from 'react';

const ROWS = [
  { key: 'protein', label: '蛋白質', tone: 'bg-orange-500' },
  { key: 'fat', label: '脂肪', tone: 'bg-amber-400' },
  { key: 'carbs', label: '碳水', tone: 'bg-emerald-500' },
];

/**
 * 蛋白質 / 脂肪 / 碳水的熱量占比(總覽堆疊條 + 各別橫條與 g 數)。
 * macros 來自 shared computeMacros:{ protein|fat|carbs: { g, pct } }
 */
export default function MacroBars({ macros, actualCalories }) {
  return (
    <section aria-label="三大營養素熱量占比">
      <h3 className="mb-2 text-sm font-semibold text-stone-900">
        三大營養素
        {actualCalories != null && (
          <span className="ml-1 font-normal text-stone-600 tabular-nums">
            ({actualCalories} kcal)
          </span>
        )}
      </h3>

      <div
        className="mb-3 flex h-2 overflow-hidden rounded-full bg-stone-100"
        aria-hidden="true"
      >
        {ROWS.map(({ key, tone }) => (
          <div
            key={key}
            className={tone}
            style={{ width: `${macros?.[key]?.pct ?? 0}%` }}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {ROWS.map(({ key, label, tone }) => {
          const m = macros?.[key] ?? { g: 0, pct: 0 };
          return (
            <li key={key} className="flex items-center gap-3">
              <span className="w-12 text-xs font-semibold text-stone-800">
                {label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full ${tone} transition-[width] motion-reduce:transition-none`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <span className="w-20 text-right text-xs text-stone-600 tabular-nums">
                {m.g}g · {m.pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

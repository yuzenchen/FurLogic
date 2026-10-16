import React from 'react';

/** 小型數值區塊 */
export default function Stat({ label, value, unit, hint }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-stone-600">{label}</div>
      <div className="text-lg font-semibold text-stone-900 tabular-nums">
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-normal text-stone-600">
            {unit}
          </span>
        )}
      </div>
      {hint && <div className="text-xs text-stone-600">{hint}</div>}
    </div>
  );
}

import React from 'react';
import { FOCUS_RING, cx } from '../ui';

/**
 * 分段選擇(radiogroup)。options: [{ value, label }]
 * 選中 bg-orange-700 白字;其他白底 + stone-300 邊框。
 */
export default function Segmented({
  label,
  value,
  options,
  onChange,
  labelId,
}) {
  return (
    <div
      role="radiogroup"
      aria-label={labelId ? undefined : label}
      aria-labelledby={labelId}
      className="flex gap-2"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cx(
              'h-11 flex-1 min-w-0 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors',
              selected
                ? 'bg-orange-700 text-white'
                : 'bg-white border border-stone-300 text-stone-800 hover:bg-stone-50',
              FOCUS_RING,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

import React from 'react';

const TONES = {
  orange: 'text-orange-500',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
};

/**
 * 環狀進度(純 SVG)。從 12 點鐘方向順時針;超過 max 時畫滿並改用 rose。
 * label 為 aria-label(請務必提供,例如「今日 820 / 1000 kcal」)。
 */
export default function ProgressRing({
  value = 0,
  max = 100,
  size = 200,
  stroke = 16,
  tone = 'orange',
  label,
  children,
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const ratio = max > 0 ? safeValue / max : 0;
  const over = ratio > 1;
  const progress = Math.min(1, ratio);
  const toneClass = TONES[over ? 'rose' : tone] ?? TONES.orange;
  const center = size / 2;

  return (
    <div
      role="img"
      aria-label={label}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-stone-200"
          />
          {progress > 0 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className={`${toneClass} transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none`}
            />
          )}
        </g>
      </svg>
      {children != null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}

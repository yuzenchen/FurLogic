import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import {
  CAP_RATIO_MIN_GOOD,
  CAP_RATIO_MAX_GOOD,
} from '../../utils/nutritionConstants';

/**
 * Ca:P 比例視覺化色帶 + 指針
 * 比例軸 0 ~ 3,綠色帶為 1.0–2.0(理想範圍)。
 */
export default function CaPRatioGauge({ analysis }) {
  const ratio = Number(analysis.ratio) || 0;
  const isGood = analysis.status === 'good';
  const isUnknown = analysis.status === 'unknown';
  const isLow = analysis.status === 'low';

  const SCALE_MIN = 0;
  const SCALE_MAX = 3;
  const clamped = Math.min(Math.max(ratio, SCALE_MIN), SCALE_MAX);
  const pct = ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const goodStartPct =
    ((CAP_RATIO_MIN_GOOD - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const goodEndPct =
    ((CAP_RATIO_MAX_GOOD - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const goodWidthPct = goodEndPct - goodStartPct;

  const tone = isUnknown ? 'gray' : isGood ? 'green' : isLow ? 'amber' : 'rose';

  const containerClass = {
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
    rose: 'bg-rose-50 border-rose-200',
    gray: 'bg-gray-50 border-gray-200',
  }[tone];

  const titleClass = {
    green: 'text-green-800',
    amber: 'text-amber-800',
    rose: 'text-rose-800',
    gray: 'text-gray-800',
  }[tone];

  return (
    <section
      className={`p-4 rounded-2xl border ${containerClass}`}
      aria-label="鈣磷比分析"
    >
      <div className="flex items-center gap-2 mb-3">
        {isGood ? (
          <Check size={18} className="text-green-600" />
        ) : (
          <AlertTriangle
            size={18}
            className={
              tone === 'amber'
                ? 'text-amber-600'
                : tone === 'rose'
                  ? 'text-rose-600'
                  : 'text-gray-500'
            }
          />
        )}
        <h3 className={`font-bold text-sm ${titleClass}`}>
          鈣磷比分析{!isUnknown && ` (Ca:P = 1:${analysis.ratio})`}
        </h3>
      </div>

      {!isUnknown && (
        <div
          className="relative h-3 rounded-full bg-gray-200 mb-2 overflow-visible"
          role="img"
          aria-label={`鈣磷比 ${ratio.toFixed(2)},理想範圍 ${CAP_RATIO_MIN_GOOD}–${CAP_RATIO_MAX_GOOD}`}
        >
          {/* 綠色理想區段 */}
          <div
            className="absolute inset-y-0 bg-green-300/70"
            style={{
              left: `${goodStartPct}%`,
              width: `${goodWidthPct}%`,
            }}
          />
          {/* 指針 */}
          <div
            className={`absolute -top-1 -bottom-1 w-1 rounded-full shadow ${
              isGood
                ? 'bg-green-700'
                : tone === 'amber'
                  ? 'bg-amber-600'
                  : 'bg-rose-600'
            }`}
            style={{ left: `calc(${pct}% - 2px)` }}
          />
        </div>
      )}

      {!isUnknown && (
        <div className="flex justify-between text-[10px] text-gray-500 mb-3 font-mono">
          <span>0</span>
          <span>1.0</span>
          <span>2.0</span>
          <span>3.0+</span>
        </div>
      )}

      <p className="text-xs text-gray-600 leading-relaxed">{analysis.advice}</p>
    </section>
  );
}

import React from 'react';
import { AlertTriangle, Check, HelpCircle } from 'lucide-react';
import { CAP_RATIO_MAX_GOOD, CAP_RATIO_MIN_GOOD } from '@furlogic/shared';

const SCALE_MIN = 0;
const SCALE_MAX = 3;
const toPct = (v) => ((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

const TONES = {
  good: { icon: Check, text: 'text-emerald-700', pointer: 'bg-emerald-700' },
  low: { icon: AlertTriangle, text: 'text-amber-700', pointer: 'bg-amber-700' },
  high: { icon: AlertTriangle, text: 'text-rose-700', pointer: 'bg-rose-700' },
  unknown: {
    icon: HelpCircle,
    text: 'text-stone-600',
    pointer: 'bg-stone-600',
  },
};

/**
 * 鈣磷比(Ca:P)色帶 + 指針。比例軸 0–3,emerald 區段為理想範圍。
 * analysis 來自 shared analyzeCaPRatio:{ ratio, status: good|low|high|unknown, advice }
 */
export default function CaPRatioGauge({ analysis }) {
  const ratio = Number(analysis?.ratio) || 0;
  const status = TONES[analysis?.status] ? analysis.status : 'unknown';
  const isUnknown = status === 'unknown';
  const { icon: Icon, text, pointer } = TONES[status];

  const clamped = Math.min(Math.max(ratio, SCALE_MIN), SCALE_MAX);
  const goodStart = toPct(CAP_RATIO_MIN_GOOD);
  const goodWidth = toPct(CAP_RATIO_MAX_GOOD) - goodStart;

  return (
    <section aria-label="鈣磷比分析">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={18} className={text} aria-hidden="true" />
        <h3 className="text-sm font-semibold text-stone-900">
          鈣磷比
          {!isUnknown && (
            <span className="ml-1 font-normal text-stone-600 tabular-nums">
              Ca:P = {ratio.toFixed(2)}:1
            </span>
          )}
        </h3>
      </div>

      {!isUnknown && (
        <>
          <div
            className="relative mb-1 h-3 rounded-full bg-stone-200"
            role="img"
            aria-label={`鈣磷比 ${ratio.toFixed(2)},理想範圍 ${CAP_RATIO_MIN_GOOD}–${CAP_RATIO_MAX_GOOD}`}
          >
            <div
              className="absolute inset-y-0 bg-emerald-200"
              style={{ left: `${goodStart}%`, width: `${goodWidth}%` }}
            />
            <div
              className={`absolute -top-1 -bottom-1 w-1 rounded-full ${pointer}`}
              style={{ left: `calc(${toPct(clamped)}% - 2px)` }}
            />
          </div>
          <div
            className="mb-2 flex justify-between text-xs text-stone-600 tabular-nums"
            aria-hidden="true"
          >
            <span>0</span>
            <span>1.0</span>
            <span>2.0</span>
            <span>3.0+</span>
          </div>
        </>
      )}

      <p className={`text-sm ${isUnknown ? 'text-stone-600' : text}`}>
        {analysis?.advice}
      </p>
    </section>
  );
}

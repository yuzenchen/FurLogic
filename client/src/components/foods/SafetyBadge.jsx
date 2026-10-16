import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

const SAFETY = {
  safe: {
    label: '安全',
    icon: Check,
    className: 'text-emerald-700 bg-emerald-50',
  },
  caution: {
    label: '注意',
    icon: AlertTriangle,
    className: 'text-amber-700 bg-amber-50',
  },
  toxic: { label: '禁止', icon: X, className: 'text-rose-700 bg-rose-50' },
};

/** 食材安全性膠囊(圖示 + 文字) */
export default function SafetyBadge({ safety }) {
  const { label, icon: Icon, className } = SAFETY[safety] ?? SAFETY.safe;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

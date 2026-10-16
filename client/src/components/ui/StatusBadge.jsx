import React from 'react';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';

const STATUS = {
  under: { icon: ArrowDown, className: 'text-amber-700 bg-amber-50' },
  met: { icon: Check, className: 'text-emerald-700 bg-emerald-50' },
  over: { icon: ArrowUp, className: 'text-rose-700 bg-rose-50' },
};

/** 狀態膠囊(圖示 + 文字,不只靠顏色)。children 為文字標籤 */
export default function StatusBadge({ status = 'met', children }) {
  const { icon: Icon, className } = STATUS[status] ?? STATUS.met;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  );
}

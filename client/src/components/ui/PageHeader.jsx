import React from 'react';

/** 頁面標題列 */
export default function PageHeader({ title, subtitle, action }) {
  return (
    <header className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        {subtitle && <p className="text-sm text-stone-600 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

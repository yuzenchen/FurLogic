import React from 'react';

/** 空狀態;icon 傳 lucide 元件 */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      {Icon && (
        <Icon size={40} className="text-stone-400 mb-3" aria-hidden="true" />
      )}
      {title && <p className="font-semibold text-stone-800">{title}</p>}
      {description && (
        <p className="text-sm text-stone-600 mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

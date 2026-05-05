import React, { useState } from 'react';
import { Search, Check, AlertTriangle, X } from 'lucide-react';
import { FOOD_DATABASE, SAFETY_LEVELS } from '../data/foodDatabase';

/**
 * 食材知識庫查詢頁面
 */

const SAFETY_THEME = {
  safe: {
    badge: 'bg-green-100 text-green-700',
    accent: 'bg-green-400',
    cardBorder: 'border-l-4 border-l-green-400',
    icon: Check,
  },
  caution: {
    badge: 'bg-amber-100 text-amber-700',
    accent: 'bg-amber-400',
    cardBorder: 'border-l-4 border-l-amber-400',
    icon: AlertTriangle,
  },
  toxic: {
    badge: 'bg-rose-100 text-rose-700',
    accent: 'bg-rose-500',
    cardBorder: 'border-l-4 border-l-rose-500',
    icon: X,
  },
};

function SafetyBadge({ safety }) {
  const meta = SAFETY_LEVELS[safety];
  const theme = SAFETY_THEME[safety];
  if (!meta || !theme) return null;
  const Icon = theme.icon;
  return (
    <span
      className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${theme.badge}`}
    >
      <Icon size={12} /> {meta.label}
    </span>
  );
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const term = searchTerm.trim().toLowerCase();
  const filteredItems = FOOD_DATABASE.filter((item) => {
    if (!term) return true;
    return (
      item.name.toLowerCase().includes(term) ||
      (item.desc && item.desc.toLowerCase().includes(term))
    );
  });

  const counts = filteredItems.reduce(
    (acc, item) => {
      acc[item.safety] = (acc[item.safety] ?? 0) + 1;
      return acc;
    },
    { safe: 0, caution: 0, toxic: 0 },
  );

  return (
    <div className="p-5 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="font-bold text-2xl text-gray-800">食材知識庫</h2>
        <div className="flex gap-2 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-green-700">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            {counts.safe}
          </span>
          <span className="flex items-center gap-1 text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {counts.caution}
          </span>
          <span className="flex items-center gap-1 text-rose-700">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {counts.toxic}
          </span>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
        <input
          type="search"
          placeholder="輸入食材名稱 (例: 雞肉)"
          aria-label="搜尋食材"
          className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
        {filteredItems.map((item) => {
          const theme = SAFETY_THEME[item.safety];
          return (
            <article
              key={item.id}
              className={`bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition ${theme?.cardBorder ?? ''}`}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg text-gray-800">{item.name}</h3>
                <SafetyBadge safety={item.safety} />
              </div>
              <p className="text-sm text-gray-600 mt-2 mb-3">{item.desc}</p>

              <div className="flex flex-wrap gap-2 text-xs font-mono mb-2">
                <Stat label="kcal" value={item.calories} icon="🔥" />
                <Stat label="Ca" value={`${item.ca}mg`} />
                <Stat label="P" value={`${item.p}mg`} />
              </div>

              {item.warning && (
                <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl flex items-start gap-2 font-medium border border-rose-100">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {item.warning}
                </div>
              )}
            </article>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p>找不到相關食材</p>
            <p className="text-xs mt-2">試試看「南瓜」或「巧克力」</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-md inline-flex items-center gap-1">
      {icon && <span aria-hidden>{icon}</span>}
      {!icon && <span className="text-gray-400">{label}:</span>}
      <span className="text-gray-800 font-bold">{value}</span>
    </span>
  );
}

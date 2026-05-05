import React, { useState } from 'react';
import { Search, Check, AlertTriangle, X } from 'lucide-react';
import { FOOD_DATABASE, SAFETY_LEVELS } from '../data/foodDatabase';

/**
 * 食材知識庫查詢頁面
 */

const TONE_CLASSES = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

const TONE_ICONS = {
  green: Check,
  yellow: AlertTriangle,
  red: X,
};

function SafetyBadge({ safety }) {
  const meta = SAFETY_LEVELS[safety];
  if (!meta) return null;
  const Icon = TONE_ICONS[meta.tone];
  return (
    <span
      className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${TONE_CLASSES[meta.tone]}`}
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

  return (
    <div className="p-5 h-full flex flex-col animate-in fade-in duration-300">
      <h2 className="font-bold text-2xl text-gray-800 mb-4">食材知識庫</h2>

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
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition"
          >
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-lg text-gray-800">{item.name}</h3>
              <SafetyBadge safety={item.safety} />
            </div>
            <p className="text-sm text-gray-600 mt-2 mb-3">{item.desc}</p>

            <div className="flex gap-3 text-xs text-gray-400 mb-2">
              <span>🔥 {item.calories} kcal</span>
              <span>Ca: {item.ca}mg</span>
              <span>P: {item.p}mg</span>
            </div>

            {item.warning && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl flex items-start gap-2 font-medium">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {item.warning}
              </div>
            )}
          </div>
        ))}

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

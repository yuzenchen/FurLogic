import React from 'react';
import { Activity, Info, Search, ChefHat } from 'lucide-react';

/**
 * 首頁 - 健康儀表板
 */
export default function HomePage({ petProfile, rer, der, waterNeed, onNavigate }) {
  return (
    <div className="p-5 space-y-6 animate-in fade-in duration-300">
      {/* 熱量卡片 */}
      <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-8 -translate-y-4">
          <Activity size={140} />
        </div>
        <p className="text-orange-100 text-sm font-medium mb-1 flex items-center gap-1">
          <Activity size={14} /> 每日代謝能需求 (DER)
        </p>
        <div className="flex items-baseline gap-2">
          <h2 className="text-5xl font-bold tracking-tight">{der}</h2>
          <span className="text-lg opacity-80 font-medium">kcal</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/20">
          <div>
            <p className="text-xs text-orange-100 mb-1">RER (基礎代謝)</p>
            <p className="font-bold text-lg">
              {rer} <span className="text-xs font-normal opacity-70">kcal</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-orange-100 mb-1">建議飲水量</p>
            <p className="font-bold text-lg">
              {waterNeed} <span className="text-xs font-normal opacity-70">ml</span>
            </p>
          </div>
        </div>
      </div>

      {/* 功能快捷卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-orange-200 transition cursor-pointer"
          onClick={() => onNavigate('search')}
        >
          <div className="absolute right-2 top-2 bg-green-100 p-2 rounded-full text-green-600 group-hover:scale-110 transition">
            <Search size={20} />
          </div>
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
            Database
          </span>
          <div>
            <h3 className="font-bold text-lg text-gray-800">能不能吃?</h3>
            <p className="text-xs text-gray-400 mt-1">查詢食材安全等級</p>
          </div>
        </div>

        <div
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-orange-200 transition cursor-pointer"
          onClick={() => onNavigate('kitchen')}
        >
          <div className="absolute right-2 top-2 bg-orange-100 p-2 rounded-full text-orange-600 group-hover:scale-110 transition">
            <ChefHat size={20} />
          </div>
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
            AI Kitchen
          </span>
          <div>
            <h3 className="font-bold text-lg text-gray-800">配餐計算</h3>
            <p className="text-xs text-gray-400 mt-1">智慧食譜生成</p>
          </div>
        </div>
      </div>

      {/* 衛教小卡 */}
      <div className="bg-blue-50 rounded-2xl p-4 flex gap-4 border border-blue-100">
        <div className="bg-white p-2 rounded-xl h-fit shadow-sm text-blue-500">
          <Info size={24} />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 text-sm">為什麼要關注鈣磷比?</h4>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            長期只吃純肉(高磷)會導致鈣質流失,引發「營養性繼發性副甲狀腺亢進」,造成骨質疏鬆。記得添加蛋殼粉喔!
          </p>
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import {
  Activity,
  Info,
  Search,
  ChefHat,
  Droplets,
  Flame,
  Sparkles,
} from 'lucide-react';
import { usePet } from '../context/PetContext';
import { MEALS_PER_DAY } from '../utils/nutritionConstants';

/**
 * 首頁 - 健康儀表板
 */
export default function HomePage({ onNavigate }) {
  const { profile, metrics } = usePet();
  const { rer, der, waterNeed, factor } = metrics;

  // 活動加成佔 DER 的比例,用來在 DER 卡上畫一個視覺指示
  const activityBoost = der > 0 ? Math.min(100, ((der - rer) / der) * 100) : 0;
  const perMeal = Math.round(der / MEALS_PER_DAY);

  return (
    <div className="p-5 space-y-6 animate-in fade-in duration-300">
      {/* DER 主卡 */}
      <section
        className="bg-gradient-to-br from-orange-500 via-orange-500 to-red-500 text-white rounded-3xl p-6 shadow-xl shadow-orange-200/60 relative overflow-hidden"
        aria-label="每日代謝能需求"
      >
        <div className="absolute -top-6 -right-6 opacity-10">
          <Sparkles size={160} />
        </div>

        <p className="text-orange-100 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
          <Flame size={12} /> Daily Energy Requirement
        </p>

        <div className="flex items-baseline gap-2">
          <h2 className="text-5xl font-bold tracking-tight tabular-nums">
            {der}
          </h2>
          <span className="text-lg opacity-80 font-medium">kcal</span>
          <span className="ml-auto text-xs bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/20">
            一餐 ≈ {perMeal} kcal
          </span>
        </div>

        {/* RER -> DER 視覺化拆解條 */}
        <div className="mt-5 mb-1">
          <div className="h-2 rounded-full bg-white/20 overflow-hidden flex">
            <div
              className="bg-white"
              style={{ width: `${100 - activityBoost}%` }}
              aria-hidden
            />
            <div
              className="bg-yellow-200"
              style={{ width: `${activityBoost}%` }}
              aria-hidden
            />
          </div>
          <div className="flex justify-between text-[10px] text-orange-100 mt-1.5 font-medium">
            <span>基礎代謝 {rer} kcal</span>
            <span>+ 活動加成 ×{factor.toFixed(1)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-white/20">
          <div>
            <p className="text-[11px] text-orange-100 mb-1 flex items-center gap-1">
              <Activity size={10} /> RER 基礎代謝
            </p>
            <p className="font-bold text-lg tabular-nums">
              {rer} <span className="text-xs font-normal opacity-70">kcal</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-orange-100 mb-1 flex items-center gap-1">
              <Droplets size={10} /> 建議飲水量
            </p>
            <p className="font-bold text-lg tabular-nums">
              {waterNeed}{' '}
              <span className="text-xs font-normal opacity-70">ml</span>
            </p>
          </div>
        </div>
      </section>

      {/* 毛孩快覽小條 */}
      <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
            Pet Profile
          </p>
          <p className="font-bold text-gray-800 mt-0.5">
            {profile.name}
            <span className="text-gray-400 font-normal text-sm ml-2">
              {profile.weight} kg · {profile.isNeutered ? '已結紮' : '未結紮'}
            </span>
          </p>
        </div>
        <ActivityChip level={profile.activityLevel} />
      </div>

      {/* 功能快捷卡片 */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('search')}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-green-300 hover:shadow-md transition cursor-pointer text-left active:scale-[0.98]"
        >
          <div className="absolute right-2 top-2 bg-green-100 p-2 rounded-full text-green-600 group-hover:scale-110 group-hover:rotate-3 transition">
            <Search size={20} />
          </div>
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
            Database
          </span>
          <div>
            <h3 className="font-bold text-lg text-gray-800">能不能吃?</h3>
            <p className="text-xs text-gray-400 mt-1">查詢食材安全等級</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('kitchen')}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-orange-300 hover:shadow-md transition cursor-pointer text-left active:scale-[0.98]"
        >
          <div className="absolute right-2 top-2 bg-orange-100 p-2 rounded-full text-orange-600 group-hover:scale-110 group-hover:rotate-3 transition">
            <ChefHat size={20} />
          </div>
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
            AI Kitchen
          </span>
          <div>
            <h3 className="font-bold text-lg text-gray-800">配餐計算</h3>
            <p className="text-xs text-gray-400 mt-1">智慧食譜生成</p>
          </div>
        </button>
      </div>

      {/* 衛教小卡 */}
      <div className="bg-blue-50 rounded-2xl p-4 flex gap-4 border border-blue-100">
        <div className="bg-white p-2 rounded-xl h-fit shadow-sm text-blue-500">
          <Info size={24} />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 text-sm">
            為什麼要關注鈣磷比?
          </h4>
          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
            長期只吃純肉(高磷)會導致鈣質流失,引發「營養性繼發性副甲狀腺亢進」,造成骨質疏鬆。記得添加蛋殼粉喔!
          </p>
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_CHIP = {
  low: { label: '慵懶', tone: 'bg-blue-100 text-blue-700' },
  normal: { label: '一般', tone: 'bg-emerald-100 text-emerald-700' },
  high: { label: '好動', tone: 'bg-rose-100 text-rose-700' },
};

function ActivityChip({ level }) {
  const meta = ACTIVITY_CHIP[level] ?? ACTIVITY_CHIP.normal;
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${meta.tone}`}>
      {meta.label}
    </span>
  );
}

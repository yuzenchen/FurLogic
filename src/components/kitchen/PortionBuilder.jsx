import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  ChefHat,
  Drumstick,
  Leaf,
  Search,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { FOOD_DATABASE } from '../../data/foodDatabase';

/**
 * 已選食材清單 + 每項的克數輸入。
 * 可以「新增食材」(打開搜尋面板),也可以從 AI 預填的條目繼續編輯。
 *
 * Props:
 *   entries: [{ food, grams }]  — 受控狀態
 *   suggestions?: [{ id?, name, confidence }]  — AI 認出的食材,給 UI 顯示信心
 *   onChange(entries)
 *   onSubmit() / onBack()
 */
const PICKABLE_FOODS = FOOD_DATABASE.filter((i) => i.recipeRole !== 'excluded');

export default function PortionBuilder({
  entries,
  suggestions = [],
  onChange,
  onSubmit,
  onBack,
}) {
  const [showPicker, setShowPicker] = useState(false);

  const totalGrams = useMemo(
    () => entries.reduce((s, e) => s + (Number(e.grams) || 0), 0),
    [entries],
  );
  const totalCalories = useMemo(
    () =>
      Math.round(
        entries.reduce(
          (s, e) =>
            s + ((e.food?.calories ?? 0) * (Number(e.grams) || 0)) / 100,
          0,
        ),
      ),
    [entries],
  );

  const updateGrams = (idx, raw) => {
    const next = entries.slice();
    const parsed = parseFloat(raw);
    next[idx] = {
      ...next[idx],
      grams: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    };
    onChange(next);
  };

  const remove = (idx) => {
    const next = entries.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const add = (food) => {
    if (entries.some((e) => e.food.id === food.id)) {
      setShowPicker(false);
      return;
    }
    onChange([...entries, { food, grams: 50 }]);
    setShowPicker(false);
  };

  const valid = entries.length > 0 && totalGrams > 0;

  return (
    <div className="p-5 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          className="p-1 hover:bg-gray-100 rounded-full"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="font-bold text-2xl text-gray-800">食材與份量</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4 ml-7">
        確認 {entries.length > 0 ? '清單' : '加入食材'},並輸入每樣的克數。
      </p>

      {suggestions.length > 0 && <SuggestionStrip suggestions={suggestions} />}

      <div className="flex-1 overflow-y-auto -mx-5 px-5 mb-32">
        {entries.length === 0 ? (
          <EmptyState onAdd={() => setShowPicker(true)} />
        ) : (
          <ul className="space-y-2">
            {entries.map((entry, idx) => (
              <EntryRow
                key={`${entry.food.id}-${idx}`}
                entry={entry}
                onGramsChange={(v) => updateGrams(idx, v)}
                onRemove={() => remove(idx)}
              />
            ))}
            <li>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-3 text-gray-500 font-medium flex items-center justify-center gap-2 hover:border-gray-400 active:scale-[0.99] transition"
              >
                <Plus size={16} /> 新增食材
              </button>
            </li>
          </ul>
        )}
      </div>

      <div className="absolute bottom-20 left-0 w-full px-5 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent pt-12 pb-5 space-y-3">
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex justify-between items-center">
          <div className="text-xs text-gray-500">
            合計 {entries.length} 項 · {totalGrams.toFixed(0)} g
          </div>
          <div className="font-bold text-gray-900 tabular-nums">
            {totalCalories}{' '}
            <span className="text-xs font-normal text-gray-400">kcal</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!valid}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex justify-center items-center gap-2 active:scale-95 transition ${
            valid
              ? 'bg-gradient-to-r from-orange-500 to-red-500'
              : 'bg-gray-300 cursor-not-allowed shadow-none'
          }`}
        >
          <ChefHat size={20} />
          {valid ? '產生配餐建議' : '至少輸入一項食材'}
        </button>
      </div>

      {showPicker && (
        <FoodPickerSheet
          excluded={entries.map((e) => e.food.id)}
          onPick={add}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="text-center py-8">
      <p className="text-sm text-gray-500 mb-4">還沒有食材</p>
      <button
        type="button"
        onClick={onAdd}
        className="bg-gray-900 text-white font-bold rounded-xl px-5 py-3 inline-flex items-center gap-2 active:scale-95 transition shadow-md"
      >
        <Plus size={16} /> 新增食材
      </button>
    </div>
  );
}

function EntryRow({ entry, onGramsChange, onRemove }) {
  const { food, grams } = entry;
  const isProtein = food.recipeRole === 'protein';
  return (
    <li className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isProtein
            ? 'bg-orange-100 text-orange-600'
            : 'bg-emerald-100 text-emerald-600'
        }`}
      >
        {isProtein ? <Drumstick size={18} /> : <Leaf size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 truncate">{food.name}</p>
        <p className="text-[11px] text-gray-400 font-mono">
          {food.calories} kcal/100g · Ca {food.ca}mg · P {food.p}mg
        </p>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={grams === 0 ? '' : grams}
          placeholder="0"
          onChange={(e) => onGramsChange(e.target.value)}
          aria-label={`${food.name} 克數`}
          className="w-16 p-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-right outline-none focus:ring-2 focus:ring-orange-500"
        />
        <span className="text-xs text-gray-500 mr-1">g</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`移除 ${food.name}`}
          className="p-1.5 text-gray-400 hover:text-rose-500 active:scale-90 transition"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}

function SuggestionStrip({ suggestions }) {
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 mb-4 text-xs">
      <p className="text-orange-700 font-bold flex items-center gap-1.5 mb-1.5">
        <Sparkles size={12} /> AI 認出 {suggestions.length} 項
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s, i) => (
          <span
            key={i}
            className="bg-white text-orange-700 px-2 py-0.5 rounded-full border border-orange-200 inline-flex items-center gap-1"
          >
            {s.name}
            <span className="text-orange-400 font-mono text-[10px]">
              {Math.round((s.confidence ?? 0) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FoodPickerSheet({ excluded, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const list = PICKABLE_FOODS.filter((f) => {
    if (excluded.includes(f.id)) return false;
    if (!term) return true;
    return f.name.toLowerCase().includes(term);
  });

  return (
    <div className="absolute inset-0 z-40 bg-black/40 flex items-end animate-in fade-in duration-200">
      <div
        className="bg-white w-full rounded-t-3xl p-5 max-h-[75%] flex flex-col animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-label="新增食材"
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg text-gray-800">新增食材</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-400 underline"
          >
            取消
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 text-gray-400" size={16} />
          <input
            type="search"
            placeholder="搜尋食材"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="overflow-y-auto -mx-5 px-5 flex-1">
          <ul className="grid grid-cols-2 gap-2">
            {list.map((food) => {
              const isProtein = food.recipeRole === 'protein';
              return (
                <li key={food.id}>
                  <button
                    type="button"
                    onClick={() => onPick(food)}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:shadow-sm active:scale-[0.98] transition"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {isProtein ? (
                        <Drumstick size={12} className="text-orange-500" />
                      ) : (
                        <Leaf size={12} className="text-emerald-500" />
                      )}
                      <span className="font-bold text-gray-800 text-sm">
                        {food.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {food.calories} kcal/100g
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="col-span-2 text-center text-gray-400 text-sm py-6">
                沒有相符的食材
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

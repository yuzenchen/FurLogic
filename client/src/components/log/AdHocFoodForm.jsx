import React, { useState } from 'react';
import { Drumstick, Leaf, X } from 'lucide-react';

/**
 * 臨時食材輸入 form。給拍照時 AI 認得出但 FOOD_DATABASE 還沒收的食材使用,
 * 或使用者冰箱有 / DB 沒有的食材。
 *
 * 提交後會傳回一個跟 FOOD_DATABASE 條目同形狀的物件,id 為負整數
 * 以避免與資料庫衝突。
 */
const PRESETS_BY_ROLE = {
  protein: { calories: 130, protein: 20, fat: 5, ca: 8, p: 200 },
  plant: { calories: 30, protein: 1.5, fat: 0.2, ca: 30, p: 35 },
};

let tempIdCounter = -1;
const nextTempId = () => tempIdCounter--;

export default function AdHocFoodForm({
  initialName = '',
  onSubmit,
  onCancel,
}) {
  const [role, setRole] = useState('protein');
  const [name, setName] = useState(initialName);
  const [vals, setVals] = useState(PRESETS_BY_ROLE.protein);

  const switchRole = (next) => {
    setRole(next);
    setVals(PRESETS_BY_ROLE[next]);
  };

  const setNum = (key) => (e) => {
    const parsed = parseFloat(e.target.value);
    setVals((v) => ({
      ...v,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    }));
  };

  const valid = name.trim().length > 0 && vals.calories > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      id: nextTempId(),
      name: name.trim(),
      type: role === 'protein' ? 'protein' : 'veg',
      recipeRole: role,
      safety: 'safe',
      calories: vals.calories,
      protein: vals.protein,
      fat: vals.fat,
      ca: vals.ca,
      p: vals.p,
      desc: '使用者自訂食材(臨時)',
      warning: null,
      isAdHoc: true,
    });
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/40 flex items-end animate-in fade-in duration-200">
      <div
        className="bg-white w-full rounded-t-3xl p-5 max-h-[85%] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-y-auto"
        role="dialog"
        aria-label="新增臨時食材"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-lg text-gray-800">新增臨時食材</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              資料庫沒收的食材,輸入每 100g 的營養值即可使用。
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="取消"
            className="p-2 text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="ad-hoc-name"
              className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1 block"
            >
              名稱
            </label>
            <input
              id="ad-hoc-name"
              type="text"
              value={name}
              autoFocus
              placeholder="例:豬腰子、白蝦"
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1 block">
              配餐角色
            </span>
            <div className="grid grid-cols-2 gap-2">
              <RoleButton
                active={role === 'protein'}
                onClick={() => switchRole('protein')}
                Icon={Drumstick}
                label="蛋白質"
                tone="orange"
              />
              <RoleButton
                active={role === 'plant'}
                onClick={() => switchRole('plant')}
                Icon={Leaf}
                label="蔬果 / 主食"
                tone="emerald"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="熱量 (kcal/100g)"
              value={vals.calories}
              onChange={setNum('calories')}
            />
            <NumField
              label="蛋白質 (g)"
              value={vals.protein}
              onChange={setNum('protein')}
            />
            <NumField
              label="脂肪 (g)"
              value={vals.fat}
              onChange={setNum('fat')}
            />
            <NumField
              label="鈣 Ca (mg)"
              value={vals.ca}
              onChange={setNum('ca')}
            />
            <NumField label="磷 P (mg)" value={vals.p} onChange={setNum('p')} />
          </div>

          <p className="text-[11px] text-gray-400 leading-snug">
            預設值是該角色的常見估計;不確定時可保留預設,先看大致鈣磷比再回頭調整。
          </p>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className={`mt-5 w-full py-3 rounded-2xl font-bold text-white shadow-lg active:scale-95 transition ${
            valid
              ? 'bg-gradient-to-r from-orange-500 to-red-500'
              : 'bg-gray-300 cursor-not-allowed shadow-none'
          }`}
        >
          加入清單
        </button>
      </div>
    </div>
  );
}

function RoleButton({ active, onClick, Icon, label, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95 ${
        active
          ? tone === 'orange'
            ? 'border-orange-500 bg-orange-50 text-orange-700'
            : 'border-emerald-500 bg-emerald-50 text-emerald-700'
          : 'border-gray-200 bg-white text-gray-500'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function NumField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.1"
        value={value}
        onChange={onChange}
        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-mono"
      />
    </label>
  );
}

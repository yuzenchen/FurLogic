import React from 'react';
import { Save, Cat, Footprints, Zap, Scale, User } from 'lucide-react';
import { usePet } from '../context/PetContext';

const ACTIVITY_OPTIONS = [
  { value: 'low', label: '慵懶', sub: '少動 / 老犬', icon: Cat },
  { value: 'normal', label: '一般', sub: '日常散步', icon: Footprints },
  { value: 'high', label: '好動', sub: '運動 / 工作犬', icon: Zap },
];

/**
 * 毛孩檔案設定頁面
 */
export default function SettingsPage({ onSave }) {
  const { profile, setProfile } = usePet();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let next;
    if (type === 'checkbox') next = checked;
    else if (type === 'number') {
      const parsed = parseFloat(value);
      next = Number.isFinite(parsed) && parsed > 0 ? parsed : profile[name];
    } else next = value;
    setProfile({ ...profile, [name]: next });
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="pet-name"
            className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"
          >
            <User size={14} className="text-gray-400" /> 毛孩名字
          </label>
          <input
            id="pet-name"
            type="text"
            name="name"
            value={profile.name}
            onChange={handleChange}
            className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="pet-weight"
            className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"
          >
            <Scale size={14} className="text-gray-400" /> 體重 (kg)
          </label>
          <input
            id="pet-weight"
            type="number"
            name="weight"
            min="0.1"
            step="0.1"
            value={profile.weight}
            onChange={handleChange}
            className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-mono"
          />
        </div>

        <label className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl cursor-pointer">
          <span className="text-sm font-medium text-gray-700">已結紮</span>
          <input
            type="checkbox"
            name="isNeutered"
            checked={profile.isNeutered}
            onChange={handleChange}
            className="w-5 h-5 accent-orange-500"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">
            活動量
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {ACTIVITY_OPTIONS.map(({ value, label, sub, icon: Icon }) => {
              const active = profile.activityLevel === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setProfile({ ...profile, activityLevel: value })
                  }
                  aria-pressed={active}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all active:scale-95 ${
                    active
                      ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-500 text-orange-700 shadow-md shadow-orange-200/50'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.5 : 2}
                    className={active ? 'text-orange-500' : 'text-gray-400'}
                  />
                  <span className="text-sm font-bold">{label}</span>
                  <span className="text-[10px] text-gray-400 leading-tight">
                    {sub}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <button
        type="button"
        onClick={onSave}
        className="w-full py-3 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl font-bold flex justify-center items-center gap-2 mt-8 active:scale-95 transition shadow-lg"
      >
        <Save size={18} /> 儲存設定
      </button>
    </div>
  );
}

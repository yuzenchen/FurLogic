import React from 'react';
import { Save } from 'lucide-react';
import { usePet } from '../context/PetContext';

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
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            毛孩名字
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
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            體重 (kg)
          </label>
          <input
            id="pet-weight"
            type="number"
            name="weight"
            min="0.1"
            step="0.1"
            value={profile.weight}
            onChange={handleChange}
            className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
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

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">活動量</p>
          <div className="grid grid-cols-3 gap-2">
            {['low', 'normal', 'high'].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() =>
                  setProfile({ ...profile, activityLevel: level })
                }
                className={`py-2 rounded-lg text-sm font-medium border ${
                  profile.activityLevel === level
                    ? 'bg-orange-100 border-orange-500 text-orange-700'
                    : 'bg-white border-gray-200 text-gray-500'
                }`}
              >
                {level === 'low' ? '慵懶' : level === 'normal' ? '一般' : '好動'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold flex justify-center items-center gap-2 mt-8"
      >
        <Save size={18} /> 儲存設定
      </button>
    </div>
  );
}

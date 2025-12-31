import React from 'react';
import { Save } from 'lucide-react';

/**
 * 毛孩檔案設定頁面
 */
export default function SettingsPage({ petProfile, onUpdate, onSave }) {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    onUpdate({
      ...petProfile,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value)
    });
  };

  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-right duration-300">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            毛孩名字
          </label>
          <input
            type="text"
            name="name"
            value={petProfile.name}
            onChange={handleChange}
            className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            體重 (kg)
          </label>
          <input
            type="number"
            name="weight"
            value={petProfile.weight}
            onChange={handleChange}
            className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
          <span className="text-sm font-medium text-gray-700">已結紮</span>
          <input
            type="checkbox"
            name="isNeutered"
            checked={petProfile.isNeutered}
            onChange={handleChange}
            className="w-5 h-5 accent-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            活動量
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['low', 'normal', 'high'].map(level => (
              <button
                key={level}
                onClick={() => onUpdate({ ...petProfile, activityLevel: level })}
                className={`py-2 rounded-lg text-sm font-medium border ${
                  petProfile.activityLevel === level
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
        onClick={onSave}
        className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold flex justify-center items-center gap-2 mt-8"
      >
        <Save size={18} /> 儲存設定
      </button>
    </div>
  );
}
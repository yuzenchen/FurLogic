import React from 'react';

/**
 * 底部導航標籤按鈕元件
 */
export default function TabButton({ id, label, icon: Icon, activeTab, onClick }) {
  const isActive = activeTab === id;

  return (
    <button
      onClick={() => onClick(id)}
      className={`flex flex-col items-center p-2 rounded-xl transition duration-200 ${
        isActive
          ? 'text-orange-600 bg-orange-50'
          : 'text-gray-400 hover:bg-gray-50'
      }`}
    >
      <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
  );
}
import React, { useState, useMemo, useEffect } from 'react';
import { Activity, Search, ChefHat, Settings, ArrowLeft } from 'lucide-react';
import TabButton from './components/TabButton';
import SettingsPage from './components/SettingsPage';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import KitchenPage from './components/KitchenPage';
import {
  calculateRER,
  calculateDER,
  calculateActivityFactor,
  calculateWaterNeed
} from './utils/nutritionCalculator';
import {
  getPetProfile,
  savePetProfile,
  getActiveTab,
  saveActiveTab
} from './utils/storage';

export default function FurLogicApp() {
  // 從 localStorage 讀取初始狀態
  const [activeTab, setActiveTab] = useState(() => getActiveTab());
  const [showSettings, setShowSettings] = useState(false);
  const [petProfile, setPetProfile] = useState(() => getPetProfile());

  // 當 activeTab 變更時儲存到 localStorage
  useEffect(() => {
    saveActiveTab(activeTab);
  }, [activeTab]);

  // 當 petProfile 變更時儲存到 localStorage
  useEffect(() => {
    savePetProfile(petProfile);
  }, [petProfile]);

  // 即時計算營養需求
  const rer = useMemo(() => calculateRER(petProfile.weight), [petProfile.weight]);
  const factor = useMemo(
    () => calculateActivityFactor(petProfile.isNeutered, petProfile.activityLevel),
    [petProfile.isNeutered, petProfile.activityLevel]
  );
  const der = calculateDER(rer, factor);
  const waterNeed = calculateWaterNeed(petProfile.weight);

  const handleSaveSettings = () => {
    setShowSettings(false);
    // petProfile 會自動由 useEffect 儲存
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 h-[100dvh] flex flex-col font-sans text-gray-800 shadow-2xl relative overflow-hidden">
      {/* 頂部導航 */}
      <div className="bg-white px-5 py-4 shadow-sm z-20 flex justify-between items-center sticky top-0">
        {showSettings ? (
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <h1 className="font-bold text-lg text-gray-800">毛孩檔案設定</h1>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-white font-bold shadow-orange-200 shadow-lg">
                FL
              </div>
              <h1 className="font-bold text-xl tracking-tight text-gray-800">
                FurLogic
              </h1>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 bg-gray-100 pl-3 pr-2 py-1.5 rounded-full hover:bg-gray-200 transition"
            >
              <span className="text-sm font-bold text-gray-700">
                {petProfile.name}
              </span>
              <Settings size={16} className="text-gray-500" />
            </button>
          </>
        )}
      </div>

      {/* 主要內容區 */}
      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
        {showSettings ? (
          <SettingsPage
            petProfile={petProfile}
            onUpdate={setPetProfile}
            onSave={handleSaveSettings}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomePage
                petProfile={petProfile}
                rer={rer}
                der={der}
                waterNeed={waterNeed}
                onNavigate={setActiveTab}
              />
            )}
            {activeTab === 'search' && <SearchPage />}
            {activeTab === 'kitchen' && (
              <KitchenPage petProfile={petProfile} der={der} />
            )}
          </>
        )}
      </div>

      {/* 底部導航欄 */}
      {!showSettings && (
        <div className="bg-white border-t border-gray-200 px-6 py-2 flex justify-between items-center absolute bottom-0 w-full z-30 pb-safe">
          <TabButton
            id="home"
            label="健康"
            icon={Activity}
            activeTab={activeTab}
            onClick={setActiveTab}
          />
          <TabButton
            id="search"
            label="查詢"
            icon={Search}
            activeTab={activeTab}
            onClick={setActiveTab}
          />
          <TabButton
            id="kitchen"
            label="配餐"
            icon={ChefHat}
            activeTab={activeTab}
            onClick={setActiveTab}
          />
        </div>
      )}
    </div>
  );
}
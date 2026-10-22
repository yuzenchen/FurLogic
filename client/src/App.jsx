import React from 'react';
import TopBar from './components/shell/TopBar';
import BottomNav from './components/shell/BottomNav';
import LegacyImportBanner from './components/LegacyImportBanner';
import { ErrorState, Spinner } from './components/ui';
import { NavProvider, useNav } from './context/NavContext';
import { PetProvider, usePet } from './context/PetContext';
import BatchPage from './pages/BatchPage';
import FoodsPage from './pages/FoodsPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';

const PAGES = {
  batch: BatchPage,
  foods: FoodsPage,
  review: ReviewPage,
};

export default function FurLogicApp() {
  return (
    <NavProvider>
      <PetProvider>
        <Shell />
      </PetProvider>
    </NavProvider>
  );
}

function Shell() {
  const { tab, settingsOpen } = useNav();

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-cream text-stone-800">
      <TopBar />
      <main
        key={settingsOpen ? 'settings' : tab}
        className={
          settingsOpen
            ? 'flex-1 overflow-y-auto px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]'
            : 'flex-1 overflow-y-auto px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]'
        }
      >
        <Content />
      </main>
      {!settingsOpen && <BottomNav />}
    </div>
  );
}

function Content() {
  const { tab, settingsOpen } = useNav();
  const { pet, loading, error, refetch } = usePet();

  // 只在還沒有資料時顯示整頁載入/錯誤(重新取得時保留畫面)
  if (!pet && loading) {
    return (
      <div
        role="status"
        className="flex h-full flex-col items-center justify-center gap-3 text-stone-600"
      >
        <Spinner size={28} className="text-orange-500" />
        <span className="text-sm">載入中…</span>
      </div>
    );
  }
  if (!pet) {
    return (
      <ErrorState
        message={`請確認 API 是否啟動${error?.message ? `(${error.message})` : ''}`}
        onRetry={refetch}
      />
    );
  }

  if (settingsOpen) return <SettingsPage />;

  const Page = PAGES[tab] ?? BatchPage;
  return (
    <>
      {tab === 'batch' && <LegacyImportBanner />}
      <Page />
    </>
  );
}

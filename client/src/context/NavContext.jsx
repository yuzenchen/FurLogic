import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { TABS, getActiveTab, saveActiveTab } from '../utils/storage';

const NavContext = createContext(null);

export function NavProvider({ children }) {
  const [tab, setTabState] = useState(getActiveTab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 從計算頁按「AI 復盤」進來時為 true:ReviewPage 讀到後自動開始一次並清掉。
  // 用記憶體旗標而非 sessionStorage:重新整理不該再自動觸發(避免重複扣 AI 額度)。
  const [pendingReview, setPendingReview] = useState(false);

  /** 切換分頁(batch|foods|review),同時關閉設定頁 */
  const setTab = useCallback((next) => {
    if (!TABS.includes(next)) return;
    setTabState(next);
    saveActiveTab(next);
    setSettingsOpen(false);
  }, []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  /** 切到 AI 復盤分頁並要求自動開始一次 */
  const startReview = useCallback(() => {
    setPendingReview(true);
    setTab('review');
  }, [setTab]);
  const clearPendingReview = useCallback(() => setPendingReview(false), []);

  const value = useMemo(
    () => ({
      tab,
      setTab,
      openSettings,
      closeSettings,
      settingsOpen,
      pendingReview,
      startReview,
      clearPendingReview,
    }),
    [
      tab,
      setTab,
      openSettings,
      closeSettings,
      settingsOpen,
      pendingReview,
      startReview,
      clearPendingReview,
    ],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside <NavProvider>');
  return ctx;
}

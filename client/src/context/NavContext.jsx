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

  /** 切換分頁(today|history|log|foods),同時關閉設定頁 */
  const setTab = useCallback((next) => {
    if (!TABS.includes(next)) return;
    setTabState(next);
    saveActiveTab(next);
    setSettingsOpen(false);
  }, []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const value = useMemo(
    () => ({ tab, setTab, openSettings, closeSettings, settingsOpen }),
    [tab, setTab, openSettings, closeSettings, settingsOpen],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside <NavProvider>');
  return ctx;
}

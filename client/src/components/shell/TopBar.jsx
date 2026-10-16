import React from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import Logo from '../Logo';
import { FOCUS_RING, cx } from '../ui';
import { useNav } from '../../context/NavContext';
import { usePet } from '../../context/PetContext';

/** 頂部列:一般模式顯示 Logo + 毛孩膠囊;設定頁顯示返回 + 「毛孩檔案」 */
export default function TopBar() {
  const { settingsOpen, openSettings, closeSettings } = useNav();
  const { pet } = usePet();

  return (
    <header className="h-14 shrink-0 bg-white border-b border-stone-200 px-4 flex items-center justify-between gap-3 z-20">
      {settingsOpen ? (
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={closeSettings}
            aria-label="返回"
            className={cx(
              'w-11 h-11 -ml-2 inline-flex items-center justify-center rounded-full text-stone-700 hover:bg-stone-100',
              FOCUS_RING,
            )}
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <h1 className="text-lg font-bold text-stone-900 truncate">
            毛孩檔案
          </h1>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true" className="inline-flex">
              <Logo size={32} />
            </span>
            <span className="text-lg font-bold text-stone-900">FurLogic</span>
          </div>
          {pet && (
            <button
              type="button"
              onClick={openSettings}
              aria-label={`${pet.name} 的毛孩檔案設定`}
              className={cx(
                'min-h-11 max-w-[50%] inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white pl-3 pr-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50',
                FOCUS_RING,
              )}
            >
              <span className="truncate">{pet.name}</span>
              <Settings
                size={16}
                className="shrink-0 text-stone-600"
                aria-hidden="true"
              />
            </button>
          )}
        </>
      )}
    </header>
  );
}

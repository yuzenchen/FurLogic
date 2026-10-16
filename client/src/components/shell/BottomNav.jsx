import React from 'react';
import { Apple, BarChart3, Home, PawPrint, Plus } from 'lucide-react';
import { FOCUS_RING, cx } from '../ui';
import { useNav } from '../../context/NavContext';

/** 一般分頁按鈕:圖示 22px + 11px 文字 */
function NavItem({ icon: Icon, label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'page' : undefined}
      className={cx(
        'min-h-11 h-full w-full flex flex-col items-center justify-center gap-0.5 rounded-xl',
        selected ? 'text-orange-700' : 'text-stone-600 hover:text-stone-800',
        FOCUS_RING,
      )}
    >
      <Icon size={22} strokeWidth={selected ? 2.5 : 2} aria-hidden="true" />
      <span className="text-[11px] font-medium leading-tight">{label}</span>
    </button>
  );
}

/** 底部導覽:今日 / 紀錄 / 記餐(突起主按鈕)/ 食材 / 毛孩 */
export default function BottomNav() {
  const { tab, setTab, openSettings } = useNav();
  const logSelected = tab === 'log';

  return (
    <nav
      aria-label="主要導覽"
      className="absolute inset-x-0 bottom-0 z-30 bg-white border-t border-stone-200 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="h-16 grid grid-cols-5 items-stretch px-1 py-1">
        <NavItem
          icon={Home}
          label="今日"
          selected={tab === 'today'}
          onClick={() => setTab('today')}
        />
        <NavItem
          icon={BarChart3}
          label="紀錄"
          selected={tab === 'history'}
          onClick={() => setTab('history')}
        />
        <button
          type="button"
          onClick={() => setTab('log')}
          aria-current={logSelected ? 'page' : undefined}
          className={cx(
            'group min-h-11 w-full flex flex-col items-center justify-start rounded-xl',
            FOCUS_RING,
          )}
        >
          <span className="-mt-6 w-14 h-14 rounded-full bg-orange-700 group-hover:bg-orange-800 text-white ring-4 ring-cream shadow-sm flex items-center justify-center transition-colors">
            <Plus size={28} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span
            className={cx(
              'mt-0.5 text-[11px] font-medium leading-tight',
              logSelected ? 'text-orange-700' : 'text-stone-600',
            )}
          >
            記餐
          </span>
        </button>
        <NavItem
          icon={Apple}
          label="食材"
          selected={tab === 'foods'}
          onClick={() => setTab('foods')}
        />
        <NavItem
          icon={PawPrint}
          label="毛孩"
          selected={false}
          onClick={openSettings}
        />
      </div>
    </nav>
  );
}

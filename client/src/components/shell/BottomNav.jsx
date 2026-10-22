import React from 'react';
import { Apple, ChefHat, Sparkles } from 'lucide-react';
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

/** 底部導覽:食材 / 計算(突起主按鈕)/ AI 復盤(毛孩設定只從頂部膠囊進入) */
export default function BottomNav() {
  const { tab, setTab } = useNav();
  const batchSelected = tab === 'batch';

  return (
    <nav
      aria-label="主要導覽"
      className="absolute inset-x-0 bottom-0 z-30 bg-white border-t border-stone-200 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="h-16 grid grid-cols-3 items-stretch px-1 py-1">
        <NavItem
          icon={Apple}
          label="食材"
          selected={tab === 'foods'}
          onClick={() => setTab('foods')}
        />
        <button
          type="button"
          onClick={() => setTab('batch')}
          aria-current={batchSelected ? 'page' : undefined}
          className={cx(
            'group min-h-11 w-full flex flex-col items-center justify-start rounded-xl',
            FOCUS_RING,
          )}
        >
          <span className="-mt-6 w-14 h-14 rounded-full bg-orange-700 group-hover:bg-orange-800 text-white ring-4 ring-cream shadow-sm flex items-center justify-center transition-colors">
            <ChefHat size={28} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span
            className={cx(
              'mt-0.5 text-[11px] font-medium leading-tight',
              batchSelected ? 'text-orange-700' : 'text-stone-600',
            )}
          >
            計算
          </span>
        </button>
        <NavItem
          icon={Sparkles}
          label="AI 復盤"
          selected={tab === 'review'}
          onClick={() => setTab('review')}
        />
      </div>
    </nav>
  );
}

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { FOCUS_RING, cx } from './focus';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 底部抽屜。渲染在 App 的 max-w-md 外殼內(外殼需 relative),覆蓋整個 app 欄。
 * Esc / 點遮罩關閉;開啟時 focus 第一個可聚焦元素,關閉時還原焦點;Tab 會在面板內循環。
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-stone-900/40 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-h-[85dvh] flex flex-col rounded-t-3xl bg-white shadow-sm animate-in slide-in-from-bottom focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 id={titleId} className="text-lg font-bold text-stone-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className={cx(
              'w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-full text-stone-600 hover:bg-stone-100',
              FOCUS_RING,
            )}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="border-t border-stone-200 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import Spinner from './Spinner';
import { FOCUS_RING, cx } from './focus';

const VARIANTS = {
  primary: 'bg-orange-700 text-white hover:bg-orange-800',
  secondary:
    'bg-white border border-stone-300 text-stone-800 hover:bg-stone-50',
  ghost: 'text-stone-700 hover:bg-stone-100',
  danger: 'text-rose-700 border border-rose-200 hover:bg-rose-50',
};

const SIZES = {
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

/**
 * 按鈕。icon 傳 lucide 元件(例:icon={Plus});loading 時顯示 spinner、aria-busy 並停用。
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon: Icon,
  type = 'button',
  disabled,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        block && 'w-full',
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size={18} />
      ) : (
        Icon && <Icon size={18} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

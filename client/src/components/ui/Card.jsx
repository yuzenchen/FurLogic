import React from 'react';
import { cx } from './focus';

/** 白底卡片 */
export default function Card({
  as: Component = 'div',
  className = '',
  padding = 'p-4',
  children,
  ...rest
}) {
  return (
    <Component
      className={cx(
        'bg-white rounded-2xl border border-stone-200 shadow-sm',
        padding,
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

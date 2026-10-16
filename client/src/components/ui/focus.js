/** 共用焦點樣式(DESIGN.md:focus-visible ring-2 orange-500 + offset cream) */
export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream';

export const cx = (...classes) => classes.filter(Boolean).join(' ');

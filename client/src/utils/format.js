/**
 * 顯示用格式化(純函式,不受執行環境時區影響)
 */
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const parseDateKey = (dateKey) => {
  const m = DATE_KEY_RE.exec(dateKey ?? '');
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
};

/** 'YYYY-MM-DD' → 星期中文單字「一」…「日」;無效輸入回傳 '' */
export const weekdayShort = (dateKey) => {
  const p = parseDateKey(dateKey);
  if (!p) return '';
  return WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
};

/** 'YYYY-MM-DD' → 「10月16日 週五」;無效輸入回傳原字串 */
export const formatDateKey = (dateKey) => {
  const p = parseDateKey(dateKey);
  if (!p) return dateKey ?? '';
  return `${p.m}月${p.d}日 週${weekdayShort(dateKey)}`;
};

const EATEN_AT_RE = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/;

/** ISO 字串 → 'HH:mm'(取字串所寫的牆上時鐘,不做時區換算) */
export const timeOfEatenAt = (eatenAt) => {
  const m = EATEN_AT_RE.exec(eatenAt ?? '');
  return m ? `${m[1]}:${m[2]}` : '';
};

/** 熱量取整數並加千分位 */
export const formatKcal = (n) => {
  const value = Number.isFinite(n) ? Math.round(n) : 0;
  return value.toLocaleString('en-US');
};

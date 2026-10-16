import React from 'react';

/**
 * 食材來源膠囊。builtin 不顯示。
 * usda → 「USDA · {sourceRef}」(emerald);ai → 「AI 估計,僅供參考」(amber,
 * lowConfidence 時加「信心度低」);manual → 「手動輸入」(stone)。
 * compact 時文字縮短(食材卡片用)。
 */
export default function SourceBadge({
  source,
  sourceRef,
  lowConfidence = false,
  compact = false,
}) {
  if (source === 'usda') {
    const text = compact || !sourceRef ? 'USDA' : `USDA · ${sourceRef}`;
    return <Pill className="text-emerald-700 bg-emerald-50">{text}</Pill>;
  }
  if (source === 'ai') {
    let text = compact ? 'AI 估計' : 'AI 估計,僅供參考';
    if (lowConfidence && !compact) text += ' · 信心度低';
    return <Pill className="text-amber-700 bg-amber-50">{text}</Pill>;
  }
  if (source === 'manual' || source === undefined || source === null) {
    return (
      <Pill className="text-stone-700 bg-stone-100">
        {compact ? '手動' : '手動輸入'}
      </Pill>
    );
  }
  return null;
}

function Pill({ className, children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

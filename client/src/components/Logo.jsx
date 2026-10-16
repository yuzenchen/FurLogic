import React from 'react';

/**
 * FurLogic 品牌標誌 — 橘色柑橘底 + 綠色帶葉勾勾。
 *
 * 動效設計:
 * - 掛載時:fade + zoom-in(由 Tailwind animate-in 提供)
 * - 持續:葉尖每 6s 微微擺動一次(furlogic-leaf-sway @ index.css)
 * - 滑鼠 hover:整體輕微 scale + 葉子旋轉角度加大
 *
 * 沿用 SVG 而非 <img>,以便個別動畫元素 (leaf group) 與保證任何尺寸都銳利。
 */
export default function Logo({ size = 36, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="FurLogic"
      className={`furlogic-logo ${className}`}
    >
      <defs>
        <clipPath id="fl-logo-clip">
          <circle cx="50" cy="50" r="44" />
        </clipPath>
        <linearGradient id="fl-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F58A3E" />
          <stop offset="100%" stopColor="#E26F1C" />
        </linearGradient>
      </defs>

      {/* 橘色柑橘底 */}
      <circle cx="50" cy="50" r="44" fill="url(#fl-logo-bg)" />

      {/* 切片線 + 內環 */}
      <g
        clipPath="url(#fl-logo-clip)"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.35"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <line x1="50" y1="6" x2="50" y2="94" />
        <line x1="6" y1="50" x2="94" y2="50" />
        <line x1="18.6" y1="18.6" x2="81.4" y2="81.4" />
        <line x1="81.4" y1="18.6" x2="18.6" y2="81.4" />
        <circle cx="50" cy="50" r="30" />
      </g>

      {/* 勾勾白色外緣 — 製造與切片線之間的留白 */}
      <path
        d="M28 52 L43 67 L76 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 短邊:橘色 */}
      <path
        d="M28 52 L43 67"
        fill="none"
        stroke="#F4A05C"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 長邊 + 葉尖:綠色,整個 group 受 CSS 控制擺動 */}
      <g className="furlogic-logo__leaf">
        <path
          d="M43 67 L76 24"
          fill="none"
          stroke="#65A30D"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M76 24 q4 -13 18 -8 q-10 13 -18 8 z"
          fill="#65A30D"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line
          x1="80"
          y1="20"
          x2="90"
          y2="14"
          stroke="#F4A05C"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

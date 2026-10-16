import React from 'react';
import { DAILY_STATUS_LABELS, dailyStatus } from '@furlogic/shared';
import { formatDateKey, formatKcal, weekdayShort } from '../../utils/format';
import { summarizeWeek } from './weekSummary';

// 狀態色(對白底皆 ≥ 3:1 非文字對比)
const STATUS_FILL = {
  under: '#d97706', // amber-600
  met: '#059669', // emerald-600
  over: '#e11d48', // rose-600
};
const STUB_FILL = '#d6d3d1'; // stone-300
const TARGET_STROKE = '#78716c'; // stone-500
const TEXT_MUTED = '#44403c'; // stone-700
const TEXT_STRONG = '#1c1917'; // stone-900

const VIEW_W = 320;
const VIEW_H = 180;
const PLOT_LEFT = 4;
const PLOT_RIGHT = 266; // 右側保留給「目標」標籤
const PLOT_TOP = 18;
const BASELINE = 150;
const X_LABEL_Y = 168;
const BAR_W = 22;
const RADIUS = 4;

/** 只有上方兩角圓角的長條 */
const topRoundedBar = (x, y, w, h) => {
  const r = Math.min(RADIUS, h, w / 2);
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
};

const LEGEND = ['under', 'met', 'over'];

/**
 * 近 7 天熱量長條圖(inline SVG)。
 * series: [{ dateKey, calories, count }] 由舊到新;der: 每日目標;today: 今天的 dateKey。
 */
export default function WeeklyBarChart({ series = [], der = 0, today }) {
  const days = series ?? [];
  const maxValue = days.reduce((m, d) => Math.max(m, d.calories ?? 0), 0);
  const yMax = Math.max(der * 1.25, maxValue * 1.1) || 1;
  const plotH = BASELINE - PLOT_TOP;
  const yOf = (v) => BASELINE - (v / yMax) * plotH;
  const slot = (PLOT_RIGHT - PLOT_LEFT) / Math.max(days.length, 1);
  const targetY = yOf(der);

  const { average, metDays, daysWithRecords } = summarizeWeek(days, der);
  const ariaLabel =
    `近 ${days.length} 天熱量長條圖:每日目標 ${formatKcal(der)} kcal,` +
    `${daysWithRecords} 天有紀錄,平均 ${formatKcal(average)} kcal,達標 ${metDays} 天`;

  const rows = days.map((d) => {
    const calories = d.calories ?? 0;
    const status = dailyStatus(calories, der).status;
    return { ...d, calories, status };
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto"
        role="img"
        aria-label={ariaLabel}
      >
        {rows.map((d, i) => {
          const cx = PLOT_LEFT + slot * i + slot / 2;
          const x = cx - BAR_W / 2;
          const isToday = d.dateKey === today;
          const hasValue = d.calories > 0;
          const barTop = Math.min(yOf(d.calories), BASELINE - 2);
          return (
            <g key={d.dateKey}>
              {hasValue ? (
                <>
                  <path
                    d={topRoundedBar(x, barTop, BAR_W, BASELINE - barTop)}
                    fill={STATUS_FILL[d.status]}
                  />
                  <text
                    x={cx}
                    y={barTop - 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill={TEXT_MUTED}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatKcal(d.calories)}
                  </text>
                </>
              ) : (
                <rect
                  x={x}
                  y={BASELINE - 2}
                  width={BAR_W}
                  height={2}
                  fill={STUB_FILL}
                />
              )}
              <text
                x={cx}
                y={X_LABEL_Y}
                textAnchor="middle"
                fontSize="11"
                fontWeight={isToday ? 700 : 400}
                fill={isToday ? TEXT_STRONG : TEXT_MUTED}
              >
                {isToday ? '今天' : weekdayShort(d.dateKey)}
              </text>
            </g>
          );
        })}

        {der > 0 && (
          <g>
            <line
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={targetY}
              y2={targetY}
              stroke={TARGET_STROKE}
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text
              x={VIEW_W - 2}
              y={targetY + 3.5}
              textAnchor="end"
              fontSize="10"
              fill={TEXT_MUTED}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              目標 {formatKcal(der)}
            </text>
          </g>
        )}
      </svg>

      <table className="sr-only">
        <caption>近 {days.length} 天每日熱量</caption>
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col">熱量</th>
            <th scope="col">狀態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.dateKey}>
              <th scope="row">
                {formatDateKey(d.dateKey)}
                {d.dateKey === today ? '(今天)' : ''}
              </th>
              <td>{formatKcal(d.calories)} kcal</td>
              <td>{d.count > 0 ? DAILY_STATUS_LABELS[d.status] : '無紀錄'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul
        className="flex items-center justify-center gap-4 mt-2 text-xs text-stone-600"
        aria-hidden="true"
      >
        {LEGEND.map((status) => (
          <li key={status} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: STATUS_FILL[status] }}
            />
            {DAILY_STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
    </div>
  );
}

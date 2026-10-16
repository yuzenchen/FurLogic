# FurLogic 前端設計規格

手機優先,`max-w-md mx-auto`。所有使用者看得到的文字為繁體中文。

## Tokens
- 頁面底色 `cream` = `#FAF7F2`(tailwind `theme.extend.colors.cream`);卡片 `bg-white`。
- 灰階一律用 `stone`:主要文字 `stone-900`/`stone-800`,次要文字 `stone-600`,邊框 `stone-200`,分隔/軌道 `stone-100`/`stone-200`。
  `stone-500` 只用在 ≥18px 或純裝飾,一般內文不要用(在 cream 上對比不足)。
- 品牌橘:圖形/強調 `orange-500`,淺底 `orange-50`/`orange-100`,**白字按鈕底色用 `orange-700`(hover `orange-800`)** 以符合 AA。
- 狀態色(一定同時有文字標籤與圖示,不只靠顏色):
  - 不足 under:`amber-700` 文字、`amber-50` 底、圖示 `ArrowDown`
  - 達標 met:`emerald-700` 文字、`emerald-50` 底、圖示 `Check`
  - 超過 over:`rose-700` 文字、`rose-50` 底、圖示 `ArrowUp`
- 圓角:卡片 `rounded-2xl`,按鈕/輸入 `rounded-xl`,膠囊 `rounded-full`。
- 陰影:只用 `shadow-sm`;移除大部分漸層與重陰影。**唯一視覺重點是今日頁環狀圖**。
- 數字一律 `tabular-nums`。
- 觸控目標 ≥ 44px(`h-11`/`min-h-11`、`w-11`)。
- 焦點:可互動元素 `focus-visible:ring-2 ring-orange-500 ring-offset-2 ring-offset-cream`。
- 尊重 `prefers-reduced-motion`。
- 圖表一律 inline SVG,不加圖表套件。

## 共用元件 `client/src/components/ui/`
| 元件 | Props | 規格 |
|---|---|---|
| `Card` | `as`, `className`, `padding`(預設 `p-4`) | `bg-white rounded-2xl border border-stone-200 shadow-sm` |
| `Button` | `variant` primary/secondary/ghost/danger, `size` md(h-11)/lg(h-12), `block`, `loading`, `icon`, 其他原生屬性 | primary `bg-orange-700 text-white`;secondary `bg-white border border-stone-300 text-stone-800`;ghost `text-stone-700 hover:bg-stone-100`;danger `text-rose-700 border border-rose-200`;disabled `opacity-50 cursor-not-allowed`;loading 顯示 spinner 並 `aria-busy` |
| `ProgressRing` | `value`, `max`, `size`(200), `stroke`(16), `tone` orange/emerald/rose, `children`(置中內容), `label`(aria) | SVG 兩個 circle;軌道 `stone-200`;進度 stroke-linecap round,從 12 點鐘順時針;超過 max 時環畫滿並改 tone;`role="img"` + aria-label |
| `PageHeader` | `title`, `subtitle`, `action` | `h1 text-2xl font-bold stone-900`,subtitle `text-sm stone-600` |
| `BottomSheet` | `open`, `onClose`, `title`, `children`, `footer` | 固定在 `max-w-md` 容器內,遮罩 `bg-stone-900/40`,面板 `rounded-t-3xl bg-white max-h-[85dvh]` 可捲動;Esc 與點遮罩關閉;開啟時 focus 第一個可聚焦元素,關閉時還原焦點;`role="dialog" aria-modal` |
| `EmptyState` | `icon`, `title`, `description`, `action` | 置中,icon 40px `stone-400`,標題 `stone-800`,說明 `stone-600` |
| `Stat` | `label`, `value`, `unit`, `hint` | label `text-xs stone-600`,value `text-lg font-semibold stone-900 tabular-nums` |
| `StatusBadge` | `status` under/met/over, `children` | 依上方狀態色,圖示 + 文字 |
| `ErrorState` | `message`, `onRetry` | 「連不上伺服器」+ 訊息 + 重試按鈕 |

## App 外殼
- 頂部列(白底、底線 `stone-200`,高 56px):左 `Logo`(32px,沿用現有元件與動畫)+「FurLogic」;右側毛孩膠囊按鈕(名字 + Settings 圖示)→ 設定頁(全頁,左上返回)。
- 底部導覽固定,5 格等寬:`今日(Home)` `紀錄(BarChart3)` **`記餐`** `食材(Apple 或 Carrot)` `毛孩(PawPrint)`。
  - 中央「記餐」為突起主按鈕:直徑 56px 圓形 `bg-orange-700 text-white`,`-mt-6` 浮出,`ring-4 ring-cream`,圖示 `Plus`,下方文字「記餐」。
  - 其餘分頁:圖示 22px + 11px 文字;選中 `text-orange-700` 且有 `aria-current="page"`,未選 `stone-600`。
  - 「毛孩」開啟設定頁(與頂部入口相同)。
- 內容區底部留出導覽高度 + safe-area。
- 目前分頁存 localStorage(`furlogic_active_tab`)。分頁值:`today` | `history` | `log` | `foods`。
- 導覽狀態用 `NavContext`(`useNav()` → `{ tab, setTab, openSettings }`)。

## 頁面
詳見各任務 brief;共通原則:
- 讀取中顯示骨架或「載入中…」,API 失敗顯示 `ErrorState` + 重試。
- 營養數值旁註明「生食基準,建議以生重秤量」(記餐頁一次即可)。

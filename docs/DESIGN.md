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
- 陰影:只用 `shadow-sm`;移除大部分漸層與重陰影。**唯一視覺重點是批次頁的「每份結果」卡**(白卡內 `orange-50` 面板,不用漸層)。
- 數字一律 `tabular-nums`。
- 觸控目標 ≥ 44px(`h-11`/`min-h-11`、`w-11`)。
- 焦點:可互動元素 `focus-visible:ring-2 ring-orange-500 ring-offset-2 ring-offset-cream`。
- 尊重 `prefers-reduced-motion`。
- 圖表一律 inline SVG,不加圖表套件。

## 共用元件 `client/src/components/ui/`

| 元件           | Props                                                                                                        | 規格                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Card`         | `as`, `className`, `padding`(預設 `p-4`)                                                                     | `bg-white rounded-2xl border border-stone-200 shadow-sm`                                                                                                                                                                                                            |
| `Button`       | `variant` primary/secondary/ghost/danger, `size` md(h-11)/lg(h-12), `block`, `loading`, `icon`, 其他原生屬性 | primary `bg-orange-700 text-white`;secondary `bg-white border border-stone-300 text-stone-800`;ghost `text-stone-700 hover:bg-stone-100`;danger `text-rose-700 border border-rose-200`;disabled `opacity-50 cursor-not-allowed`;loading 顯示 spinner 並 `aria-busy` |
| `ProgressRing` | `value`, `max`, `size`(200), `stroke`(16), `tone` orange/emerald/rose, `children`(置中內容), `label`(aria)   | SVG 兩個 circle;軌道 `stone-200`;進度 stroke-linecap round,從 12 點鐘順時針;超過 max 時環畫滿並改 tone;`role="img"` + aria-label                                                                                                                                    |
| `PageHeader`   | `title`, `subtitle`, `action`                                                                                | `h1 text-2xl font-bold stone-900`,subtitle `text-sm stone-600`                                                                                                                                                                                                      |
| `BottomSheet`  | `open`, `onClose`, `title`, `children`, `footer`                                                             | 固定在 `max-w-md` 容器內,遮罩 `bg-stone-900/40`,面板 `rounded-t-3xl bg-white max-h-[85dvh]` 可捲動;Esc 與點遮罩關閉;開啟時 focus 第一個可聚焦元素,關閉時還原焦點;`role="dialog" aria-modal`                                                                         |
| `EmptyState`   | `icon`, `title`, `description`, `action`                                                                     | 置中,icon 40px `stone-400`,標題 `stone-800`,說明 `stone-600`                                                                                                                                                                                                        |
| `Stat`         | `label`, `value`, `unit`, `hint`                                                                             | label `text-xs stone-600`,value `text-lg font-semibold stone-900 tabular-nums`                                                                                                                                                                                      |
| `StatusBadge`  | `status` under/met/over, `children`                                                                          | 依上方狀態色,圖示 + 文字                                                                                                                                                                                                                                            |
| `ErrorState`   | `message`, `onRetry`                                                                                         | 「連不上伺服器」+ 訊息 + 重試按鈕                                                                                                                                                                                                                                   |

## App 外殼

- 頂部列(白底、底線 `stone-200`,高 56px):左 `Logo`(32px,沿用現有元件與動畫)+「FurLogic」;右側毛孩膠囊按鈕(名字 + Settings 圖示)→ 設定頁(全頁,左上返回)。
- 底部導覽固定,3 格等寬:`食材(Apple)` **`批次`** `毛孩(PawPrint)`。
  - 中央「批次」為突起主按鈕:直徑 56px 圓形 `bg-orange-700 text-white`,`-mt-6` 浮出,`ring-4 ring-cream`,圖示 `ChefHat`,下方文字「批次」。
  - 其餘分頁:圖示 22px + 11px 文字;選中 `text-orange-700` 且有 `aria-current="page"`,未選 `stone-600`。
  - 「毛孩」開啟設定頁(與頂部入口相同)。
- 內容區底部留出導覽高度 + safe-area。
- 目前分頁存 localStorage(`furlogic_active_tab`)。分頁值:`batch`(預設)| `foods`。舊值 `today` / `history` / `log` / `home` / `kitchen` 讀取時轉成 `batch`,`search` 轉成 `foods`。
- 導覽狀態用 `NavContext`(`useNav()` → `{ tab, setTab, openSettings }`)。
- 舊版資料匯入提示(`LegacyImportBanner`)顯示在批次分頁頂端。

## 頁面

共通原則:

- 讀取中顯示骨架或「載入中…」,API 失敗顯示 `ErrorState` + 重試。
- 營養數值旁註明生食基準(批次頁一次即可)。
- 已移除單餐記錄、今日頁與歷史頁;伺服器只存毛孩與食材。

### 批次製作 `pages/BatchPage.jsx`(分頁 `batch`)

整鍋鮮食分份計算器,**不存伺服器**。草稿存 localStorage `furlogic_batch_draft`,形狀 `{ servings: number|null, vegWeightPct: number, items: [{ food, grams }] }`(`grams` 為整鍋生重;`servings` 為 null 時採建議份數;`vegWeightPct` 為蔬菜占整鍋重量 %,0–90,預設 20,清空時保留)。計算用 shared `planBatch` / `allocateBatchForServings`;份數純粹依數量平分(不輸入熟重)。

**蔬菜不計熱量**:`type === 'veg'` 的食材在所有計算(整鍋/每份熱量、建議份數、達標判定、三大營養素)中熱量、蛋白質、脂肪皆視為 0,鈣、磷與重量照算;水果與澱粉照常計熱量。

**依份數自動配量**(`allocateBatchForServings`):

- 非蔬菜:照目前輸入克數的比例等比縮放,使熱量 = 份數 × 單餐目標;若全部為 0 g,改用蛋白質 70% / 其餘 30% 熱量(只有一類時 100%)。excluded 或 0 kcal 的非蔬菜給 0 g。
- 蔬菜:總重 = 非蔬菜總重 × pct ÷ (100 − pct);多種蔬菜照輸入克數比例分配,全為 0 g 時平分。
- 沒有可提供熱量的非蔬菜食材時不動作(按鈕停用並提示)。

1. `PageHeader`「批次製作」/「輸入整鍋食材的生重,算出可分幾份」;有食材時右上 ghost「清空」(兩段式確認)。
2. 提示列(Info 圖示):「營養數值為生食基準,請輸入下鍋前的生重」。
3. 「整鍋食材」卡:每項 `BatchItemRow`(角色圖示、名稱、kcal/100g(蔬菜改顯示「蔬菜 · 不計熱量」)、注意警語;−50 / 克數輸入 / +50 / 移除;右側本項 kcal,蔬菜不顯示);卡底「整鍋合計 {g} g · {kcal} kcal」。空狀態 `EmptyState`(Utensils)「還沒加入食材」+「加入食材」。
4. 動作列:有蔬菜時上方顯示「蔬菜占整鍋重量 [N] %」輸入框(0–90);secondary「加入食材」、secondary「依份數自動配量」(Wand2;無有熱量的非蔬菜食材或無單餐目標時停用),下方 `text-xs stone-600`「依 {N} 份 × 單餐 {目標} kcal 計算各食材總重(蔬菜不計熱量,占整鍋重量 {pct}%)」;只有蔬菜時改顯示「請先加入肉類或澱粉等有熱量的食材」。
5. 「份數」卡:步進器(− [N] +,範圍 1–60,按鈕 44px,中間數字輸入);「建議 {n} 份(依單餐目標 {目標} kcal)」,份數與建議不同時顯示 ghost「套用建議」;「約可吃 {天數} 天(每日 {餐數} 餐)」。
6. 每份結果卡(唯一視覺重點):白卡 + `orange-50` 內層面板;「每份 {kcal} kcal」(數字 `text-4xl font-bold tabular-nums`)、「/ 單餐目標 {目標} kcal」、`StatusBadge`(與每日相同 90–110% 規則)+「比目標少 X kcal」/「接近目標」/「比目標多 X kcal」、「每份生重約 {g} g(整鍋 ÷ {N})」;面板下方「每份含」列出各食材每份克數。
7. `MealAnalysisCard`「每份營養」:統計、鈣磷比量表、巨量營養素;建議補充中克數類(蛋殼粉)顯示「整鍋加 X・每份 Y」,按顆計的魚油只顯示「每份 1 顆」。

### 食材 `pages/FoodsPage.jsx`(分頁 `foods`)

搜尋、篩選、自訂食材新增/編輯/刪除。卡片「加入批次」把食材加入批次草稿並切到 `batch` 分頁。`FoodSearchSheet` / `FoodFormSheet` 在 `context="batch"` 時「儲存並加入」會加入批次草稿(有毒食材只存入食材庫)。

### 毛孩檔案 `pages/SettingsPage.jsx`

由頂部膠囊或底部「毛孩」開啟。單餐目標 = DER ÷ 每日餐數,批次頁以此計算建議份數與自動配量。

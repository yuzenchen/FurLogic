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
- 陰影:只用 `shadow-sm`;移除大部分漸層與重陰影。**唯一視覺重點是批次頁的「每餐結果」卡**(白卡內 `orange-50` 面板,不用漸層)。
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

批次鮮食採買計算器,**不存伺服器**。草稿存 localStorage `furlogic_batch_draft`,形狀 `{ mealsCount: number, mealTargetOverride: number|null, items: [{ food, role, gramsPerMeal }] }`(`mealsCount` 製作餐數 1–60,預設 2,清空時保留;`mealTargetOverride` 本次單餐目標 kcal,null 表示用毛孩設定,清空時清掉;`role` 為 `fixed|variant|main`;`gramsPerMeal` 每餐生重)。舊形狀(`servings`/`grams`/`vegWeightPct`)不遷移,讀到直接視為無效。計算用 shared `planGapFill`。加入食材時預設角色:`recipeRole === 'protein'` 且尚無主力 → `main`,已有主力 → `variant`,其他 → `fixed`;預設克數 `defaultGramsPerMeal`;設某項為 `main` 時原本的主力降為 `variant`(最多一個主力)。

**計算規則:缺口填補**(shared `planGapFill`,每餐 = 固定班底 + 替換肉類 + 主力瘦肉):

- 每項食材帶角色 `role`:`fixed` 固定班底、`variant` 替換肉類、`main` 主力瘦肉(最多一個;多個時只有第一個當主力,其餘視為替換並警告 `multiple_main`)。固定與替換輸入「每餐克數」;主力的克數不輸入,由缺口反推。
- 熱量係數為食材資料庫的 kcal/100 g(例:熟白飯 130、熟薏仁泥 117、鯖魚 205、綜合鴨內臟 150、豬小里肌 / 鴨柳條 110)。
- **蔬菜不計熱量**:`type === 'veg'` 在所有計算(固定熱量、缺口、達標判定、三大營養素)中熱量、蛋白質、脂肪皆視為 0,鈣、磷與重量照算;水果與澱粉照常計熱量。
- 固定熱量 = Σ 固定班底;替換熱量 = Σ 替換肉類;缺口 = 單餐目標 − 固定 − 替換(未四捨五入)。主力克數 = 缺口 ÷ (主力 kcal/100 g ÷ 100),**無條件進位到整數 g**(115.45 → 116)。缺口 ≤ 0 時主力 0 g 並警告 `over_target`;沒有主力 `no_main`;主力為蔬菜或 0 kcal `main_no_energy`;無單餐目標 `no_target`(缺口視為 0)。
- 範例:目標 450,固定 白飯 70 g(91)+ 薏仁泥 60 g(70)+ 蔬菜 50 g(0)+ 鴨內臟 12 g(18)= 179;替換 鯖魚 40 g(82)+ 小里肌 50 g(55)= 137;缺口 134 → 鴨柳 134 ÷ 1.1 = 121.8 → 122 g。
- **每餐上限**(`MEAL_CAPS`,超過只警告不強制,含反推後的主力):蔬菜合計 ≤ 50 g(`type === 'veg'`)、內臟 ≤ 12 g(`subtype === 'organ'`)、高脂魚 ≤ 65 g(`subtype === 'fatty_fish'`)。加入食材時預設每餐克數即為上限值(`defaultGramsPerMeal`),其他食材 0 g。
- **採買總量 = 每餐克數 × 餐數**(`mealsCount`,整數 ≥ 1);整批營養與補充品(蛋殼粉)以整批克數計算,約可吃天數 = 餐數 ÷ 每日餐數。

1. `PageHeader`「批次製作」/「固定班底 + 替換肉類,缺口由主力瘦肉補齊」;有食材時右上 ghost「清空」(兩段式確認)。
2. 提示列(Info 圖示):「營養數值為生食基準,請輸入下鍋前的生重」。
3. 「單餐目標」卡:「毛孩設定 {mealTarget} kcal(DER ÷ {mealsPerDay} 餐)」(`text-sm stone-600`);輸入列「本次目標」+ `inputMode="numeric"` 輸入框(h-11、w-24、右對齊,placeholder 為毛孩值)+「kcal」;有覆寫且 ≠ 毛孩值時右側 ghost「還原」。有效目標 = `mealTargetOverride ?? metrics.mealTargetRaw`。沒有毛孩目標也沒覆寫時顯示 `amber-700`「請先在「毛孩」設定體重,或輸入本次目標」。
4. 「每餐食材」卡:每項 `BatchItemRow`:
   - 第一行:角色圖示(main → `Drumstick` orange-500;variant → `Beef`,高脂魚 `Fish`,stone-700;fixed → `Leaf` emerald-600;蔬菜一律 Leaf)、名稱(粗體)、小字 `{kcal/100g} kcal/100g`(蔬菜「蔬菜 · 不計熱量」)+ 注意警語(amber-700);右側本餐 kcal(蔬菜不顯示)。
   - 第二行:角色 `<select>`(h-11,`ITEM_ROLE_LABELS`,`aria-label="{name} 角色"`)+ 克數控制:fixed / variant 為 −10 / 輸入框(`aria-label="{name} 每餐克數"`,一位小數)/ +10 /「g」/ 移除鈕;main 不給輸入,顯示 `Wand2` +「自動補齊 {g} g」粗體 orange-700(0 g 時 stone-600)+ 移除鈕。
   - 該列 `capKindOf(food)` 出現在 `capWarnings` 時列底加 `amber-700 text-xs`「{label}每餐建議 ≤ {cap} g,目前合計 {grams} g」(同類多列都顯示)。
   - 卡底摘要列(`border-t`,`text-sm tabular-nums`,三欄):「固定 {fixedKcal}」「替換 {variantKcal}」「缺口 {gapKcal} kcal」(缺口 < 0 用 rose-700)。`warnings` 文字(`text-xs`):`no_main`「請把一項肉類設為「主力瘦肉」,系統會算出它每餐需要幾克」(stone-600);`main_no_energy`「主力瘦肉必須是有熱量的食材」(amber-700);`over_target`「固定 + 替換已超過目標 {excessKcal} kcal,主力 0 g」(rose-700;excess 0 時「剛好達到目標,主力 0 g」stone-600);`multiple_main` 不顯示(reducer 保證最多一個主力)。
   - 空清單:`EmptyState`(Utensils)「還沒加入食材」+ 主按鈕「加入食材」。
5. 動作列:只有一顆 secondary「加入食材」(block)。
6. 「餐數」卡(`MealsCountCard`):步進器 − [N] +(1–60,按鈕 44px,`aria-label="減少 1 餐"/"增加 1 餐"`,輸入框 `aria-label="餐數"`)+「餐」;「約可吃 {daysCovered} 天(每日 {mealsPerDay} 餐)」。
7. 「每餐結果」卡(有食材且有目標時顯示;唯一視覺重點):白卡 + `orange-50` 內層面板;「每餐 {kcal} kcal」(數字 `text-4xl font-bold tabular-nums`)、「/ 目標 {目標} kcal」、`StatusBadge`(與每日相同 90–110% 規則)+「比目標少 X kcal」/「接近目標」/「比目標多 X kcal」、「每餐生重約 {perMealGrams} g」;面板下方「每餐含」列出各食材 `{name} {gramsPerMeal} g`(主力列加小字「主力」orange-700)。
8. 「採買總量({mealsCount} 餐)」卡:每項 `{name} — {batchGrams} g`(整數不帶小數),最後一行粗體「合計 {batch.totals.grams} g」。
9. `MealAnalysisCard`「每餐營養」(`result={perMeal}`、`batchSupplements={batch.supplements}`):統計、鈣磷比量表、巨量營養素;建議補充中克數類(蛋殼粉)顯示「整批加 X・每餐 Y」,按顆計的魚油只顯示「每餐 1 顆」。

### 食材 `pages/FoodsPage.jsx`(分頁 `foods`)

搜尋、篩選、自訂食材新增/編輯/刪除。卡片「加入批次」把食材加入批次草稿並切到 `batch` 分頁。`FoodSearchSheet` / `FoodFormSheet` 在 `context="batch"` 時「儲存並加入」會加入批次草稿(有毒食材只存入食材庫)。

### 毛孩檔案 `pages/SettingsPage.jsx`

由頂部膠囊或底部「毛孩」開啟。單餐目標 = DER ÷ 每日餐數,批次頁以此(或本次覆寫值)計算缺口與主力瘦肉克數。

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
- 陰影:只用 `shadow-sm`;移除大部分漸層與重陰影。**唯一視覺重點是計算頁的「計算結果」卡**(白卡內 `orange-50` 面板,不用漸層)。
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
- 底部導覽固定,3 格等寬:`食材(Apple)` **`計算`** `毛孩(PawPrint)`。
  - 中央「計算」為突起主按鈕:直徑 56px 圓形 `bg-orange-700 text-white`,`-mt-6` 浮出,`ring-4 ring-cream`,圖示 `ChefHat`,下方文字「計算」(分頁值仍為 `batch`)。
  - 其餘分頁:圖示 22px + 11px 文字;選中 `text-orange-700` 且有 `aria-current="page"`,未選 `stone-600`。
  - 「毛孩」開啟設定頁(與頂部入口相同)。
- 內容區底部留出導覽高度 + safe-area。
- 目前分頁存 localStorage(`furlogic_active_tab`)。分頁值:`batch`(預設)| `foods`。舊值 `today` / `history` / `log` / `home` / `kitchen` 讀取時轉成 `batch`,`search` 轉成 `foods`。
- 導覽狀態用 `NavContext`(`useNav()` → `{ tab, setTab, openSettings }`)。
- 舊版資料匯入提示(`LegacyImportBanner`)顯示在計算分頁頂端。

## 頁面

共通原則:

- 讀取中顯示骨架或「載入中…」,API 失敗顯示 `ErrorState` + 重試。
- 營養數值旁註明生食基準(計算頁一次即可)。
- 已移除單餐記錄、今日頁與歷史頁;伺服器只存毛孩與食材。

### 計算 `pages/BatchPage.jsx`(分頁 `batch`)

鮮食份量的**比例計算器**,**不存伺服器**。使用者加入食材 → 輸入各類別與各食材的**重量占比 %**(占每餐總重;同類加總 = 類別 %,全部加總 = 100%)→ 按「計算」→ 顯示每餐每項應該多少克。

**草稿**存 localStorage `furlogic_batch_draft`(key 不變),形狀 `{ mealsCount: number, mealTargetOverride: number|null, categoryPct: { [cat]: number }, items: [{ food, pct }] }`:

- `mealsCount` 製作餐數 1–60,預設 2,清空時保留;`mealTargetOverride` 本次單餐目標 kcal,null 表示用毛孩設定,清空時清掉。
- 類別(shared `RATIO_CATEGORIES` = `protein|produce|starch|other`,標籤 `RATIO_CATEGORY_LABELS` 蛋白質 / 蔬果 / 澱粉 / 其他)由 `ratioCategoryOf(food)` 決定:`type` protein → 蛋白質;veg / fruit → 蔬果;starch → 澱粉;其他 → 其他。`categoryPct` 只放目前有食材的類別;`pct` 0–100 一位小數。
- `addFood`:去重、有毒不加。若該類別是新出現的 → 依 `defaultCategoryPcts(目前出現的類別)` 重算所有類別 %(`DEFAULT_CATEGORY_PCT` 60 / 30 / 10 / 0 等比正規化到 100,整數,餘數補第一個類別;只有「其他」時為 100);再把該類別 % 用 `splitEvenly`(一位小數,餘數補第一項)平均分給該類所有食材。
- `removeFood`:該類別已無食材 → 刪掉該類別並重算所有類別 %、各類別內再平均分配;否則只重分該類。
- `setCategoryPct(cat, pct)` 設定後把該類食材平均分配成新的類別 %;`setItemPct(id, pct)` 只改該項(不連動);`splitCategory(cat)` 為「平均分配」按鈕。
- 讀取相容上一版(缺口填補)形狀:items 有 `role` / `batchGrams` / `gramsPerMeal` → 保留食材清單,依序 `addFood` 重建 `categoryPct` 與 `pct`。更舊的(`servings`/`grams`/`vegWeightPct`)不遷移,直接視為無效。
- client 以 `toRatioItems(items)` 攤平成 `[{ ...food, pct }]` 交給 shared `planByRatio`。

**計算規則**(shared `planByRatio({ items, mealTarget, mealsCount, mealsPerDay })`):

- **蔬菜不計熱量**:`type === 'veg'` 的熱量、蛋白質、脂肪視為 0,鈣、磷與重量照算;水果與澱粉照常計熱量。
- 熱量密度 `density = Σ (pct/100) × (kcal/100g ÷ 100)`;每餐總重 `W = 單餐目標 ÷ density`;每項每餐克數 `round1(W × pct/100)`、每餐 kcal(整數,蔬菜 0)、共買 `round1(每餐克數 × 餐數)`。
- 錯誤(`ok: false`):合計與 100 差 > 0.05 → `total_not_100`;無單餐目標 → `no_target`;`density ≤ 0`(例如全蔬菜)→ `no_energy`。
- 範例(手稿):蛋白質 60(雞胸 40 / 鴨柳 20)、蔬果 30(南瓜 10 / 冬瓜 20)、澱粉 10(白飯 5 / 薏仁 5),目標 450 → density 0.7835 → 每餐 574 g(雞胸 229.7、鴨柳 114.9、南瓜 57.4、冬瓜 114.9、白飯 28.7、薏仁 28.7 g)。
- **每餐上限**(`MEAL_CAPS`,超過只警告不強制):蔬菜合計 ≤ 50 g(`type === 'veg'`)、內臟 ≤ 12 g(`subtype === 'organ'`)、高脂魚 ≤ 65 g(`subtype === 'fatty_fish'`),回傳 `capWarnings: [{ kind, grams, cap, label }]`。
- 回傳 `{ ok, errors, mealsCount, mealTarget, totalGramsPerMeal, items, perMeal, batch, status, daysCovered, capWarnings }`;`batch` 為全部餐數的營養與補充品(蛋殼粉),約可吃天數 = 餐數 ÷ 每日餐數。

**UI**(由上到下,390px 優先):

1. `PageHeader`「計算」/「設定食材重量比例,計算每餐克數」;有食材時右上 ghost「清空」(兩段式確認)。
2. 提示列(Info 圖示):「營養數值為生食基準,請輸入下鍋前的生重」。
3. 「單餐目標」卡:「毛孩設定 {mealTarget} kcal(DER ÷ {mealsPerDay} 餐)」(`text-sm stone-600`);輸入列「本次目標」+ `inputMode="numeric"` 輸入框(h-11、w-24、右對齊,placeholder 為毛孩值)+「kcal」;有覆寫且 ≠ 毛孩值時右側 ghost「還原」。有效目標 = `mealTargetOverride ?? metrics.mealTargetRaw`。沒有毛孩目標也沒覆寫時顯示 `amber-700`「請先在「毛孩」設定體重,或輸入本次目標」。
4. 「食材比例」卡:標題右側 `text-sm tabular-nums`「合計 {Σ類別%}%」(≠ 100 rose-700;= 100 emerald-700)。
   - 依 `RATIO_CATEGORIES` 順序,只顯示有食材的類別,區塊間 `border-t border-stone-100`。第一行:類別名(font-semibold)+ 右側類別 % 輸入框(w-20、右對齊、`inputMode="decimal"`、`border-2 border-stone-400`、`aria-label="{類別} 占比"`)+「%」。
   - 類內每項一行(`pl-4` + `border-l-2 border-stone-200`):名稱(break-words)+ 小字 `{kcal} kcal/100g`(蔬菜「蔬菜 · 不計熱量」);右側 % 輸入框(w-16、`aria-label="{name} 占比"`)+「%」+ 移除鈕(Trash2,44px)。
   - 類內食材合計 ≠ 類別 %(差 > 0.05):區塊底 `text-xs amber-700`「{類別}食材合計 {x}%,應為 {y}%」+ 右側 ghost「平均分配」。
   - 空清單:`EmptyState`(Utensils)「還沒加入食材」+ 主按鈕「加入食材」;有食材時卡底 secondary block「加入食材」,開啟 `FoodSearchSheet` 抽屜(可複選):
     - 每列為 toggle(`role="checkbox"`、`aria-checked`、`aria-label` 為食材名),右側 `SafetyBadge` 左邊 20px 圓圈(未選 `border-2 stone-300`;選中 `orange-700` 實心內含白色 `Check` 14px),選中列底 `orange-50`;有毒(「對狗有毒,不可加入」)或已加入(「已加入」)者 disabled、不顯示圓圈。
     - 已選項保存在抽屜內(保留勾選順序),換搜尋字不清掉;搜尋框下方有勾選時顯示 `text-xs stone-600`「已選 {n} 項:{名稱以、串接,超過 3 個加…}」+ 右側 ghost「清除」。
     - 底部 footer 主按鈕(block、lg):「加入 {n} 項」(0 項時「加入食材」並 disabled);按下依勾選順序逐一加入草稿後關閉。線上查詢 / 手動新增儲存後直接加入並關閉抽屜(已勾選項先一併加入)。
5. 「餐數」卡(有食材時):步進器 − [N] +(1–60,按鈕 44px,`aria-label="減少 1 餐"/"增加 1 餐"`,輸入框 `aria-label="餐數"`)+「餐」;「約可吃 {daysCovered} 天(每日 {mealsPerDay} 餐)」。
6. 主按鈕「計算」(`Calculator`、primary、block、lg)。停用條件依序:無食材、任一類別食材合計 ≠ 類別 %、類別合計 ≠ 100、無目標;停用時按鈕下方 `text-xs stone-600` 說明第一個未滿足的條件。
7. 按下後把 `planByRatio` 結果與當下輸入簽章(JSON 字串:各項 % / 類別 % / 目標 / 餐數 / 每日餐數)存在元件 state;輸入改變後結果卡頂部顯示 amber-700「比例或目標已變更,請重新計算」,數字仍為舊結果。重新整理或清空後不保留結果。`ok: false` 時顯示 rose-700 錯誤文字。
8. 「計算結果」卡(唯一視覺重點,白卡 + `orange-50` 內層面板):大字「每餐 {totalGramsPerMeal} g」(`text-4xl font-bold tabular-nums`)、下一行「{每餐 kcal} kcal / 目標 {目標} kcal」+ `StatusBadge`(90–110% 規則);面板下依類別分組,組標題「{類別} {Σg} g」,每項 `{name}` 右側粗體 `{gramsPerMeal} g`、下方小字「{pct}% · 共買 {batchGrams} g」。有 `capWarnings` 時卡底 amber-700 條列「{label}每餐建議 ≤ {cap} g,目前 {grams} g」。
9. `MealAnalysisCard`「每餐營養」(`result={perMeal}`、`batchSupplements={batch.supplements}`):統計、鈣磷比量表、巨量營養素;建議補充中克數類(蛋殼粉)顯示「共買需加 X・每餐 Y」,按顆計的魚油只顯示「每餐 1 顆」。

### 食材 `pages/FoodsPage.jsx`(分頁 `foods`)

搜尋、篩選、自訂食材新增/編輯/刪除。卡片「加入計算」把食材加入計算頁草稿並切到 `batch` 分頁。`FoodSearchSheet`(計算頁的複選抽屜,底部「加入 N 項」)/ `FoodFormSheet` 在 `context="batch"` 時「儲存並加入」會把新食材連同已勾選項加入計算頁草稿並關閉抽屜(有毒食材只存入食材庫)。

### 毛孩檔案 `pages/SettingsPage.jsx`

由頂部膠囊或底部「毛孩」開啟。單餐目標 = DER ÷ 每日餐數,計算頁以此(或本次覆寫值)換算每餐總重與各項克數。

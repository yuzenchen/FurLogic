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
- 底部導覽固定,3 格等寬:`食材(Apple)` **`計算`** `AI 復盤(Sparkles)`。
  - 中央「計算」為突起主按鈕:直徑 56px 圓形 `bg-orange-700 text-white`,`-mt-6` 浮出,`ring-4 ring-cream`,圖示 `ChefHat`,下方文字「計算」(分頁值仍為 `batch`)。
  - 其餘分頁:圖示 22px + 11px 文字;選中 `text-orange-700` 且有 `aria-current="page"`,未選 `stone-600`。
  - 「AI 復盤」切到分頁 `review`(選中規則同「食材」)。毛孩設定**只**從頂部毛孩膠囊進入。
- 內容區底部留出導覽高度 + safe-area。
- 目前分頁存 localStorage(`furlogic_active_tab`)。分頁值:`batch`(預設)| `foods` | `review`。舊值 `today` / `history` / `log` / `home` / `kitchen` 讀取時轉成 `batch`,`search` 轉成 `foods`。
- 導覽狀態用 `NavContext`(`useNav()` → `{ tab, setTab, openSettings, closeSettings, settingsOpen, pendingReview, startReview, clearPendingReview }`)。`startReview()` 設記憶體旗標 `pendingReview` 並切到 `review`,ReviewPage 讀到後自動開始一次並清掉(不用 sessionStorage,重新整理不會再自動觸發)。
- **捲動規則**:可捲動的只有 `<main>`(外層是 `h-[100dvh] overflow-hidden`)。程式捲動一律呼叫 `main.scrollTo(...)`(依 `getBoundingClientRect` 差值算位置,尊重 `prefers-reduced-motion`),**不要用 `scrollIntoView`**——它會連外層容器一起捲,把頂部列推出畫面。
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
     - 底部 footer 主按鈕(block、lg):「加入 {n} 項」(0 項時「加入食材」並 disabled);按下依勾選順序逐一加入草稿後關閉。找不到結果時顯示「用 AI 新增「{q}」」(Sparkles)、清單底部連結「新增食材」,都開 `AddFoodSheet`(前者帶入 q,`context="batch"`);儲存後直接加入並關閉抽屜(已勾選項先一併加入;有毒食材只存入食材庫並提示)。
5. 「餐數」卡(有食材時):步進器 − [N] +(1–60,按鈕 44px,`aria-label="減少 1 餐"/"增加 1 餐"`,輸入框 `aria-label="餐數"`)+「餐」;「約可吃 {daysCovered} 天(每日 {mealsPerDay} 餐)」。
6. 主按鈕「計算」(`Calculator`、primary、block、lg)。停用條件依序:無食材、任一類別食材合計 ≠ 類別 %、類別合計 ≠ 100、無目標;停用時按鈕下方 `text-xs stone-600` 說明第一個未滿足的條件。
7. **收合**:按「計算」且 `result.ok` → 第 3–6 項(單餐目標卡、食材比例卡、餐數卡、計算按鈕)整組換成「計算條件」摘要卡(`Card`,`aria-label="計算條件"`):第一行 `text-sm font-semibold stone-900`「計算條件」+ 右側 secondary「編輯比例」(Pencil);內容 `text-sm stone-700 tabular-nums`,每類一行「{類別} {類別%}% — {食材名 %、…}」,最後一行「目標 {kcal} kcal · {餐數} 餐」。「編輯比例」、清空、重新整理、或結果變 stale(例如毛孩設定改了目標)時展開。計算成功後 `<main>` 捲到最上方(摘要卡 + 結果卡自然在視野內);失敗時捲到錯誤訊息。每次成功都把本次計算存成「最近一次計算」(見 AI 復盤)。
8. 按下後把 `planByRatio` 結果與當下輸入簽章(JSON 字串:各項 % / 類別 % / 目標 / 餐數 / 每日餐數)存在元件 state;輸入改變後結果卡頂部顯示 amber-700「比例或目標已變更,請重新計算」,數字仍為舊結果。重新整理或清空後不保留結果。`ok: false` 時顯示 rose-700 錯誤文字。
9. 「計算結果」卡(唯一視覺重點,白卡 + `orange-50` 內層面板):大字「每餐 {totalGramsPerMeal} g」(`text-4xl font-bold tabular-nums`)、下一行「{每餐 kcal} kcal / 目標 {目標} kcal」+ `StatusBadge`(90–110% 規則);面板下依類別分組,組標題「{類別} {Σg} g」,每項 `{name}` 右側粗體 `{gramsPerMeal} g`、下方小字「{pct}% · 共買 {batchGrams} g」。有 `capWarnings` 時卡底 amber-700 條列「{label}每餐建議 ≤ {cap} g,目前 {grams} g」。卡片最底 secondary block「AI 復盤」(Sparkles):重新寫入最近一次計算 → `startReview()`。
10. `MealAnalysisCard`「每餐營養」(`result={perMeal}`、`batchSupplements={batch.supplements}`):統計、鈣磷比量表、巨量營養素;建議補充中克數類(蛋殼粉)顯示「共買需加 X・每餐 Y」,按顆計的魚油只顯示「每餐 1 顆」。

### 食材 `pages/FoodsPage.jsx`(分頁 `foods`)

搜尋、篩選、自訂食材新增/編輯/刪除。卡片「加入計算」把食材加入計算頁草稿並切到 `batch` 分頁。`FoodSearchSheet`(計算頁的複選抽屜,底部「加入 N 項」)/ `FoodFormSheet` 在 `context="batch"` 時「儲存並加入」會把新食材連同已勾選項加入計算頁草稿並關閉抽屜(有毒食材只存入食材庫)。

右上「新增」與「還沒有自訂食材」的「新增」開 `AddFoodSheet`(帶入目前搜尋字);卡片「編輯」開 `FoodFormSheet`(mode 'edit')。手動輸入只從 AddFoodSheet 的「改為手動輸入 / 手動輸入」進入,不另放入口。

#### 新增食材 `components/foods/AddFoodSheet.jsx`

只輸入**食材名稱**,由 AI 回填營養(API `POST /api/foods/lookup { query }` → `{ draft, confidence: high|medium|low, note, cached }`,不寫入食材庫);先預覽再儲存。Props:`initialName`、`context` foods/batch、`onClose`、`onSaved(food)`。BottomSheet 標題「新增食材」,同一個 sheet 換內容:

1. **輸入名稱**:說明 `text-sm stone-600`「輸入食材名稱，AI 會依資料庫格式填好營養值」;輸入框 h-11、`aria-label="食材名稱"`、maxLength 50;footer 主按鈕「AI 查詢」(Sparkles、block、lg;空字串停用;查詢中 spinner +「AI 查詢中…」並停用);Enter 送出。
2. **預覽**:名稱 `text-xl font-bold` + nameEn(`text-xs stone-600`);徽章列:類別(`FOOD_TYPES` 標籤)、`SafetyBadge`、subtype「內臟」/「高脂魚」、AI 信心(high emerald「AI 信心高」/ medium amber「AI 信心中」/ low rose「AI 信心低」)。`warning` amber-700、`description` stone-700;「每 100 g 營養」兩欄 `Stat`:熱量 kcal、蛋白質 g、脂肪 g、鈣 mg、磷 mg,下方 `text-xs stone-600`「營養以生重計（名稱帶「(熟)」為熟重）」。confidence low 時 amber-50 提示「AI 對這筆數值把握較低，建議手動確認」;`note`、`sourceRef`(「來源：…」)`text-xs stone-600`,有才顯示。
   - footer:主按鈕(block、lg)「儲存」(`context="batch"` 時「儲存並加入」,有毒「只存入食材庫」)→ `createFood`(draft 只挑 API 允許欄位、截長度、`source: 'ai'`,見 `utils/foodDraft.js`);下一列 secondary「修改」→ `FoodFormSheet` mode 'lookup'(initial = draft)微調後儲存;ghost「重新查詢」回步驟一(保留名稱)。
   - 同名(409 `duplicate_name`)→ rose-700「已有同名食材「{name}」」。
3. **錯誤**(停在步驟一,輸入框下方):
   - 422 `food_unrecognized` → rose-700「AI 看不懂這個食材：{message}」;下一行 `text-xs stone-600`「請換個更明確的名稱，例如「雞胸肉」「冬瓜」」+ 小連結「改為手動輸入」(開 `FoodFormSheet` mode 'manual',帶入名稱)。
   - 503 `ai_unavailable` → rose「AI 未設定（ANTHROPIC_API_KEY），請改用手動輸入」+ secondary「手動輸入」。
   - 429(`ai_quota_exceeded` / `rate_limited`)→ rose「AI 額度已用完或太頻繁：{message}」。
   - 其他(含 `ai_failed`)→ rose「AI 查詢失敗：{message}」+ ghost「重試」。

- `FoodFormSheet` 會暫時取代 AddFoodSheet,取消後回到 AddFoodSheet。

### AI 復盤 `pages/ReviewPage.jsx`(分頁 `review`)

請 AI 重新驗算最近一次計算並檢查營養是否合理(API:`GET /api/ai/status`、`POST /api/ai/review`)。

- **最近一次計算** 存 localStorage `furlogic_last_calc`(`saveLastCalc` / `getLastCalc`,壞資料回 null):`utils/review.js` 的 `buildReviewPayload({ pet, mealTarget, mealsCount, mealsPerDay, result })` + `computedAt`(ISO)。每次按「計算」且 ok 就存。送出前以 `toReviewBody` 拿掉 `computedAt`——後端對未知欄位回 400,payload 只能有 `pet{name,weight}`、`mealTarget`(未四捨五入,> 0)、`mealsCount`、`mealsPerDay`(整數 1–4)、`items[{name(≤ 40 字),type,subtype,calories,protein,fat,ca,p,pct,gramsPerMeal}]`、`appResult{totalGramsPerMeal,perMealKcal,protein,fat,ca,p,caPRatio(數字或 null),capWarnings[字串]}`;數值缺漏補 0,毛孩名 1–30 字(空則「毛孩」)。
- **最近一次復盤** 存 `furlogic_last_review`(`{ computedAt, review, model, costUsd }`);computedAt 與最近一次計算不同就不顯示。結果也存在元件 state。
- UI(由上到下):
  1. `PageHeader`「AI 復盤」/「請 AI 重新驗算計算結果並檢查營養是否合理」。
  2. 無最近一次計算:`EmptyState`(Sparkles)「還沒有計算結果」+ 主按鈕「去計算」(切到 `batch`)。
  3. 「最近一次計算」卡:`text-xs stone-600` 計算時間(`zh-TW` 本地格式);「每餐 {g} g · {kcal} kcal / 目標 {目標} kcal · {餐數} 餐」;每項「{name} {pct}% → {gramsPerMeal} g」。
  4. 主按鈕「請 AI 復盤」(Sparkles、block、lg;進行中 spinner +「AI 驗算中…」並停用)。`configured=false` 時停用,下方 amber-700「尚未設定 AI 金鑰（ANTHROPIC_API_KEY）」;`text-xs stone-600`「今日用量 $x / $limit」。
  5. 結果卡:大徽章 pass emerald「計算正確」(Check)/ warn amber「計算正確，有營養建議」(AlertCircle)/ fail rose「計算有誤」(X);summary 段落;「逐項檢查」每項 ok 圖示(Check emerald / X rose)+ 粗體 label + `text-xs`「預期 {expected} · App {actual}」+ note(stone-600);「建議」條列(有才顯示);底部 `text-xs stone-500`「模型 {model} · 本次 $0.0000」。
  6. 錯誤:`ai_unavailable` → 同金鑰提示;`ai_quota_exceeded` → rose「AI 額度已用完（{message}）」;其他(含 `ai_failed`、一般 429 頻率限制)→ rose「AI 復盤失敗：{message}」+ ghost「重試」。
- 從計算頁「AI 復盤」進來(`pendingReview`)且已設定金鑰 → 自動開始一次;同一個 computedAt 只自動觸發一次。

### 毛孩檔案 `pages/SettingsPage.jsx`

只由頂部毛孩膠囊開啟。單餐目標 = DER ÷ 每日餐數,計算頁以此(或本次覆寫值)換算每餐總重與各項克數。

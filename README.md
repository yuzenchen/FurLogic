# FurLogic - 毛孩邏輯營養管理系統

[![Deploy to GitHub Pages](https://github.com/yuzenchen/FurLogic/actions/workflows/deploy-gh-pages.yml/badge.svg)](https://github.com/yuzenchen/FurLogic/actions/workflows/deploy-gh-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一個專為寵物主人設計的智能營養管理應用程式,協助您為毛孩打造健康均衡的鮮食餐。

## 🌐 線上 Demo

訪問：[https://yuzenchen.github.io/FurLogic/](https://yuzenchen.github.io/FurLogic/)

## 功能特色

### 🏠 健康儀表板
- 即時計算毛孩的每日代謝能需求 (DER)
- 基礎代謝率 (RER) 顯示
- 建議飲水量計算
- 快速存取各項功能

### 🔍 食材知識庫
- 完整的食材安全性資料庫
- 詳細營養成分標示
- 鈣磷含量資訊
- 食用警告與注意事項

### 👨‍🍳 AI 智能配餐
有兩種流程:

- **智能配餐**:點選冰箱有的食材,系統依毛孩 DER 自動分配份量(肉:蔬 = 7:3)。
- **拍照配餐**:對著食材拍張照,AI 列出辨識到的條目,使用者手動填寫每項克數,系統依「實際克數」計算營養。
  需在 `worker/` 部署 Cloudflare Worker 並設好 `VITE_VISION_WORKER_URL`,否則此流程降級為純手動。

兩條路徑都會輸出鈣磷比視覺化、巨集分布、營養補充品建議。

## 技術架構

### 前端框架
- React 18+ with Hooks
- Lucide Icons
- Tailwind CSS

### CI/CD
- GitHub Actions 自動化部署
- GitHub Pages 靜態託管

### 專案結構
```
FurLogic/
├── .github/workflows/deploy-gh-pages.yml
├── worker/                          # Cloudflare Worker (Gemini vision proxy)
│   ├── src/index.js
│   ├── wrangler.toml
│   └── README.md                    # 部署指南
├── src/
│   ├── App.jsx                    # 容器:routing + layout
│   ├── main.jsx
│   ├── components/
│   │   ├── HomePage.jsx           # 健康儀表板
│   │   ├── SearchPage.jsx         # 食材知識庫
│   │   ├── SettingsPage.jsx       # 毛孩檔案設定
│   │   ├── KitchenPage.jsx        # 配餐容器(智能 / 拍照雙模式)
│   │   ├── TabButton.jsx
│   │   └── kitchen/
│   │       ├── CaPRatioGauge.jsx
│   │       ├── IngredientPicker.jsx
│   │       ├── MacroBars.jsx
│   │       ├── PhotoCapture.jsx   # 拍照 / 上傳 + AI 觸發
│   │       ├── PortionBuilder.jsx # 食材清單 + 克數輸入
│   │       └── RecipeResult.jsx
│   ├── context/PetContext.jsx     # 毛孩檔案 + 衍生指標 (Provider/usePet)
│   ├── hooks/
│   │   ├── usePersistentState.js  # localStorage 持久化的 useState
│   │   ├── usePetMetrics.js       # RER/DER/活動係數/飲水量
│   │   ├── useKitchenIngredients.js
│   │   └── useVisionWorker.js     # 對 Cloudflare Worker /analyze 的 client
│   ├── data/foodDatabase.js
│   ├── utils/
│   │   ├── nutritionCalculator.js
│   │   ├── nutritionCalculator.test.js
│   │   ├── nutritionConstants.js  # NRC/WSAVA/AAFCO 來源常數
│   │   └── storage.js
│   └── styles/index.css
├── .prettierrc.json
├── package.json
└── README.md
```

## 快速開始

```bash
npm install      # 安裝依賴
npm run dev      # 開發模式 (http://localhost:3000)
npm test         # 跑單元測試
npm run build    # 建置生產版本
npm run preview  # 本地預覽 build 結果
npm run lint     # ESLint
npm run format   # Prettier 格式化
```

## 部署

每次推送到 `main` 時，GitHub Actions 會自動建置並發布到 GitHub Pages。

### 一次性設定

1. **啟用 Pages**
   - Repository → Settings → Pages
   - Source 選 **GitHub Actions**

2. **首次推送 main 後**
   - Actions 跑完即可在 `https://yuzenchen.github.io/FurLogic/` 看到網站

3. **(選用) 綁自訂 domain**
   - Settings → Pages → Custom domain 填入網域
   - 在 repo 根目錄新增 `CNAME` 檔(內容為網域)
   - 編輯 `.github/workflows/deploy-gh-pages.yml`，移除 `VITE_BASE: /FurLogic/` 那一行(自訂 domain 服務於根路徑)

## 營養計算邏輯

### RER (靜止能量需求)
```
RER = 70 × (體重kg)^0.75
```

### DER (每日能量需求)
```
DER = RER × 活動係數
```

活動係數:
- 已結紮 + 一般活動: 1.6
- 未結紮 + 一般活動: 1.8
- 低活動量: -0.2
- 高活動量: +0.4

### 鈣磷比例
- 理想範圍: 1:1 ~ 1.5:1
- 過低 (<1:1): 需補充鈣質
- 過高 (>2:1): 需減少骨頭或鈣粉

## 食材安全等級

- 🟢 **安全 (Safe)**: 可正常食用
- 🟡 **注意 (Caution)**: 限量或特定條件下食用
- 🔴 **禁止 (Toxic)**: 絕對禁止,有致命風險

## 開發計畫

### Phase 1 (已完成)
- ✅ 基礎 UI 框架
- ✅ 熱量計算引擎
- ✅ 食材資料庫
- ✅ 鈣磷比分析
- ✅ CI/CD 自動部署

### Phase 2 (進行中)
- 🚧 後端 API 整合
- 🚧 使用者資料持久化
- 🚧 食材照片上傳識別

### Phase 3 (規劃中)
- 📋 歷史記錄追蹤
- 📋 營養趨勢分析
- 📋 獸醫師諮詢功能
- 📋 社群分享食譜

## 醫學免責聲明

⚠️ **重要提醒**

本應用提供的營養計算與食譜建議僅為**衛教參考**,**不構成獸醫診斷或處方**。

- 計算公式 (RER/DER/鈣磷比) 來自公開的學術文獻 (NRC 2006、WSAVA 2011、AAFCO 等),可能未涵蓋您的毛孩個別需求
- 鮮食轉換、特殊疾病(腎臟病、糖尿病、過敏、胰臟炎等)、幼犬幼貓、懷孕哺乳期動物**必須**先諮詢執業獸醫師
- 食材安全等級僅列舉常見品項,並非完整毒物清單
- 本專案作者與貢獻者**不承擔**因使用本應用造成的任何健康損害

如毛孩出現嘔吐、腹瀉、食慾不振等異常症狀,請立即就醫。

## 貢獻

歡迎提交 Pull Request 或開 Issue 討論功能建議！

### 開發指南

1. Fork 專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 授權

MIT License - 詳見 [LICENSE](LICENSE) 檔案

## 聯絡方式

如有問題或建議,歡迎開 Issue 討論!

---

用 ❤️ 與 🐾 製作
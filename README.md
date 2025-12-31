# FurLogic - 毛孩邏輯營養管理系統

[![Deploy to Cloudflare Pages](https://github.com/yuzenchen/FurLogic/actions/workflows/deploy.yml/badge.svg)](https://github.com/yuzenchen/FurLogic/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一個專為寵物主人設計的智能營養管理應用程式,協助您為毛孩打造健康均衡的鮮食餐。

## 🌐 線上 Demo

訪問：[https://furlogic.pages.dev](https://furlogic.pages.dev)

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
- 根據選擇的食材自動計算份量
- 鈣磷比例分析與建議
- 營養補充品建議
- 適合毛孩體重的客製化食譜

## 技術架構

### 前端框架
- React 18+ with Hooks
- Lucide Icons
- Tailwind CSS

### CI/CD
- GitHub Actions 自動化部署
- Cloudflare Pages 全球 CDN
- 自動 Preview 部署（PR）

### 專案結構
```
FurLogic/
├── .github/
│   └── workflows/          # GitHub Actions 配置
│       ├── deploy.yml      # 生產環境部署
│       └── preview.yml     # PR 預覽部署
├── src/
│   ├── components/         # React 元件
│   │   ├── TabButton.jsx
│   │   ├── SettingsPage.jsx
│   │   ├── HomePage.jsx
│   │   ├── SearchPage.jsx
│   │   └── KitchenPage.jsx
│   ├── data/              # 資料層
│   │   └── foodDatabase.js
│   ├── utils/             # 工具函數
│   │   └── nutritionCalculator.js
│   ├── styles/            # 樣式檔案
│   │   └── index.css
│   └── App.jsx            # 主應用程式
├── package.json
├── .gitignore
└── README.md
```

## 快速開始

### 安裝依賴
```bash
npm install
```

### 開發模式
```bash
npm run dev
```

### 建置生產版本
```bash
npm run build
```

### 本地預覽
```bash
npm run preview
```

## 部署

### 自動部署（推薦）

每次推送到 `main` 分支時，GitHub Actions 會自動：
1. ✅ 安裝依賴
2. ✅ 執行建置
3. ✅ 部署到 Cloudflare Pages
4. ✅ 更新線上版本

### 設定步驟

1. **取得 Cloudflare API Token**
   - 前往 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - 建立 Token，權限：`Cloudflare Pages:Edit`

2. **取得 Account ID**
   - 前往 Cloudflare Dashboard
   - 右側邊欄可以看到 Account ID

3. **設定 GitHub Secrets**
   - 前往 Repository → Settings → Secrets and variables → Actions
   - 新增以下 secrets：
     - `CLOUDFLARE_API_TOKEN`: 您的 API Token
     - `CLOUDFLARE_ACCOUNT_ID`: 您的 Account ID

4. **推送程式碼**
   ```bash
   git add .
   git commit -m "啟用自動部署"
   git push origin main
   ```

5. **查看部署狀態**
   - 前往 Repository → Actions
   - 查看工作流程執行狀態

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

## 注意事項

⚠️ **重要提醒**
- 本系統為輔助工具,不能取代專業獸醫建議
- 初次轉換鮮食請諮詢獸醫師
- 特殊疾病犬隻需要特別配方
- 食材新鮮度與烹調方式同樣重要

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
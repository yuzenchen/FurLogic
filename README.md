# FurLogic 毛孩鮮食熱量計算器

[![CI](https://github.com/yuzenchen/FurLogic/actions/workflows/ci.yml/badge.svg)](https://github.com/yuzenchen/FurLogic/actions/workflows/ci.yml)

## 簡介

FurLogic 幫你**規劃毛孩鮮食的批次製作**:設定每餐的固定班底與替換肉類,由單餐目標的熱量缺口反推主力瘦肉克數,再乘上餐數得到採買總量與每餐營養。計算全部在瀏覽器完成,不會儲存餐點紀錄。

主要功能:

- **批次製作**:固定班底 + 替換肉類 → 缺口由主力瘦肉補齊 → 每餐熱量與營養、採買總量、補充品建議
- **食材庫**:食材資料庫與安全等級,可自訂食材
- **線上熱量查詢**:透過 USDA / Gemini 查詢食材熱量(需 API 金鑰)
- **毛孩設定**:體重、結紮、活動量、每日餐數

## 架構

```
FurLogic/
├── client/      # Vite + React 前端
├── server/      # Fastify + better-sqlite3 API
├── shared/      # 前後端共用的計算邏輯與常數
├── docker/      # nginx 設定 (web 映像使用)
├── Dockerfile.api
├── Dockerfile.web
└── docker-compose.yml
```

資料存在 SQLite:`${DATA_DIR}/furlogic.db`。

詳細文件:[docs/API.md](docs/API.md)、[docs/DESIGN.md](docs/DESIGN.md)。

## 本機開發

需求:Node.js 22+

```bash
npm install
cp .env.example .env   # 將 DATA_DIR 改成 ./data,或直接刪掉該行
npm run dev            # client: http://localhost:3000 (/api 代理到 8787)
```

其他指令:

```bash
npm test              # 單元測試
npm run lint          # ESLint
npm run format        # Prettier 格式化
npm run format:check  # 檢查格式
npm run build         # 建置
```

## Docker 啟動

```bash
cp .env.example .env
docker compose up -d --build
# 開啟 http://localhost:8080
docker compose ps
docker compose logs -f
docker compose down      # 保留 furlogic-data volume(資料仍在)
docker compose down -v   # 連同資料一起刪除
```

映像支援多架構,可在 Raspberry Pi (arm64) 上執行。交叉建置範例:

```bash
docker buildx build --platform linux/arm64 -f Dockerfile.api .
```

## 環境變數

| 變數              | 說明                                     | 預設值                                        |
| ----------------- | ---------------------------------------- | --------------------------------------------- |
| `PORT`            | API 監聽埠                               | `8787`                                        |
| `DATA_DIR`        | SQLite 資料目錄                          | `./data`(Docker:`/data`)                      |
| `ALLOWED_ORIGINS` | CORS 允許的前端來源(逗號分隔)            | `http://localhost:3000,http://localhost:8080` |
| `TZ`              | 時區                                     | `Asia/Taipei`                                 |
| `GEMINI_API_KEY`  | Gemini API 金鑰                          | 空白                                          |
| `USDA_API_KEY`    | USDA FoodData Central 金鑰               | 空白                                          |
| `GEMINI_MODEL`    | Gemini 模型名稱                          | `gemini-2.5-flash`                            |
| `VITE_API_URL`    | 前端 build 時使用的 API 位址(build-time) | 空白 = 同源 `/api`                            |

未設定 `GEMINI_API_KEY` / `USDA_API_KEY` 時,線上查詢會回傳 503,App 會退回手動輸入。

- USDA 金鑰申請:https://fdc.nal.usda.gov/api-key-signup
- Gemini 金鑰申請:https://aistudio.google.com/apikey

## 舊版資料匯入

若瀏覽器中有舊版(localStorage)的毛孩資料,App 會提供一鍵匯入。

## 部署規劃

- 已移除 GitHub Pages 部署。
- 前端將移至 **Cloudflare Pages**,build 時設定 `VITE_API_URL` 指向 API。
- API 將以容器形式在 **Raspberry Pi** 上執行,並依前端網域設定 `ALLOWED_ORIGINS`。
- 存取控制預計使用 **Cloudflare Access**(尚未完成)。

## CI

`.github/workflows/ci.yml` 於每次 push 與 pull request 執行:

1. `npm ci` → `npm run lint` → `npm test` → `npm run format:check` → `npm run build`
2. 測試通過後,以 Buildx 建置 `Dockerfile.api` 與 `Dockerfile.web`(不推送,使用 GitHub Actions 快取)

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

### 單餐目標

```
單餐目標 = DER ÷ 每日餐數
```

### 批次製作(缺口填補)

```
缺口 = 單餐目標 − Σ固定班底熱量 − Σ替換肉類熱量(蔬菜不計熱量)
主力瘦肉每餐克數 = 缺口 ÷ (主力 kcal/100g ÷ 100),無條件進位到整數 g
採買總量 = 每餐克數 × 餐數
```

每餐上限(超過只提醒):蔬菜 50 g、內臟 12 g、高脂魚 65 g。

### 鈣磷比例

- 理想範圍: 1:1 ~ 1.5:1
- 過低 (<1:1): 需補充鈣質
- 過高 (>2:1): 需減少骨頭或鈣粉

## 食材安全等級

- 🟢 **安全 (Safe)**: 可正常食用
- 🟡 **注意 (Caution)**: 限量或特定條件下食用
- 🔴 **禁止 (Toxic)**: 絕對禁止,有致命風險

## 醫學免責聲明

⚠️ **重要提醒**

本應用提供的營養計算與食譜建議僅為**衛教參考**,**不構成獸醫診斷或處方**。

- 計算公式 (RER/DER/鈣磷比) 來自公開的學術文獻 (NRC 2006、WSAVA 2011、AAFCO 等),可能未涵蓋您的毛孩個別需求
- 鮮食轉換、特殊疾病(腎臟病、糖尿病、過敏、胰臟炎等)、幼犬幼貓、懷孕哺乳期動物**必須**先諮詢執業獸醫師
- 食材安全等級僅列舉常見品項,並非完整毒物清單
- 本專案作者與貢獻者**不承擔**因使用本應用造成的任何健康損害

如毛孩出現嘔吐、腹瀉、食慾不振等異常症狀,請立即就醫。

## 授權

MIT License - 詳見 [LICENSE](LICENSE) 檔案

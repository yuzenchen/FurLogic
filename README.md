# FurLogic 毛孩鮮食熱量計算器

[![CI](https://github.com/yuzenchen/FurLogic/actions/workflows/ci.yml/badge.svg)](https://github.com/yuzenchen/FurLogic/actions/workflows/ci.yml)

## 簡介

FurLogic 幫你**規劃毛孩鮮食的份量**:設定各類別(蛋白質 / 蔬果 / 澱粉)與各食材占每餐總重的比例,依單餐目標熱量算出每餐每項食材要幾克,再乘上餐數得到共買總量與每餐營養。計算全部在瀏覽器完成,不會儲存餐點紀錄。

主要功能:

- **比例計算**:各食材重量占比 % → 依單餐目標反推每餐總重 → 每餐各項克數、共買量、每餐營養與補充品建議
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
├── docker-compose.yml     # 本機 Docker(port 8080,named volume)
└── docker-compose.pi.yml  # 樹莓派正式版(port 8080,資料在 ./data)
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

## Docker 啟動(本機)

```bash
cp .env.example .env
docker compose up -d --build
# 開啟 http://localhost:8080
docker compose ps
docker compose logs -f
docker compose down      # 保留 furlogic-data volume(資料仍在)
docker compose down -v   # 連同資料一起刪除
```

映像支援多架構,可在 Raspberry Pi (arm64) 上執行(部署方式見下方「正式版部署(樹莓派)」)。交叉建置範例:

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
| `ANTHROPIC_API_KEY` | Anthropic API 金鑰(AI 復盤用,只放 .env) | 空白                                        |
| `AI_MODEL`        | AI 復盤使用的 Claude 模型                | `claude-opus-5-5`                             |
| `AI_DAILY_USD`    | AI 復盤每日花費上限(USD,台北時間日界)  | `1`                                           |
| `AI_MONTHLY_USD`  | AI 復盤每月花費上限(USD,台北時間月界)  | `10`                                          |
| `VITE_API_URL`    | 前端 build 時使用的 API 位址(build-time) | 空白 = 同源 `/api`                            |

未設定 `GEMINI_API_KEY` / `USDA_API_KEY` 時,線上查詢會回傳 503,App 會退回手動輸入。

AI 復盤(`POST /api/ai/review`,由 Claude 獨立重算比例計算結果並檢查營養)需要設定 `ANTHROPIC_API_KEY`;
未設定時回傳 503。每次呼叫的 token 用量與成本記錄在 `ai_usage` 表,日 / 月額度用完回傳 429。

- USDA 金鑰申請:https://fdc.nal.usda.gov/api-key-signup
- Gemini 金鑰申請:https://aistudio.google.com/apikey

## 舊版資料匯入

若瀏覽器中有舊版(localStorage)的毛孩資料,App 會提供一鍵匯入。

## 正式版部署（樹莓派）

開發模式(Vite dev server)吃幾百 MB 記憶體,**不要**放到 Pi 上跑。正式版是兩個容器:`web`(nginx 托管靜態檔 + 反代 `/api`)與 `api`(Fastify + better-sqlite3)。記憶體上限 web 64 MB、api 256 MB,Pi 5 2 GB 足夠。base image 都是多架構(amd64 / arm64),直接在 Pi 上 build。

前提:Pi 已安裝 Docker(含 Compose)。

```bash
git clone https://github.com/yuzenchen/FurLogic.git ~/FurLogic
cd ~/FurLogic
cp .env.example .env   # ALLOWED_ORIGINS 加上 http://<Pi IP>:8080,例:http://192.168.8.192:8080
mkdir -p data          # 先自己建,資料夾才會屬於登入使用者(容器內以 uid 1000 寫入)
docker compose -f docker-compose.pi.yml up -d --build
```

家用網路用瀏覽器開 `http://<Pi 的 IP>:8080` 即可(port 避開了綠葉專案的 80/443/3000/3001/3002/3100 與 jojo 的 8088)。

- `.env` 的 `GEMINI_API_KEY` / `USDA_API_KEY` 可留空:線上查詢會回 503,App 退回手動輸入。
- **更新**:`git pull` 後重跑同一行 `docker compose -f docker-compose.pi.yml up -d --build`。
- **改 `.env` 後**:`docker compose -f docker-compose.pi.yml up -d --force-recreate api`(env_file 只在建立容器時讀取)。
- **資料**:落在 Pi 上的 `./data/furlogic.db`(SQLite,bind mount `./data:/data`,不用 named volume)。**備份＝複製 `data/` 資料夾**(含 `furlogic.db-wal` / `-shm`;建議先 `docker compose -f docker-compose.pi.yml stop api` 再複製)。
- 查看紀錄:`docker logs -f furlogic-api`、`docker logs -f furlogic-web`。

### 對外存取（Cloudflare Tunnel）

Pi 上已有 Cloudflare Tunnel 容器 `bfx-cloudflared`(token 模式,路由在 Cloudflare Zero Trust 儀表板管理)。`docker-compose.pi.yml` 已讓 FurLogic 的 `web` 容器加入它所在的 network `bfx-multi_default`(`api` 不加入,只讓 nginx 對外)。若該 network 不存在(例如別台機器),compose 會直接報錯——本機開發請用 `docker-compose.yml`。

1. Zero Trust → Networks → Tunnels → 選該 tunnel → Public Hostname → Add。
2. Subdomain `furlogic`、網域 `yuzen.tw`(實際依自己的網域決定)。
3. Service:Type `HTTP`、URL `furlogic-web:888`。

> ⚠️ 加上公開網址後等於全網可連,而目前 App 沒有登入機制。**建議同時在 Zero Trust → Access → Applications 幫該 hostname 加 Access 政策**(例如只允許自己的 email)。

`ALLOWED_ORIGINS` 不必加公開網址:前端走同源 `/api`(由 nginx 反代到 api),瀏覽器不會對同源請求做 CORS 檢查。只有前端與 API 不同源(例如之後前端改放 Cloudflare Pages、`VITE_API_URL` 指向別的網域)時,才需要把前端網域加進 `ALLOWED_ORIGINS`。

Cloudflare Pages 前端之後再評估。

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

### 比例計算

```
熱量密度 = Σ (食材占比% ÷ 100) × (kcal/100g ÷ 100)(蔬菜不計熱量,水果照計)
每餐總重 = 單餐目標 ÷ 熱量密度
每項每餐克數 = 每餐總重 × 占比%
共買 = 每餐克數 × 餐數
```

各食材占比合計須為 100%(同類食材合計 = 類別占比)。

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

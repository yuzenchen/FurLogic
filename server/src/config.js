import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

/**
 * 本機開發用:若 repo 根目錄有 .env,載入到 process.env(不覆蓋既有變數)。
 * 需要 Node ≥ 20.12 的 process.loadEnvFile。
 */
export const loadDotEnv = (file = path.join(REPO_ROOT, '.env')) => {
  if (typeof process.loadEnvFile !== 'function') return false;
  if (!existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
};

const DEFAULT_ORIGINS = 'http://localhost:3000,http://localhost:8080';

const parsePort = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
};

const emptyToNull = (value) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** 金額上限(USD);非數字或負數時用預設值。 */
const parseUsd = (value, fallback) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const loadConfig = (env = process.env) => ({
  port: parsePort(env.PORT, 8787),
  host: emptyToNull(env.HOST) ?? '0.0.0.0',
  dataDir: path.resolve(process.cwd(), emptyToNull(env.DATA_DIR) ?? 'data'),
  allowedOrigins: (emptyToNull(env.ALLOWED_ORIGINS) ?? DEFAULT_ORIGINS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // AI 復盤 + 線上查詢食材營養(Anthropic)。金鑰只從 env 讀,
  // 未設定時 /api/ai/review 與 /api/foods/lookup 回 503 ai_unavailable。
  ai: {
    apiKey: emptyToNull(env.ANTHROPIC_API_KEY),
    model: emptyToNull(env.AI_MODEL) ?? 'claude-opus-5-5',
    dailyUsd: parseUsd(env.AI_DAILY_USD, 1),
    monthlyUsd: parseUsd(env.AI_MONTHLY_USD, 10),
  },
});

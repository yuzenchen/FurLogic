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

export const loadConfig = (env = process.env) => ({
  port: parsePort(env.PORT, 8787),
  host: emptyToNull(env.HOST) ?? '0.0.0.0',
  dataDir: path.resolve(process.cwd(), emptyToNull(env.DATA_DIR) ?? 'data'),
  allowedOrigins: (emptyToNull(env.ALLOWED_ORIGINS) ?? DEFAULT_ORIGINS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  geminiApiKey: emptyToNull(env.GEMINI_API_KEY),
  usdaApiKey: emptyToNull(env.USDA_API_KEY),
  geminiModel: emptyToNull(env.GEMINI_MODEL) ?? 'gemini-2.5-flash',
});

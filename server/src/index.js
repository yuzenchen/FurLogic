import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from './app.js';
import { loadConfig, loadDotEnv } from './config.js';

loadDotEnv();
const config = loadConfig();
mkdirSync(config.dataDir, { recursive: true });

const app = await buildApp({
  dbPath: path.join(config.dataDir, 'furlogic.db'),
  config,
  logger: { level: process.env.LOG_LEVEL || 'info' },
});

let closing = false;
const shutdown = async (signal) => {
  if (closing) return;
  closing = true;
  app.log.info(`${signal} received, shutting down`);
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'error during shutdown');
    process.exit(1);
  }
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  await app.close();
  process.exit(1);
}

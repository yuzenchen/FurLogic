import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { loadConfig } from './config.js';
import { openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import aiRoutes from './routes/ai.js';
import foodRoutes from './routes/foods.js';
import healthRoutes from './routes/health.js';
import importRoutes from './routes/import.js';
import lookupRoutes from './routes/lookup.js';
import petRoutes from './routes/pets.js';

const API_ROUTES = [
  healthRoutes,
  petRoutes,
  foodRoutes,
  lookupRoutes, // POST /api/foods/lookup(限流 10 req/min/IP)
  importRoutes,
  aiRoutes, // GET /api/ai/status、POST /api/ai/review(限流 5 req/min/IP)
];

const CODE_BY_STATUS = {
  404: 'not_found',
  429: 'rate_limited',
};

/** 把任何錯誤轉成合約的 { error, message } 與狀態碼。 */
const toErrorResponse = (err) => {
  if (err.validation) {
    return {
      status: 400,
      body: { error: 'validation_error', message: err.message },
    };
  }
  if (err.errorCode) {
    return {
      status: err.statusCode,
      body: { error: err.errorCode, message: err.message },
    };
  }
  const status = err.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return {
      status,
      body: {
        error: CODE_BY_STATUS[status] ?? 'validation_error',
        message: err.message,
      },
    };
  }
  return {
    status: 500,
    body: { error: 'internal_error', message: 'Internal server error' },
  };
};

/**
 * 建立 Fastify app(尚未 listen)。
 * fetch / createAnthropicClient 可注入(測試用,避免打外部 API)。
 * @param {{ dbPath?: string, config?: object, logger?: boolean|object,
 *           fetch?: typeof fetch,
 *           createAnthropicClient?: (apiKey: string) => object }} opts
 */
export async function buildApp({
  dbPath = ':memory:',
  config = loadConfig(),
  logger = false,
  fetch = globalThis.fetch,
  createAnthropicClient,
} = {}) {
  const app = Fastify({
    logger,
    ajv: { customOptions: { removeAdditional: false } },
  });

  const db = openDatabase(dbPath);
  try {
    runMigrations(db);
    seedDatabase(db);
  } catch (err) {
    db.close();
    throw err;
  }
  app.decorate('db', db);
  app.decorate('config', config);
  app.addHook('onClose', async () => {
    db.close();
  });

  const allowed = new Set(config.allowedOrigins);
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // 只有明確設定 config.rateLimit 的 route 會被限流(lookup、ai/review)。
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (request, context) => ({
      statusCode: 429,
      errorCode: 'rate_limited',
      message: `Too many requests, retry in ${context.after}`,
    }),
  });

  app.setErrorHandler((err, request, reply) => {
    const { status, body } = toErrorResponse(err);
    if (status >= 500) request.log.error(err);
    reply.code(status).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'not_found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  await app.register(
    async (api) => {
      for (const routes of API_ROUTES) {
        await api.register(routes, { fetch, createAnthropicClient });
      }
    },
    { prefix: '/api' },
  );

  return app;
}

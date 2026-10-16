import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { loadConfig } from './config.js';
import { openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import foodRoutes from './routes/foods.js';
import healthRoutes from './routes/health.js';
import importRoutes from './routes/import.js';
import mealRoutes from './routes/meals.js';
import petRoutes from './routes/pets.js';
import statsRoutes from './routes/stats.js';

const API_ROUTES = [
  healthRoutes,
  petRoutes,
  foodRoutes,
  // lookupRoutes — POST /api/foods/lookup (later task): register here and opt
  // in to the rate limiter per route with `config: { rateLimit: { max: 10,
  // timeWindow: '1 minute' } }`; the lookup_cache table already exists.
  mealRoutes,
  statsRoutes,
  importRoutes,
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
 * @param {{ dbPath?: string, config?: object, logger?: boolean|object }} opts
 */
export async function buildApp({
  dbPath = ':memory:',
  config = loadConfig(),
  logger = false,
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

  // 只有明確設定 config.rateLimit 的 route 會被限流(lookup)。
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
      for (const routes of API_ROUTES) await api.register(routes);
    },
    { prefix: '/api' },
  );

  return app;
}

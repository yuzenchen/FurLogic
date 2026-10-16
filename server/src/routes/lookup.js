import { createNutritionLookup } from '../services/nutritionLookup.js';

const lookupBody = {
  type: 'object',
  additionalProperties: false,
  required: ['query'],
  properties: {
    query: { type: 'string', minLength: 1, maxLength: 50, pattern: '\\S' },
  },
};

/** POST /foods/lookup — 線上查營養草稿(不寫入 foods)。 */
export default async function lookupRoutes(app, opts) {
  const service = createNutritionLookup({
    db: app.db,
    config: app.config,
    fetch: opts.fetch ?? globalThis.fetch,
    log: app.log,
  });

  app.post(
    '/foods/lookup',
    {
      schema: { body: lookupBody },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request) => service.lookup(request.body.query),
  );
}

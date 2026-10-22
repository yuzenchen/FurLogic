import { createFoodLookup } from '../services/foodLookup.js';

const lookupBody = {
  type: 'object',
  additionalProperties: false,
  required: ['query'],
  properties: {
    query: { type: 'string', minLength: 1, maxLength: 50, pattern: '\\S' },
  },
};

/** POST /foods/lookup — 由 Claude 線上查營養草稿(不寫入 foods)。 */
export default async function lookupRoutes(app, opts) {
  const service = createFoodLookup({
    db: app.db,
    config: app.config,
    ...(opts.createAnthropicClient
      ? { createClient: opts.createAnthropicClient }
      : {}),
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

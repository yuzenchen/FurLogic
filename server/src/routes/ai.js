import { createAiReview } from '../services/aiReview.js';
import { nullableSubtype, petFields } from './schemas.js';

const nonNegative = { type: 'number', minimum: 0 };

const reviewItem = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'type',
    'subtype',
    'calories',
    'protein',
    'fat',
    'ca',
    'p',
    'pct',
    'gramsPerMeal',
  ],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 40 },
    type: { type: ['string', 'null'], maxLength: 20 },
    subtype: nullableSubtype,
    calories: nonNegative,
    protein: nonNegative,
    fat: nonNegative,
    ca: nonNegative,
    p: nonNegative,
    pct: { type: 'number', minimum: 0, maximum: 100 },
    gramsPerMeal: nonNegative,
  },
};

const appResult = {
  type: 'object',
  additionalProperties: false,
  required: [
    'totalGramsPerMeal',
    'perMealKcal',
    'protein',
    'fat',
    'ca',
    'p',
    'caPRatio',
    'capWarnings',
  ],
  properties: {
    totalGramsPerMeal: nonNegative,
    perMealKcal: nonNegative,
    protein: nonNegative,
    fat: nonNegative,
    ca: nonNegative,
    p: nonNegative,
    caPRatio: { type: ['number', 'null'], minimum: 0 },
    capWarnings: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', maxLength: 100 },
    },
  },
};

const reviewBody = {
  type: 'object',
  additionalProperties: false,
  required: [
    'pet',
    'mealTarget',
    'mealsCount',
    'mealsPerDay',
    'items',
    'appResult',
  ],
  properties: {
    pet: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'weight'],
      properties: { name: petFields.name, weight: petFields.weight },
    },
    mealTarget: { type: 'number', exclusiveMinimum: 0, maximum: 5000 },
    mealsCount: { type: 'integer', minimum: 1, maximum: 60 },
    mealsPerDay: { type: 'integer', minimum: 1, maximum: 4 },
    items: { type: 'array', minItems: 1, maxItems: 30, items: reviewItem },
    appResult,
  },
};

/** GET /ai/status、POST /ai/review — AI 復盤(Anthropic)。 */
export default async function aiRoutes(app, opts) {
  const service = createAiReview({
    db: app.db,
    config: app.config,
    ...(opts.createAnthropicClient
      ? { createClient: opts.createAnthropicClient }
      : {}),
    log: app.log,
  });

  app.get('/ai/status', { schema: {} }, async () => service.status());

  app.post(
    '/ai/review',
    {
      schema: { body: reviewBody },
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request) => service.review(request.body),
  );
}

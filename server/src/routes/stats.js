import { addDays, fillDailySeries, toDateKey } from '@furlogic/shared';
import { notFound, validationError } from '../errors.js';
import { dateKeySchema } from './schemas.js';

const dailyQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    petId: { type: 'integer', minimum: 1 },
    days: { type: 'integer', minimum: 1, maximum: 90, default: 7 },
    today: dateKeySchema,
  },
};

export default async function statsRoutes(app) {
  const { db } = app;
  const firstPet = db.prepare('SELECT id FROM pets ORDER BY id LIMIT 1');
  const petExists = db.prepare('SELECT 1 FROM pets WHERE id = ?');
  const daily = db.prepare(`
    SELECT date_key AS dateKey,
           SUM(total_calories) AS calories,
           COUNT(*) AS count
    FROM meals
    WHERE pet_id = ? AND date_key BETWEEN ? AND ?
    GROUP BY date_key
  `);

  app.get(
    '/stats/daily',
    { schema: { querystring: dailyQuery } },
    async (request) => {
      const { days } = request.query;
      let today;
      try {
        today = toDateKey(request.query.today ?? new Date());
      } catch {
        throw validationError('today must be a valid YYYY-MM-DD date');
      }

      let { petId } = request.query;
      if (petId === undefined) {
        petId = firstPet.get()?.id;
        if (petId === undefined) throw notFound('No pet found');
      } else if (!petExists.get(petId)) {
        throw notFound(`Pet ${petId} not found`);
      }

      const from = addDays(today, -(days - 1));
      return fillDailySeries(daily.all(petId, from, today), today, days);
    },
  );
}

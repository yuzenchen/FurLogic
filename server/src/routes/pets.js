import { PET_FIELD_TO_COLUMN, petFromRow, pickColumns } from '../db/mappers.js';
import { notFound } from '../errors.js';
import { idParams, petFields } from './schemas.js';

const updateBody = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ...petFields,
    mealsPerDay: { type: 'integer', minimum: 1, maximum: 4 },
  },
};

/**
 * 部分更新一隻寵物並回傳更新後的 row;id 不存在時回傳 null。
 * 供 pets 與 import 路由共用。
 */
export const updatePet = (db, id, body) => {
  const cols = pickColumns(body, PET_FIELD_TO_COLUMN);
  const keys = Object.keys(cols);
  if (keys.length > 0) {
    const sets = keys.map((c) => `${c} = @${c}`).join(', ');
    db.prepare(
      `UPDATE pets SET ${sets}, updated_at = @updated_at WHERE id = @id`,
    ).run({ ...cols, updated_at: new Date().toISOString(), id });
  }
  return db.prepare('SELECT * FROM pets WHERE id = ?').get(id) ?? null;
};

export default async function petRoutes(app) {
  const listPets = app.db.prepare('SELECT * FROM pets ORDER BY id');

  app.get('/pets', { schema: {} }, async () => listPets.all().map(petFromRow));

  app.put(
    '/pets/:id',
    { schema: { params: idParams, body: updateBody } },
    async (request) => {
      const row = updatePet(app.db, request.params.id, request.body);
      if (!row) throw notFound(`Pet ${request.params.id} not found`);
      return petFromRow(row);
    },
  );
}

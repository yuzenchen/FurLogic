import { petFromRow } from '../db/mappers.js';
import { notFound } from '../errors.js';
import { updatePet } from './pets.js';
import { petFields } from './schemas.js';

const importBody = {
  type: 'object',
  additionalProperties: false,
  required: ['petProfile'],
  properties: {
    petProfile: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'weight', 'isNeutered', 'activityLevel'],
      properties: petFields,
    },
  },
};

export default async function importRoutes(app) {
  const firstPet = app.db.prepare('SELECT id FROM pets ORDER BY id LIMIT 1');

  app.post(
    '/import/local-storage',
    { schema: { body: importBody } },
    async (request) => {
      const pet = firstPet.get();
      if (!pet) throw notFound('No pet to import into');
      return petFromRow(updatePet(app.db, pet.id, request.body.petProfile));
    },
  );
}

/** 多個 route 共用的 JSON schema 片段。 */

export const idParams = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'integer', minimum: 1 } },
};

export const DATE_KEY_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

export const dateKeySchema = { type: 'string', pattern: DATE_KEY_PATTERN };

export const ACTIVITY_LEVELS = ['low', 'normal', 'high'];

export const petFields = {
  name: { type: 'string', minLength: 1, maxLength: 30 },
  weight: { type: 'number', exclusiveMinimum: 0, maximum: 150 },
  isNeutered: { type: 'boolean' },
  activityLevel: { type: 'string', enum: ACTIVITY_LEVELS },
};

export const nullableString = (maxLength) => ({
  type: ['string', 'null'],
  maxLength,
});

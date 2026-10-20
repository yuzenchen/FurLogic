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

/** 食材子類(與 shared FOOD_SUBTYPES 一致);null = 無特殊子類。 */
export const FOOD_SUBTYPES = ['organ', 'fatty_fish'];

export const nullableSubtype = {
  type: ['string', 'null'],
  enum: [...FOOD_SUBTYPES, null],
};

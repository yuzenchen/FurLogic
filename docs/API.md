# FurLogic API contract (source of truth for server + client tasks)

All JSON is camelCase. Errors: `{ "error": "<code>", "message": "<human text>" }`.
Codes: validation_error (400), not_found (404), builtin_readonly (403), duplicate_name (409),
lookup_unavailable (503), lookup_not_found (404),
lookup_failed (502), rate_limited (429), internal_error (500).

## Shapes

Pet = { id, name, weight, isNeutered: bool, activityLevel: 'low'|'normal'|'high', mealsPerDay: 1..4, createdAt, updatedAt }
Food = { id, name, nameEn, type: 'protein'|'veg'|'fruit'|'starch'|'snack', recipeRole: 'protein'|'plant'|'excluded',
subtype: 'organ'|'fatty_fish'|null (內臟 / 高脂魚;計算器據此設定每餐上限), safety: 'safe'|'caution'|'toxic', warning, description, calories, protein, fat, ca, p,
source: 'builtin'|'usda'|'ai'|'manual', sourceRef, isBuiltin: bool, createdAt, updatedAt }
(nutrients are per 100 g raw)

## Endpoints

GET /api/health → { ok: true, db: 'ok' }
GET /api/pets → Pet[] (always ≥1: default Mochi/12kg/neutered/normal/2 meals auto-created)
PUT /api/pets/:id partial { name(1-30), weight(>0,≤150), isNeutered, activityLevel, mealsPerDay(1-4) } → Pet
GET /api/foods?q=&source= → Food[] (fresh DB: 45 builtin foods); q = case-insensitive substring of name or nameEn;
source ∈ builtin|usda|ai|manual|custom (custom = all non-builtin).
Order: builtin first by id, then custom by name.
POST /api/foods { name(1-40), nameEn?, type, recipeRole, subtype? ∈ organ|fatty_fish|null (default null), safety?='safe', warning?, description?,
calories, protein, fat, ca, p (all ≥0, calories >0), source ∈ usda|ai|manual, sourceRef? } → 201 Food
PUT /api/foods/:id same fields (partial) → Food; builtin → 403 builtin_readonly
DELETE /api/foods/:id → 204; builtin → 403 builtin_readonly
POST /api/foods/lookup { query(1-50) } → 200 { draft: Food-like without id/timestamps/isBuiltin, confidence: 'high'|'low', cached: bool }
(does NOT write foods). 503 lookup_unavailable when no keys. 10 req/min/IP.
POST /api/import/local-storage { petProfile: { name, weight, isNeutered, activityLevel } } → Pet (updates the first pet)

## Retained but unused tables

The `meals` and `meal_items` tables (from earlier migrations) are kept so existing data is not lost,
but no endpoint reads or writes them. Meal logging was replaced by a client-side batch portioning
calculator that saves nothing.

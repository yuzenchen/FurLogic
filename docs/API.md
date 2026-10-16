# FurLogic API contract (source of truth for server + client tasks)

All JSON is camelCase. Errors: `{ "error": "<code>", "message": "<human text>" }`.
Codes: validation_error (400), not_found (404), builtin_readonly (403), duplicate_name (409),
toxic_food (422), empty_meal (422), lookup_unavailable (503), lookup_not_found (404),
lookup_failed (502), rate_limited (429), internal_error (500).

## Shapes
Pet  = { id, name, weight, isNeutered: bool, activityLevel: 'low'|'normal'|'high', mealsPerDay: 1..4, createdAt, updatedAt }
Food = { id, name, nameEn, type: 'protein'|'veg'|'fruit'|'starch'|'snack', recipeRole: 'protein'|'plant'|'excluded',
         safety: 'safe'|'caution'|'toxic', warning, description, calories, protein, fat, ca, p,
         source: 'builtin'|'usda'|'ai'|'manual', sourceRef, isBuiltin: bool, createdAt, updatedAt }
         (nutrients are per 100 g raw)
MealItem = { id, foodId|null, name, recipeRole, calories, protein, fat, ca, p, grams }   (per-100g snapshot + grams)
Meal = { id, petId, dateKey: 'YYYY-MM-DD', eatenAt: ISO-with-offset, label: 'breakfast'|'lunch'|'dinner'|'snack', note,
         totals: { calories, protein, fat, ca, p, grams }, items: MealItem[], createdAt }

## Endpoints
GET    /api/health                       → { ok: true, db: 'ok' }
GET    /api/pets                         → Pet[]  (always ≥1: default Mochi/12kg/neutered/normal/2 meals auto-created)
PUT    /api/pets/:id   partial { name(1-30), weight(>0,≤150), isNeutered, activityLevel, mealsPerDay(1-4) } → Pet
GET    /api/foods?q=&source=             → Food[]; q = case-insensitive substring of name or nameEn;
                                           source ∈ builtin|usda|ai|manual|custom (custom = all non-builtin).
                                           Order: builtin first by id, then custom by name.
POST   /api/foods      { name(1-40), nameEn?, type, recipeRole, safety?='safe', warning?, description?,
                         calories, protein, fat, ca, p (all ≥0, calories >0), source ∈ usda|ai|manual, sourceRef? } → 201 Food
PUT    /api/foods/:id  same fields (partial) → Food; builtin → 403 builtin_readonly
DELETE /api/foods/:id  → 204; builtin → 403 builtin_readonly
POST   /api/foods/lookup { query(1-50) } → 200 { draft: Food-like without id/timestamps/isBuiltin, confidence: 'high'|'low', cached: bool }
                                           (does NOT write foods). 503 lookup_unavailable when no keys. 10 req/min/IP.
GET    /api/meals?petId=&from=&to=       → Meal[] (from/to are dateKeys, inclusive, optional) newest eatenAt first
POST   /api/meals { petId, label, eatenAt?(ISO with offset; default now), note?(≤200),
                    items: [{ foodId?, name, recipeRole, calories, protein, fat, ca, p, grams }] (1-50) } → 201 Meal
         - items with grams ≤ 0 dropped; none left → 422 empty_meal
         - foodId given & that food is toxic → 422 toxic_food; foodId unknown → stored as null
         - totals recomputed server-side with shared computeMealTotals; dateKey = shared toDateKey(eatenAt)
DELETE /api/meals/:id → 204
GET    /api/stats/daily?petId=&days=7&today=YYYY-MM-DD → [{ dateKey, calories, count }] ascending, length = days (1-90),
         zero-filled; `today` defaults to server-local date (TZ env)
POST   /api/import/local-storage { petProfile: { name, weight, isNeutered, activityLevel } } → Pet (updates the first pet)

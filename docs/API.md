# FurLogic API contract (source of truth for server + client tasks)

All JSON is camelCase. Errors: `{ "error": "<code>", "message": "<human text>" }`.
Codes: validation_error (400), not_found (404), builtin_readonly (403), duplicate_name (409),
lookup_unavailable (503), lookup_not_found (404),
lookup_failed (502), rate_limited (429), internal_error (500),
ai_unavailable (503), ai_quota_exceeded (429), ai_failed (502).

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
GET /api/ai/status → { configured: bool, model, dailyUsd, dailyLimitUsd, monthlyUsd, monthlyLimitUsd } (USD, 4 decimals;
day / month boundaries in Asia/Taipei)
POST /api/ai/review (AI 復盤; strict body, unknown fields → 400; 5 req/min/IP)
{ pet: { name(1-30), weight(>0,≤150) }, mealTarget(>0,≤5000 kcal), mealsCount(int 1-60), mealsPerDay(int 1-4),
items: [1-30] { name(1-40), type: string|null, subtype: organ|fatty_fish|null, calories, protein, fat, ca, p (≥0, per 100 g raw),
pct(0-100, % of meal weight), gramsPerMeal(≥0) },
appResult: { totalGramsPerMeal, perMealKcal, protein, fat, ca, p (≥0; per meal g / g / mg / mg), caPRatio: number|null,
capWarnings: string[] (≤10, each ≤100) } }
→ 200 { review: { verdict: 'pass'|'warn'|'fail', summary (≤200 chars), checks: [{ label, expected, actual, ok: bool, note }] (1-12),
suggestions: string[] (0-5) }, model (the model that actually served), costUsd, usage: { dailyUsd, dailyLimitUsd, monthlyUsd, monthlyLimitUsd } }
Errors: 503 ai_unavailable (no ANTHROPIC_API_KEY), 429 ai_quota_exceeded (daily or monthly USD quota used up; message says which),
429 rate_limited, 502 ai_failed (Anthropic error / refusal / truncated or schema-invalid response).
Every response received from Anthropic (including refusal / invalid) is recorded in ai_usage with its cost.
POST /api/import/local-storage { petProfile: { name, weight, isNeutered, activityLevel } } → Pet (updates the first pet)

## Retained but unused tables

The `meals` and `meal_items` tables (from earlier migrations) are kept so existing data is not lost,
but no endpoint reads or writes them. Meal logging was replaced by a client-side batch portioning
calculator that saves nothing.

CREATE TABLE pets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  weight REAL NOT NULL,
  is_neutered INTEGER NOT NULL,
  activity_level TEXT NOT NULL CHECK (activity_level IN ('low', 'normal', 'high')),
  meals_per_day INTEGER NOT NULL DEFAULT 2 CHECK (meals_per_day BETWEEN 1 AND 4),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- AUTOINCREMENT + sqlite_sequence starting at 999: custom food ids start at
-- 1000; ids < 1000 are reserved for builtin foods (seeded with explicit ids,
-- which never advance the sequence while they stay below it).
CREATE TABLE foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  name_en TEXT,
  type TEXT,
  recipe_role TEXT,
  safety TEXT,
  warning TEXT,
  description TEXT,
  calories REAL,
  protein REAL,
  fat REAL,
  ca REAL,
  p REAL,
  source TEXT NOT NULL CHECK (source IN ('builtin', 'usda', 'ai', 'manual')),
  source_ref TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO sqlite_sequence (name, seq) VALUES ('foods', 999);

CREATE TABLE meals (
  id INTEGER PRIMARY KEY,
  pet_id INTEGER NOT NULL REFERENCES pets (id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  eaten_at TEXT NOT NULL,
  label TEXT NOT NULL,
  total_calories REAL,
  total_protein REAL,
  total_fat REAL,
  total_ca REAL,
  total_p REAL,
  total_grams REAL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE meal_items (
  id INTEGER PRIMARY KEY,
  meal_id INTEGER NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
  food_id INTEGER REFERENCES foods (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  recipe_role TEXT,
  calories REAL,
  protein REAL,
  fat REAL,
  ca REAL,
  p REAL,
  grams REAL NOT NULL
);

CREATE TABLE lookup_cache (
  query TEXT PRIMARY KEY,
  response_json TEXT NOT NULL,
  source TEXT,
  fetched_at TEXT
);

CREATE INDEX idx_meals_pet_date ON meals (pet_id, date_key);
CREATE INDEX idx_meal_items_meal ON meal_items (meal_id);
CREATE INDEX idx_meal_items_food ON meal_items (food_id);
CREATE INDEX idx_foods_name ON foods (name);

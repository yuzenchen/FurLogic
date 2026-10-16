import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);
const FILE_RE = /^(\d{3})_.+\.sql$/;

/**
 * 依序套用 migrations/NNN_*.sql,每個檔案一個 transaction。
 * @returns {number[]} 本次新套用的版本
 */
export const runMigrations = (db, dir = MIGRATIONS_DIR) => {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT
  )`);

  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((r) => r.version),
  );
  const record = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );

  const files = readdirSync(dir)
    .map((file) => ({ file, m: FILE_RE.exec(file) }))
    .filter(({ m }) => m)
    .map(({ file, m }) => ({ file, version: Number(m[1]) }))
    .sort((a, b) => a.version - b.version);

  const newlyApplied = [];
  for (const { file, version } of files) {
    if (applied.has(version)) continue;
    const sql = readFileSync(path.join(dir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      record.run(version, new Date().toISOString());
    })();
    newlyApplied.push(version);
  }
  return newlyApplied;
};

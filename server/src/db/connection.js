import Database from 'better-sqlite3';

/**
 * 開啟 SQLite 連線。檔案型 DB 使用 WAL;':memory:' 不支援 WAL 故略過。
 */
export const openDatabase = (dbPath) => {
  const db = new Database(dbPath);
  if (dbPath !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
};

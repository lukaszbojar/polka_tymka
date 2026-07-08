import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(__dirname, "..", "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "polka-tymka.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    series TEXT,
    series_index INTEGER,
    arc TEXT,
    year INTEGER NOT NULL,
    genres TEXT NOT NULL,
    cover_url TEXT,
    summary TEXT,
    source TEXT,
    raw_json TEXT
  );

  CREATE TABLE IF NOT EXISTS shelf (
    book_id TEXT PRIMARY KEY REFERENCES books(id),
    status TEXT NOT NULL DEFAULT 'read',
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS search_cache (
    query TEXT PRIMARY KEY,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

import { createClient, type InArgs } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

const url = process.env.TURSO_DATABASE_URL ?? `file:${path.join(__dirname, "..", "..", "data", "polka-tymka.db")}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (url.startsWith("file:")) {
  fs.mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
}

const client = createClient({ url, authToken });

// Cienka async nakładka na @libsql/client naśladująca API better-sqlite3
// (prepare().get/all/run) — dzięki temu warstwa repozytoriów zmienia się
// tylko o `await`, bez przepisywania każdego zapytania.
function toArgs(params: unknown[]): InArgs {
  if (params.length === 1 && params[0] !== null && typeof params[0] === "object" && !Array.isArray(params[0])) {
    return params[0] as InArgs;
  }
  return params as InArgs;
}

function prepare(sql: string) {
  return {
    async get(...params: unknown[]) {
      const rs = await client.execute({ sql, args: toArgs(params) });
      return rs.rows[0] as unknown;
    },
    async all(...params: unknown[]) {
      const rs = await client.execute({ sql, args: toArgs(params) });
      return rs.rows as unknown[];
    },
    async run(...params: unknown[]) {
      const rs = await client.execute({ sql, args: toArgs(params) });
      return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
    },
  };
}

export const db = { prepare };

let schemaReady: Promise<void> | null = null;

// Wywoływane raz na "zimny start" (proces serverless lub lokalny dev) —
// kolejne wywołania w tym samym procesie czekają na tę samą obietnicę.
export function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = initSchema();
  return schemaReady;
}

async function initSchema(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS books (
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
    )`,
    `CREATE TABLE IF NOT EXISTS shelf (
      book_id TEXT PRIMARY KEY REFERENCES books(id),
      status TEXT NOT NULL DEFAULT 'read',
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS search_cache (
      query TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS series_summaries (
      series TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ];
  for (const sql of statements) await client.execute(sql);
}

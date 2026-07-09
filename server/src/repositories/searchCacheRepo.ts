import { db } from "../db";
import type { SearchResult } from "../services/searchBooks";

const TTL_DAYS = 30;

export function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function getCachedSearch(query: string): Promise<SearchResult | null> {
  const row = (await db
    .prepare(
      `SELECT result_json FROM search_cache
       WHERE query = ? AND created_at >= datetime('now', '-${TTL_DAYS} days')`
    )
    .get(normalizeQuery(query))) as { result_json: string } | undefined;
  return row ? (JSON.parse(row.result_json) as SearchResult) : null;
}

export async function setCachedSearch(query: string, result: SearchResult): Promise<void> {
  await db
    .prepare(
      `INSERT INTO search_cache (query, result_json, created_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(query) DO UPDATE SET result_json = excluded.result_json, created_at = excluded.created_at`
    )
    .run(normalizeQuery(query), JSON.stringify(result));
}

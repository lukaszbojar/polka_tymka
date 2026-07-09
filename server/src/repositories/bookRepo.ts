import { db } from "../db";

export type ShelfStatus = "read" | "want" | "not_interested";

interface BookRow {
  id: string;
  title: string;
  author: string;
  series: string | null;
  series_index: number | null;
  arc: string | null;
  year: number;
  genres: string;
  cover_url: string | null;
  summary: string | null;
  status?: string;
}

export interface ShelfBook {
  id: string;
  title: string;
  author: string;
  series: string | null;
  arc: string | null;
  seriesIndex: number;
  year: number;
  genres: string[];
  coverUrl: string | null;
  summary: string | null;
  status: string;
}

function mapRow(row: BookRow): ShelfBook {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    series: row.series,
    arc: row.arc,
    seriesIndex: row.series_index ?? 0,
    year: row.year,
    genres: JSON.parse(row.genres),
    coverUrl: row.cover_url,
    summary: row.summary,
    status: row.status ?? "read",
  };
}

export async function listShelf(status?: ShelfStatus): Promise<ShelfBook[]> {
  const rows = status
    ? ((await db
        .prepare(
          `SELECT b.*, s.status FROM books b
           JOIN shelf s ON s.book_id = b.id
           WHERE s.status = ?
           ORDER BY b.series, b.series_index`
        )
        .all(status)) as BookRow[])
    : ((await db
        .prepare(
          `SELECT b.*, s.status FROM books b
           JOIN shelf s ON s.book_id = b.id
           ORDER BY b.series, b.series_index`
        )
        .all()) as BookRow[]);
  return rows.map(mapRow);
}

export async function bookExists(id: string): Promise<boolean> {
  return !!(await db.prepare("SELECT 1 FROM books WHERE id = ?").get(id));
}

const upsertShelfStatus = db.prepare(
  `INSERT INTO shelf (book_id, status) VALUES (?, ?)
   ON CONFLICT(book_id) DO UPDATE SET status = excluded.status`
);

export async function addToShelf(bookId: string, status: ShelfStatus = "read"): Promise<boolean> {
  if (!(await bookExists(bookId))) return false;
  await upsertShelfStatus.run(bookId, status);
  return true;
}

export async function addSeriesToShelf(series: string, status: ShelfStatus = "read"): Promise<number> {
  const ids = (await db.prepare("SELECT id FROM books WHERE series = ?").all(series)) as {
    id: string;
  }[];
  for (const row of ids) await upsertShelfStatus.run(row.id, status);
  return ids.length;
}

export async function removeFromShelf(bookId: string): Promise<void> {
  await db.prepare("DELETE FROM shelf WHERE book_id = ?").run(bookId);
}

export interface NewBook {
  id: string;
  title: string;
  author: string;
  series: string | null;
  seriesIndex: number;
  arc: string | null;
  year: number;
  genres: string[];
  coverUrl: string | null;
  source: string;
  rawJson: string | null;
}

// Zapisuje książkę znalezioną przez wyszukiwanie (Claude + Google Books) w cache'u.
// Jeśli już istnieje (to samo id z Google Books), zostawia istniejący wpis bez zmian.
export async function upsertBook(book: NewBook): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO books
      (id, title, author, series, series_index, arc, year, genres, cover_url, source, raw_json)
     VALUES (@id, @title, @author, @series, @seriesIndex, @arc, @year, @genres, @coverUrl, @source, @rawJson)`
    )
    .run({ ...book, genres: JSON.stringify(book.genres) });
}

// Mapa id -> status ('read'/'want') dla podanych książek, do oznaczania
// przycisków dodawania w wynikach wyszukiwania/rekomendacji.
export async function getShelfStatuses(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await db
    .prepare(`SELECT book_id, status FROM shelf WHERE book_id IN (${placeholders})`)
    .all(...ids)) as { book_id: string; status: string }[];
  return new Map(rows.map((r) => [r.book_id, r.status]));
}

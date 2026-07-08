import { db } from "../db";

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
  };
}

export function listShelf(): ShelfBook[] {
  const rows = db
    .prepare(
      `SELECT b.* FROM books b
       JOIN shelf s ON s.book_id = b.id
       ORDER BY b.series, b.series_index`
    )
    .all() as BookRow[];
  return rows.map(mapRow);
}

export function bookExists(id: string): boolean {
  return !!db.prepare("SELECT 1 FROM books WHERE id = ?").get(id);
}

export function addToShelf(bookId: string): boolean {
  if (!bookExists(bookId)) return false;
  db.prepare("INSERT OR IGNORE INTO shelf (book_id, status) VALUES (?, 'read')").run(bookId);
  return true;
}

export function addSeriesToShelf(series: string): number {
  const ids = db.prepare("SELECT id FROM books WHERE series = ?").all(series) as {
    id: string;
  }[];
  const insert = db.prepare("INSERT OR IGNORE INTO shelf (book_id, status) VALUES (?, 'read')");
  const tx = db.transaction((rows: { id: string }[]) => {
    for (const row of rows) insert.run(row.id);
  });
  tx(ids);
  return ids.length;
}

export function removeFromShelf(bookId: string): void {
  db.prepare("DELETE FROM shelf WHERE book_id = ?").run(bookId);
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
export function upsertBook(book: NewBook): void {
  db.prepare(
    `INSERT OR IGNORE INTO books
      (id, title, author, series, series_index, arc, year, genres, cover_url, source, raw_json)
     VALUES (@id, @title, @author, @series, @seriesIndex, @arc, @year, @genres, @coverUrl, @source, @rawJson)`
  ).run({ ...book, genres: JSON.stringify(book.genres) });
}

export function getOnShelfIds(ids: string[]): Set<string> {
  if (!ids.length) return new Set();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT book_id FROM shelf WHERE book_id IN (${placeholders})`)
    .all(...ids) as { book_id: string }[];
  return new Set(rows.map((r) => r.book_id));
}

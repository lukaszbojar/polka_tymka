import type { Book } from "../types/book";

export interface ShelfGroup {
  key: string;
  seriesName: string | null;
  author: string;
  books: Book[];
}

// Grupuje książki po serii (zachowując porządek chronologiczny wewnątrz),
// osobne pozycje trafiają do własnej grupy — odwzorowuje logikę z prototypu.
export function groupBooksForShelf(books: Book[]): ShelfGroup[] {
  const sorted = [...books].sort(
    (a, b) =>
      (a.series ?? a.title).localeCompare(b.series ?? b.title) ||
      a.seriesIndex - b.seriesIndex
  );

  const groups: ShelfGroup[] = [];
  const bySeries = new Map<string, ShelfGroup>();

  for (const book of sorted) {
    const key = book.series ?? `__${book.id}`;
    let group = bySeries.get(key);
    if (!group) {
      group = { key, seriesName: book.series, author: book.author, books: [] };
      bySeries.set(key, group);
      groups.push(group);
    }
    group.books.push(book);
  }

  for (const group of groups) {
    group.books.sort((a, b) => a.seriesIndex - b.seriesIndex);
  }

  return groups;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

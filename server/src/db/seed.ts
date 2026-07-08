import { db } from "./index";
import { seedCatalog } from "../data/seedCatalog";

// Zasila pustą bazę danymi startowymi z prototypu — jednorazowo, dopóki nie
// podłączymy prawdziwego wyszukiwania (Google Books + Claude) w kolejnych krokach.
export function seedIfEmpty(): void {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM books").get() as {
    count: number;
  };
  if (count > 0) return;

  const insertBook = db.prepare(`
    INSERT INTO books (id, title, author, series, series_index, arc, year, genres, source)
    VALUES (@id, @title, @author, @series, @seriesIndex, @arc, @year, @genres, @source)
  `);
  const insertShelf = db.prepare(
    "INSERT INTO shelf (book_id, status) VALUES (?, 'read')"
  );

  const seed = db.transaction(() => {
    for (const book of seedCatalog) {
      insertBook.run({
        id: book.id,
        title: book.title,
        author: book.author,
        series: book.series,
        seriesIndex: book.seriesIndex,
        arc: book.arc,
        year: book.year,
        genres: JSON.stringify(book.genres),
        source: "seed",
      });
      if (book.onShelf) insertShelf.run(book.id);
    }
  });
  seed();
}

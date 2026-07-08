import type { Book } from "../types/book";
import type { ShelfFilter } from "../types/filter";
import { chunk, groupBooksForShelf } from "../lib/shelfGrouping";
import { BookCard } from "./BookCard";

const BOOKS_PER_PLANK = 5;

export function Bookcase({
  books,
  onRemove,
  filter,
  onFilterChange,
}: {
  books: Book[];
  onRemove: (bookId: string) => void;
  filter: ShelfFilter | null;
  onFilterChange: (filter: ShelfFilter | null) => void;
}) {
  const filtered = filter
    ? books.filter((b) =>
        filter.type === "author" ? b.author === filter.value : b.genres.includes(filter.value)
      )
    : books;

  const banner = filter && (
    <div className="filter-banner">
      <span>
        Filtr: <strong>{filter.value}</strong> — {filtered.length} książek
      </span>
      <button onClick={() => onFilterChange(null)}>pokaż wszystkie</button>
    </div>
  );

  if (!filtered.length) {
    return (
      <main className="stage">
        <div className="stage-inner">
          {banner}
          <div className="empty">
            {books.length ? "Brak książek dla tego filtra." : "Półka jest jeszcze pusta."}
          </div>
        </div>
      </main>
    );
  }

  const groups = groupBooksForShelf(filtered);

  return (
    <main className="stage">
      <div className="stage-inner">
        {banner}
        {groups.map((group) => (
          <div className="shelf" key={group.key}>
            <p className="shelf-title">
              {group.seriesName ?? group.books[0].title}{" "}
              <span className="sub">
                {group.author} · {group.books.length} tomów
              </span>
            </p>
            {chunk(group.books, BOOKS_PER_PLANK).map((row, i) => (
              <div key={i}>
                <div className="books">
                  {row.map((book) => (
                    <BookCard key={book.id} book={book} onRemove={onRemove} />
                  ))}
                </div>
                <div className="plank" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

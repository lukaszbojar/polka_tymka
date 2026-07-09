import type { Book } from "../types/book";
import type { ShelfFilter } from "../types/filter";

function countBy(books: Book[], pick: (b: Book) => string[] | string) {
  const counts = new Map<string, number>();
  for (const book of books) {
    const values = pick(book);
    for (const value of Array.isArray(values) ? values : [values]) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function Sidebar({
  books,
  filter,
  onFilterChange,
}: {
  books: Book[];
  filter: ShelfFilter | null;
  onFilterChange: (filter: ShelfFilter | null) => void;
}) {
  const seriesCount = new Set(books.filter((b) => b.series).map((b) => b.series)).size;
  const authors = countBy(books, (b) => b.author);
  const genres = countBy(books, (b) => b.genres);

  function toggleFilter(type: ShelfFilter["type"], value: string) {
    onFilterChange(filter && filter.type === type && filter.value === value ? null : { type, value });
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <p className="eyebrow">biblioteka przygód</p>
        <h1>Półka Tymka</h1>
      </div>

      <div className="stats-grid">
        <div className="stat">
          <div className="n">{books.length}</div>
          <div className="l">przeczytane</div>
        </div>
        <div className="stat">
          <div className="n">{seriesCount}</div>
          <div className="l">serie</div>
        </div>
        <div className="stat">
          <div className="n">{authors.length}</div>
          <div className="l">autorzy</div>
        </div>
        <div className="stat">
          <div className="n">{genres.length}</div>
          <div className="l">gatunki</div>
        </div>
      </div>

      {filter && (
        <button className="clear-filter" onClick={() => onFilterChange(null)}>
          Wyczyść filtr
        </button>
      )}

      <div className="facet">
        <h3>Autorzy</h3>
        <div className="facet-list">
          {authors.map(([author, count]) => (
            <div
              className={`facet-item${filter?.type === "author" && filter.value === author ? " active" : ""}`}
              key={author}
              onClick={() => toggleFilter("author", author)}
            >
              <span>{author}</span>
              <span className="cnt">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="facet">
        <h3>Gatunki</h3>
        <div className="facet-list">
          {genres.map(([genre, count]) => (
            <div
              className={`facet-item${filter?.type === "genre" && filter.value === genre ? " active" : ""}`}
              key={genre}
              onClick={() => toggleFilter("genre", genre)}
            >
              <span>{genre}</span>
              <span className="cnt">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

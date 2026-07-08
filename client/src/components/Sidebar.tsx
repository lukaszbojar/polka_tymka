import { useState } from "react";
import type { Book } from "../types/book";
import type { SearchResult } from "../types/searchResult";
import type { ShelfFilter } from "../types/filter";
import { addBookToShelf, addSeriesToShelf, searchBooks } from "../lib/api";
import { SearchResults } from "./SearchResults";

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
  onShelfChanged,
  filter,
  onFilterChange,
}: {
  books: Book[];
  onShelfChanged: () => void;
  filter: ShelfFilter | null;
  onFilterChange: (filter: ShelfFilter | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const seriesCount = new Set(books.filter((b) => b.series).map((b) => b.series)).size;
  const authors = countBy(books, (b) => b.author);
  const genres = countBy(books, (b) => b.genres);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchBooks(q);
      setResult(found);
    } catch (err) {
      setSearchError((err as Error).message);
      setResult(null);
    } finally {
      setSearching(false);
    }
  }

  function markOnShelf(bookIds: Set<string>) {
    setResult((current) =>
      current
        ? {
            ...current,
            books: current.books.map((b) =>
              bookIds.has(b.id) ? { ...b, onShelf: true } : b
            ),
          }
        : current
    );
  }

  async function handleAddBook(bookId: string) {
    try {
      await addBookToShelf(bookId);
      markOnShelf(new Set([bookId]));
      onShelfChanged();
    } catch (err) {
      setSearchError((err as Error).message);
    }
  }

  async function handleAddSeries(series: string) {
    try {
      await addSeriesToShelf(series);
      const ids = new Set(result?.books.map((b) => b.id) ?? []);
      markOnShelf(ids);
      onShelfChanged();
    } catch (err) {
      setSearchError((err as Error).message);
    }
  }

  function toggleFilter(type: ShelfFilter["type"], value: string) {
    onFilterChange(filter && filter.type === type && filter.value === value ? null : { type, value });
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <p className="eyebrow">biblioteka przygód</p>
        <h1>Półka Tymka</h1>
      </div>

      <div className="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Dodaj książkę lub serię…"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
        />
      </div>

      {searching && <p className="search-status">Szukam…</p>}
      {searchError && <p className="search-status search-status-error">{searchError}</p>}
      {result && !searching && <SearchResults result={result} onAddBook={handleAddBook} onAddSeries={handleAddSeries} />}

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

import { useState } from "react";
import type { SearchResult } from "../types/searchResult";
import type { ShelfStatus } from "../types/shelfStatus";
import { addBookToShelf, addSeriesToShelf, searchBooks } from "../lib/api";
import { LargeBookCard } from "../components/LargeBookCard";
import { SearchLoader } from "../components/SearchLoader";

export function SearchTab() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await searchBooks(q));
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function setBookStatus(bookId: string, status: ShelfStatus) {
    setResult((cur) =>
      cur
        ? { ...cur, books: cur.books.map((b) => (b.id === bookId ? { ...b, shelfStatus: status } : b)) }
        : cur
    );
  }

  async function handleAdd(bookId: string, status: ShelfStatus) {
    try {
      await addBookToShelf(bookId, status);
      setBookStatus(bookId, status);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleAddSeries(status: ShelfStatus) {
    if (!result?.seriesName) return;
    try {
      await addSeriesToShelf(result.seriesName, status);
      setResult((cur) =>
        cur ? { ...cur, books: cur.books.map((b) => ({ ...b, shelfStatus: status })) } : cur
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="fullpage-tab">
      <div className="fullpage-search-bar">
        <input
          type="text"
          placeholder="Wpisz tytuł lub serię, np. „Warrior Cats”…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          autoFocus
        />
        <button className="btn btn-large" onClick={runSearch} disabled={loading}>
          {loading ? "Szukam…" : "Szukaj"}
        </button>
      </div>

      {loading && <SearchLoader />}

      {!loading && error && <p className="search-status search-status-error">{error}</p>}

      {!loading && result && result.type === "series" && result.seriesName && (
        <div className="fullpage-series-header">
          <h2>{result.seriesName}</h2>
          <p>
            {result.author} · {result.books.length} tomów
          </p>
          <div className="large-card-actions">
            <button className="btn" onClick={() => handleAddSeries("read")}>
              + Cała seria do półki
            </button>
            <button className="btn btn-secondary" onClick={() => handleAddSeries("want")}>
              + Cała seria do przeczytania
            </button>
          </div>
        </div>
      )}

      {!loading && result && (
        <div className="large-card-grid">
          {result.books.map((b) => (
            <LargeBookCard
              key={b.id}
              title={b.title}
              author={b.author}
              year={b.year}
              series={b.series}
              coverUrl={b.coverUrl}
              shelfStatus={b.shelfStatus}
              onAddRead={() => handleAdd(b.id, "read")}
              onAddWant={() => handleAdd(b.id, "want")}
              onDismiss={() => handleAdd(b.id, "not_interested")}
            />
          ))}
        </div>
      )}

      {!result && !loading && (
        <p className="fullpage-hint">Wpisz nazwę książki lub serii i naciśnij Enter.</p>
      )}
    </div>
  );
}

import { useState } from "react";
import type { Recommendation } from "../types/recommendation";
import { addBookToShelf, fetchRecommendations } from "../lib/api";
import { LargeBookCard } from "../components/LargeBookCard";

export function RecommendTab() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, "read" | "want">>({});

  async function load(offset: number) {
    setLoading(true);
    setError(null);
    try {
      const { recommendations, hasMore: more } = await fetchRecommendations(offset, 5);
      setItems((prev) => (offset === 0 ? recommendations : [...prev, ...recommendations]));
      setHasMore(more);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setStarted(true);
    }
  }

  async function handleAdd(bookId: string, status: "read" | "want") {
    try {
      await addBookToShelf(bookId, status);
      setStatuses((prev) => ({ ...prev, [bookId]: status }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!started) {
    return (
      <div className="fullpage-tab fullpage-centered">
        <button className="btn btn-large" onClick={() => load(0)} disabled={loading}>
          {loading ? "Szukam…" : "Poleć mi coś do czytania!"}
        </button>
      </div>
    );
  }

  return (
    <div className="fullpage-tab">
      {error && <p className="search-status search-status-error">{error}</p>}
      {items.length === 0 && !loading && (
        <p className="fullpage-hint">
          Brak rekomendacji — dodaj kilka książek na półkę, żeby dostać propozycje.
        </p>
      )}
      <div className="large-card-grid">
        {items.map((item) => (
          <LargeBookCard
            key={item.id}
            title={item.title}
            author={item.author}
            year={item.year}
            series={item.series}
            coverUrl={item.coverUrl}
            shelfStatus={statuses[item.id] ?? null}
            onAddRead={() => handleAdd(item.id, "read")}
            onAddWant={() => handleAdd(item.id, "want")}
          >
            {item.summary && <p className="large-card-summary">{item.summary}</p>}
            {item.seriesSummary && (
              <p className="large-card-summary large-card-series-summary">
                <strong>O serii:</strong> {item.seriesSummary}
              </p>
            )}
          </LargeBookCard>
        ))}
      </div>
      {hasMore && (
        <button className="btn" onClick={() => load(items.length)} disabled={loading}>
          {loading ? "Ładuję…" : "Pokaż więcej"}
        </button>
      )}
    </div>
  );
}

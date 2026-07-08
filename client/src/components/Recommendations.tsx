import { useEffect, useState } from "react";
import type { Recommendation } from "../types/recommendation";
import { addBookToShelf, fetchRecommendations } from "../lib/api";
import { fallbackColor } from "../lib/fallbackColor";

export function Recommendations({ onShelfChanged }: { onShelfChanged: () => void }) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  async function load(offset: number) {
    setLoading(true);
    try {
      const { recommendations, hasMore: more } = await fetchRecommendations(offset, 5);
      setItems((prev) => (offset === 0 ? recommendations : [...prev, ...recommendations]));
      setHasMore(more);
    } catch {
      // Cichy fallback — brak rekomendacji nie powinien blokować reszty aplikacji.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(bookId: string) {
    try {
      await addBookToShelf(bookId);
      setAddedIds((prev) => new Set(prev).add(bookId));
      onShelfChanged();
    } catch {
      // pomijamy błąd pojedynczego dodania, użytkownik może spróbować ponownie
    }
  }

  if (!loading && items.length === 0) return null;

  return (
    <div className="facet">
      <h3>Poleca się</h3>
      <div className="reco-list">
        {items.map((item) => (
          <div className="reco-item" key={item.id}>
            <div
              className="reco-cover"
              style={{
                background: item.coverUrl ? undefined : fallbackColor(item.series ?? item.title),
              }}
            >
              {item.coverUrl && <img src={item.coverUrl} alt="" />}
            </div>
            <div className="reco-info">
              <div className="reco-title">{item.series ?? item.title}</div>
              <div className="reco-meta">
                {item.author} · {item.year}
              </div>
            </div>
            <button
              className="reco-add"
              disabled={addedIds.has(item.id)}
              onClick={() => handleAdd(item.id)}
            >
              {addedIds.has(item.id) ? "✓" : "+"}
            </button>
          </div>
        ))}
      </div>
      {hasMore && (
        <button className="clear-filter" onClick={() => load(items.length)} disabled={loading}>
          {loading ? "Ładuję…" : "Pokaż więcej"}
        </button>
      )}
    </div>
  );
}

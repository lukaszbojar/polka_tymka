import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Bookcase } from "../components/Bookcase";
import { fetchShelf, removeFromShelf } from "../lib/api";
import type { Book } from "../types/book";
import type { ShelfFilter } from "../types/filter";

export function ShelfTab() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ShelfFilter | null>(null);

  useEffect(() => {
    fetchShelf("read")
      .then(setBooks)
      .catch((err) => setError(err.message));
  }, []);

  async function handleRemove(bookId: string) {
    const previous = books;
    setBooks((current) => current?.filter((b) => b.id !== bookId) ?? current);
    try {
      await removeFromShelf(bookId);
    } catch (err) {
      setBooks(previous);
      setError((err as Error).message);
    }
  }

  if (error) {
    return <div className="empty">Nie udało się połączyć z serwerem: {error}</div>;
  }

  return (
    <div className="app">
      <Sidebar books={books ?? []} filter={filter} onFilterChange={setFilter} />
      <Bookcase books={books ?? []} onRemove={handleRemove} filter={filter} onFilterChange={setFilter} />
    </div>
  );
}

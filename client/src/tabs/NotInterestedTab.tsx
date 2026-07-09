import { useEffect, useState } from "react";
import { Bookcase } from "../components/Bookcase";
import { fetchShelf, removeFromShelf } from "../lib/api";
import type { Book } from "../types/book";

export function NotInterestedTab() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShelf("not_interested")
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

  return <Bookcase books={books ?? []} onRemove={handleRemove} filter={null} onFilterChange={() => {}} />;
}

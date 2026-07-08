import type { SearchResult, SearchResultBook } from "../types/searchResult";
import { fallbackColor } from "../lib/fallbackColor";

function Mini({
  book,
  onAdd,
}: {
  book: SearchResultBook;
  onAdd: (bookId: string) => void;
}) {
  const color = fallbackColor(book.series ?? book.title);
  return (
    <div className="mini" style={{ background: book.coverUrl ? undefined : color }}>
      {book.coverUrl ? (
        <img src={book.coverUrl} alt="" className="mini-img" />
      ) : (
        <div className="mt">{book.title}</div>
      )}
      <button
        className="add"
        disabled={book.onShelf}
        title={book.onShelf ? "Już na półce" : "Dodaj"}
        onClick={() => onAdd(book.id)}
      >
        {book.onShelf ? "✓" : "+"}
      </button>
    </div>
  );
}

export function SearchResults({
  result,
  onAddBook,
  onAddSeries,
}: {
  result: SearchResult;
  onAddBook: (bookId: string) => void;
  onAddSeries: (series: string) => void;
}) {
  if (!result.books.length) {
    return (
      <div className="rcard">
        <p className="meta">Nie znaleziono nic pasującego.</p>
      </div>
    );
  }

  if (result.type === "series" && result.seriesName) {
    const years =
      result.books[0].year === result.books[result.books.length - 1].year
        ? String(result.books[0].year)
        : `${result.books[0].year}–${result.books[result.books.length - 1].year}`;
    const allOnShelf = result.books.every((b) => b.onShelf);

    return (
      <div className="rcard">
        <div className="rcard-head">
          <div>
            <h4>{result.seriesName}</h4>
            <p className="meta">
              {result.author} · {years} · {result.books.length} tomów
            </p>
          </div>
          <button
            className="btn"
            disabled={allOnShelf}
            onClick={() => onAddSeries(result.seriesName!)}
          >
            {allOnShelf ? "na półce" : "+ seria"}
          </button>
        </div>
        <div className="mini-row">
          {result.books.map((b) => (
            <Mini key={b.id} book={b} onAdd={onAddBook} />
          ))}
        </div>
      </div>
    );
  }

  const book = result.books[0];
  return (
    <div className="rcard">
      <div className="rcard-head">
        <div>
          <h4>{book.title}</h4>
          <p className="meta">
            {book.author} · {book.year}
          </p>
        </div>
        <button className="btn" disabled={book.onShelf} onClick={() => onAddBook(book.id)}>
          {book.onShelf ? "na półce" : "+ dodaj"}
        </button>
      </div>
    </div>
  );
}

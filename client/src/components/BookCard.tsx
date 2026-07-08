import { useState } from "react";
import type { Book } from "../types/book";
import { fallbackColor } from "../lib/fallbackColor";

export function BookCard({
  book,
  onRemove,
}: {
  book: Book;
  onRemove: (bookId: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const color = fallbackColor(book.series ?? book.title);
  const showImage = book.coverUrl && !imgFailed;

  return (
    <div className="book" title={book.summary ?? undefined}>
      <div className="cover" style={{ background: color }}>
        <button className="rm" title="Usuń z półki" onClick={() => onRemove(book.id)}>
          &times;
        </button>
        {showImage && (
          <img
            src={book.coverUrl!}
            alt=""
            className="cover-img"
            onError={() => setImgFailed(true)}
          />
        )}
        {!showImage && (
          <>
            <div className="brandline">{book.series ?? ""}</div>
            <div className="title">{book.title}</div>
            <div className="foot">
              <span>tom {book.seriesIndex}</span>
              <span>{book.year}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

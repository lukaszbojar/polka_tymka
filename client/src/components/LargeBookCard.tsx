import type { ReactNode } from "react";
import type { ShelfStatus } from "../types/shelfStatus";
import { fallbackColor } from "../lib/fallbackColor";

export function LargeBookCard({
  title,
  author,
  year,
  series,
  coverUrl,
  shelfStatus,
  onAddRead,
  onAddWant,
  onDismiss,
  children,
}: {
  title: string;
  author: string;
  year: number;
  series: string | null;
  coverUrl: string | null;
  shelfStatus: ShelfStatus | null;
  onAddRead: () => void;
  onAddWant: () => void;
  onDismiss: () => void;
  children?: ReactNode;
}) {
  const color = fallbackColor(series ?? title);

  return (
    <div className="large-card">
      <div className="large-card-cover" style={{ background: coverUrl ? undefined : color }}>
        {coverUrl ? <img src={coverUrl} alt="" /> : <span className="large-card-fallback">{title}</span>}
      </div>
      <div className="large-card-body">
        <div className="large-card-title">{title}</div>
        <div className="large-card-meta">
          {author} · {year}
        </div>
        {children}
        <div className="large-card-actions">
          <button className="btn" disabled={shelfStatus === "read"} onClick={onAddRead}>
            {shelfStatus === "read" ? "Na półce ✓" : "+ Do półki"}
          </button>
          <button
            className="btn btn-secondary"
            disabled={shelfStatus === "want"}
            onClick={onAddWant}
          >
            {shelfStatus === "want" ? "Później ✓" : "+ Później"}
          </button>
          <button
            className="btn btn-muted"
            disabled={shelfStatus === "not_interested"}
            onClick={onDismiss}
          >
            {shelfStatus === "not_interested" ? "Odrzucona" : "Nie interesuje mnie"}
          </button>
        </div>
      </div>
    </div>
  );
}

import type { ShelfStatus } from "./shelfStatus";

export interface Book {
  id: string;
  title: string;
  author: string;
  series: string | null;
  arc: string | null;
  seriesIndex: number;
  year: number;
  genres: string[];
  coverUrl: string | null;
  summary: string | null;
  status: ShelfStatus;
}

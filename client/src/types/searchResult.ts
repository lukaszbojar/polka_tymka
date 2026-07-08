export interface SearchResultBook {
  id: string;
  title: string;
  author: string;
  series: string | null;
  arc: string | null;
  seriesIndex: number;
  year: number;
  genres: string[];
  coverUrl: string | null;
  onShelf: boolean;
}

export interface SearchResult {
  type: "series" | "book";
  seriesName: string | null;
  author: string;
  books: SearchResultBook[];
}

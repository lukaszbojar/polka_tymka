export interface Recommendation {
  id: string;
  title: string;
  author: string;
  series: string | null;
  year: number;
  coverUrl: string | null;
}

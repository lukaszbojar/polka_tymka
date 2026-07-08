import { fetchWithRetry } from "../lib/httpRetry";

const API_BASE = "https://www.googleapis.com/books/v1/volumes";

export interface GoogleBooksResult {
  volumeId: string;
  title: string;
  authors: string[];
  year: number | null;
  categories: string[];
  thumbnail: string | null;
  description: string | null;
}

interface GoogleVolumeItem {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    categories?: string[];
    description?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

export async function searchGoogleBooks(
  query: string,
  maxResults = 5
): Promise<GoogleBooksResult[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
    country: "PL",
  });
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const res = await fetchWithRetry(`${API_BASE}?${params}`);
  const data = (await res.json()) as { items?: GoogleVolumeItem[] };

  return (data.items ?? []).map((item) => {
    const info = item.volumeInfo ?? {};
    const yearMatch = info.publishedDate?.match(/^\d{4}/);
    const thumbnail = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;

    return {
      volumeId: item.id,
      title: info.title ?? "",
      authors: info.authors ?? [],
      year: yearMatch ? Number(yearMatch[0]) : null,
      categories: info.categories ?? [],
      thumbnail: thumbnail ? thumbnail.replace(/^http:/, "https:") : null,
      description: info.description ?? null,
    };
  });
}

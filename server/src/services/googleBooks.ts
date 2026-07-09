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
  language: string | null;
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
    language?: string;
  };
}

export async function searchGoogleBooks(
  query: string,
  maxResults = 5,
  langRestrict?: string
): Promise<GoogleBooksResult[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
    country: "PL",
  });
  if (langRestrict) {
    params.set("langRestrict", langRestrict);
  }
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const res = await fetchWithRetry(`${API_BASE}?${params}`);
  const data = (await res.json()) as { items?: GoogleVolumeItem[] };

  const results = (data.items ?? []).map((item) => {
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
      language: info.language ?? null,
    };
  });

  // langRestrict jest w Google Books API tylko luźną wskazówką, nie twardym
  // filtrem — API i tak potrafi zwrócić wyniki w innym języku, więc filtrujemy
  // to jeszcze raz po naszej stronie.
  return langRestrict ? results.filter((r) => r.language === langRestrict) : results;
}

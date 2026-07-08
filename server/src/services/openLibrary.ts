import { fetchWithRetry } from "../lib/httpRetry";

const SEARCH_BASE = "https://openlibrary.org/search.json";
const COVERS_BASE = "https://covers.openlibrary.org/b/id";
// Open Library prosi o identyfikację żądań (nazwa aplikacji + kontakt) w zamian
// za wyższy limit (3 zapytania/s zamiast 1/s).
const USER_AGENT = "PolkaTymka/1.0 (lukasz.bojar@gmail.com)";

export interface OpenLibraryResult {
  workKey: string;
  title: string;
  authors: string[];
  year: number | null;
  coverUrl: string | null;
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
}

// Szuka polskich wydań (language:pol) — Open Library ma zwykle lepsze pokrycie
// polskich tłumaczeń książek dziecięcych niż Google Books.
export async function searchOpenLibraryPolish(
  title: string,
  author: string,
  maxResults = 10
): Promise<OpenLibraryResult[]> {
  const params = new URLSearchParams({
    q: `${title} ${author} language:pol`,
    fields: "key,title,author_name,first_publish_year,cover_i,language",
    limit: String(maxResults),
  });

  const res = await fetchWithRetry(`${SEARCH_BASE}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  const data = (await res.json()) as { docs?: OpenLibraryDoc[] };

  return (data.docs ?? [])
    .filter((d) => d.title && d.language?.includes("pol"))
    .map((d) => ({
      workKey: d.key ?? "",
      title: d.title!,
      authors: d.author_name ?? [],
      year: d.first_publish_year ?? null,
      coverUrl: d.cover_i ? `${COVERS_BASE}/${d.cover_i}-L.jpg` : null,
    }));
}

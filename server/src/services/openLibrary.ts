import { fetchWithRetry } from "../lib/httpRetry";
import { titlesMatch } from "../lib/text";

const SEARCH_BASE = "https://openlibrary.org/search.json";
const WORKS_BASE = "https://openlibrary.org/works";
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

interface OpenLibraryEdition {
  key: string;
  title?: string;
  languages?: { key: string }[];
  covers?: number[];
}

// Wydania obcojęzycznych książek bywają w Open Library skatalogowane na
// jeden z dwóch sposobów: (A) jako osobne, NIEPOWIĄZANE "dzieło" tylko dla
// polskiego wydania — wtedy zapytanie polskim tytułem + filtr language:pol
// trafia je bezpośrednio i tanio (1 zapytanie); (B) jako WYDANIE zagnieżdżone
// pod wspólnym "dziełem" obcojęzycznego oryginału — wtedy trzeba znaleźć to
// dzieło (po tytule oryginalnym) i dopiero przejrzeć jego listę wydań, bo
// pole language na poziomie samego dzieła jest zawodnym agregatem. Próbujemy
// najpierw (A), bo jest tańsze, a dopiero gdy nic nie znajdzie — (B).
async function searchDirectPolish(title: string, author: string, maxResults: number): Promise<OpenLibraryResult[]> {
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
    .filter((d) => d.title && d.key && d.language?.includes("pol") && titlesMatch(d.title, title))
    .map((d) => ({
      workKey: d.key!,
      title: d.title!,
      authors: d.author_name ?? [],
      year: d.first_publish_year ?? null,
      coverUrl: d.cover_i ? `${COVERS_BASE}/${d.cover_i}-L.jpg` : null,
    }));
}

async function searchOpenLibraryWorks(title: string, author: string, maxResults: number): Promise<OpenLibraryDoc[]> {
  const params = new URLSearchParams({
    q: `${title} ${author}`,
    fields: "key,title,author_name,first_publish_year",
    limit: String(maxResults),
  });
  const res = await fetchWithRetry(`${SEARCH_BASE}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  const data = (await res.json()) as { docs?: OpenLibraryDoc[] };
  return (data.docs ?? []).filter((d) => d.key && d.title);
}

async function findPolishEdition(workKey: string): Promise<{ title: string; coverUrl: string | null } | null> {
  const id = workKey.replace(/^\/works\//, "");
  const res = await fetchWithRetry(`${WORKS_BASE}/${id}/editions.json?limit=50`, {
    headers: { "User-Agent": USER_AGENT },
  });
  const data = (await res.json()) as { entries?: OpenLibraryEdition[] };
  const polish = (data.entries ?? []).find((e) => (e.languages ?? []).some((l) => l.key === "/languages/pol"));
  if (!polish || !polish.title) return null;

  const coverId = polish.covers?.find((c) => c > 0);
  return {
    title: polish.title,
    coverUrl: coverId ? `${COVERS_BASE}/${coverId}-L.jpg` : null,
  };
}

export async function searchOpenLibraryPolish(
  originalTitle: string,
  polishTitleGuess: string,
  author: string
): Promise<OpenLibraryResult[]> {
  const direct = await searchDirectPolish(polishTitleGuess, author, 3).catch(() => []);
  if (direct.length) return direct;

  const works = await searchOpenLibraryWorks(originalTitle, author, 2);
  const relevant = works.filter((w) => titlesMatch(w.title!, originalTitle));

  for (const work of relevant) {
    const polish = await findPolishEdition(work.key!);
    if (polish) {
      return [
        {
          workKey: work.key!,
          title: polish.title,
          authors: work.author_name ?? [],
          year: work.first_publish_year ?? null,
          coverUrl: polish.coverUrl,
        },
      ];
    }
  }
  return [];
}

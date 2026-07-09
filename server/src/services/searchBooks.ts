import { orderSeriesVolumes, recognizeQuery } from "./claude";
import { searchGoogleBooks, type GoogleBooksResult } from "./googleBooks";
import { searchOpenLibraryPolish } from "./openLibrary";
import { findByTitleAuthor, getShelfStatuses, upsertBook, type NewBook } from "../repositories/bookRepo";
import { getCachedSearch, setCachedSearch } from "../repositories/searchCacheRepo";
import { normalizeTitle, titlesMatch } from "../lib/text";
import { slugify } from "../lib/slug";

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
  shelfStatus: "read" | "want" | "not_interested" | null;
}

export interface SearchResult {
  type: "series" | "book";
  seriesName: string | null;
  author: string;
  books: SearchResultBook[];
}

// Wśród kandydatów pasujących do tytułu wybiera ten o najkrótszym, najbliższym
// dopasowaniu (odrzuca "poradniki"/"analizy książki", które są dłuższym
// tekstem zawierającym oryginalny tytuł jako podciąg), a wśród nich ten
// z najwyższym `preference` (np. polskie wydanie z okładką > okładka > nic).
// Generyczne — działa zarówno dla wyników Google Books, jak i Open Library.
function pickClosest<T>(
  items: T[],
  targetTitle: string,
  getTitle: (item: T) => string,
  getKey: (item: T) => string,
  preference: (item: T) => number,
  exclude: Set<string>
): T | null {
  const matches = items
    .filter((item) => !exclude.has(getKey(item)) && titlesMatch(getTitle(item), targetTitle))
    .map((item) => ({ item, len: normalizeTitle(getTitle(item)).length }))
    .sort((a, b) => a.len - b.len);

  if (!matches.length) return null;
  const minLen = matches[0].len;
  const closest = matches.filter((m) => m.len <= minLen + 10);
  closest.sort((a, b) => preference(b.item) - preference(a.item));
  return closest[0].item;
}

// Uruchamia `fn` dla wszystkich elementów z ograniczoną liczbą jednoczesnych
// wywołań — rozwiązywanie tomów serii sekwencyjnie (jeden po drugim) potrafiło
// dla dłuższych serii przekroczyć limit czasu funkcji serverless na Vercelu.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

interface ResolvedBook {
  id: string;
  title: string;
  author: string;
  year: number;
  genres: string[];
  coverUrl: string | null;
  source: string;
  rawJson: string | null;
}

const gbPreference = (c: GoogleBooksResult) =>
  (c.thumbnail ? 1 : 0) + (c.thumbnail && c.language === "pl" ? 1 : 0);

// Dopasowuje pulę kandydatów Google Books względem OBU wariantów tytułu
// (oryginalnego i polskiej zgadywanki) i wybiera lepszy wynik — bez tego
// dopasowywanie tylko po tytule oryginalnym premiowałoby angielskie wydania
// (łatwiej trafiają w dopasowanie tekstowe), nawet gdy w tej samej puli jest
// też polskie wydanie.
function bestGoogleMatch(
  items: GoogleBooksResult[],
  originalTitle: string,
  polishTitleGuess: string,
  exclude: Set<string>
): GoogleBooksResult | null {
  const byOriginal = pickClosest(items, originalTitle, (c) => c.title, (c) => c.volumeId, gbPreference, exclude);
  if (polishTitleGuess === originalTitle) return byOriginal;
  const byPolish = pickClosest(items, polishTitleGuess, (c) => c.title, (c) => c.volumeId, gbPreference, exclude);
  if (byOriginal && byPolish) {
    return gbPreference(byPolish) >= gbPreference(byOriginal) ? byPolish : byOriginal;
  }
  return byPolish ?? byOriginal;
}

async function findOpenLibraryMatch(
  originalTitle: string,
  polishTitleGuess: string,
  fallbackAuthor: string,
  usedOpenLibraryKeys: Set<string>
) {
  // Open Library indeksuje wydania pod ich WŁASNYM tytułem — zapytanie
  // tekstem angielskim praktycznie nigdy nie znajdzie polskiego wydania (nie
  // ma powiązania między tytułami w różnych językach w ich wyszukiwarce), więc
  // pytamy głównie polską zgadywanką; do angielskiego tytułu wracamy tylko
  // gdy zgadywanka nic nie dała (jedno zapytanie, nie dwa — oszczędność czasu).
  const primaryTitle = polishTitleGuess;
  const olCandidates = await searchOpenLibraryPolish(primaryTitle, fallbackAuthor);
  const olPreference = (r: (typeof olCandidates)[number]) => (r.coverUrl ? 1 : 0);

  let olMatch = pickClosest(
    olCandidates,
    primaryTitle,
    (r) => r.title,
    (r) => r.workKey || r.title,
    olPreference,
    usedOpenLibraryKeys
  );
  if (olMatch || polishTitleGuess === originalTitle) return olMatch;

  const fallbackCandidates = await searchOpenLibraryPolish(originalTitle, fallbackAuthor).catch(
    () => [] as typeof olCandidates
  );
  return pickClosest(
    fallbackCandidates,
    originalTitle,
    (r) => r.title,
    (r) => r.workKey || r.title,
    olPreference,
    usedOpenLibraryKeys
  );
}

// Kolejność źródeł danych o książce: 1) Open Library — sprawdzane NAJPIERW,
// bo zwraca wyłącznie wydania polskie (language:pol), więc to ono decyduje,
// gdy Google Books ma tylko wydanie w innym języku; wyjątek: jeśli Google
// Books w puli kandydatów z zapytania o całą serię ma TEŻ polskie wydanie z
// okładką, nie warto już pytać Open Library (oszczędność zapytania). 2) Google
// Books (najpierw pula kandydatów, potem — jeśli brak trafienia — celowane
// zapytanie o ten jeden tom, próbowane RÓWNOLEGLE dla obu wariantów tytułu).
// 3) dopiero gdy obu brak — wiedza własna Claude (tytuł/rok/autor już
// ustalone wcześniej), bez okładki. Dopasowanie zawsze sprawdza zarówno tytuł
// oryginalny (bardziej wiarygodny niż zgadywanka Claude), jak i polską
// zgadywankę (żeby polskie wydanie wygrało, gdy istnieje w danej puli).
export async function resolveBookData(
  originalTitle: string,
  polishTitleGuess: string,
  fallbackAuthor: string,
  fallbackYear: number,
  googleCandidates: GoogleBooksResult[],
  usedGoogleIds: Set<string>,
  usedOpenLibraryKeys: Set<string>
): Promise<ResolvedBook> {
  const broadMatch = bestGoogleMatch(googleCandidates, originalTitle, polishTitleGuess, usedGoogleIds);
  const broadIsPolish = !!broadMatch?.thumbnail && broadMatch.language === "pl";

  if (!broadIsPolish) {
    try {
      const olMatch = await findOpenLibraryMatch(originalTitle, polishTitleGuess, fallbackAuthor, usedOpenLibraryKeys);
      if (olMatch) {
        usedOpenLibraryKeys.add(olMatch.workKey || olMatch.title);
        return {
          id: `openlibrary:${olMatch.workKey || slugify(olMatch.title)}`,
          title: olMatch.title,
          author: olMatch.authors[0] ?? fallbackAuthor,
          year: olMatch.year ?? fallbackYear,
          genres: [],
          coverUrl: olMatch.coverUrl,
          source: "openlibrary",
          rawJson: JSON.stringify(olMatch),
        };
      }
    } catch (err) {
      console.error(`Open Library nie odpowiedziało dla "${originalTitle}":`, (err as Error).message);
    }
  }

  let gbMatch = broadMatch;
  if (!gbMatch) {
    try {
      const queries =
        polishTitleGuess === originalTitle
          ? [searchGoogleBooks(`intitle:${originalTitle} inauthor:${fallbackAuthor}`, 10)]
          : [
              searchGoogleBooks(`intitle:${originalTitle} inauthor:${fallbackAuthor}`, 10),
              searchGoogleBooks(`intitle:${polishTitleGuess} inauthor:${fallbackAuthor}`, 10),
            ];
      const results = await Promise.all(queries.map((p) => p.catch(() => [] as GoogleBooksResult[])));
      const targeted = results.flat();
      gbMatch = bestGoogleMatch(targeted, originalTitle, polishTitleGuess, usedGoogleIds);
    } catch {
      // ignorujemy — nie ma już czego próbować, spadamy do zgadywanki Claude
    }
  }
  if (gbMatch) {
    usedGoogleIds.add(gbMatch.volumeId);
    return {
      id: `googlebooks:${gbMatch.volumeId}`,
      title: gbMatch.title,
      author: gbMatch.authors[0] ?? fallbackAuthor,
      year: gbMatch.year ?? fallbackYear,
      genres: gbMatch.categories,
      coverUrl: gbMatch.thumbnail,
      source: "googlebooks",
      rawJson: JSON.stringify(gbMatch),
    };
  }

  return {
    id: `claude:${slugify(polishTitleGuess)}-${slugify(fallbackAuthor)}`,
    title: polishTitleGuess,
    author: fallbackAuthor,
    year: fallbackYear,
    genres: [],
    coverUrl: null,
    source: "claude",
    rawJson: null,
  };
}

// Publiczne wejście: sprawdza cache (TTL 30 dni), w razie trafienia odświeża
// tylko status na półce (mógł się zmienić od czasu zapisania w cache'u).
export async function search(query: string): Promise<SearchResult> {
  const cached = await getCachedSearch(query);
  if (cached) {
    const statuses = await getShelfStatuses(cached.books.map((b) => b.id));
    return {
      ...cached,
      books: cached.books.map((b) => ({
        ...b,
        shelfStatus: (statuses.get(b.id) as "read" | "want" | "not_interested" | undefined) ?? null,
      })),
    };
  }

  const result = await performSearch(query);
  await setCachedSearch(query, result);
  return result;
}

async function performSearch(query: string): Promise<SearchResult> {
  const searchStart = Date.now();
  const recognized = await recognizeQuery(query);
  let candidates: GoogleBooksResult[] = [];
  try {
    candidates = await searchGoogleBooks(recognized.searchQuery, 40);
  } catch (err) {
    console.error("Google Books niedostępne, lecę dalej na Open Library:", (err as Error).message);
  }

  const newBooks: NewBook[] = [];
  const usedGoogleIds = new Set<string>();
  const usedOpenLibraryKeys = new Set<string>();

  if (recognized.type === "book") {
    const resolved = await resolveBookData(
      recognized.canonicalTitle,
      recognized.canonicalTitle,
      recognized.author,
      recognized.year,
      candidates,
      usedGoogleIds,
      usedOpenLibraryKeys
    );
    const id = (await findByTitleAuthor(resolved.title, resolved.author)) ?? resolved.id;
    newBooks.push({
      id,
      title: resolved.title,
      author: resolved.author,
      series: null,
      seriesIndex: 1,
      arc: null,
      year: resolved.year,
      genres: resolved.genres,
      coverUrl: resolved.coverUrl,
      source: resolved.source,
      rawJson: resolved.rawJson,
    });
  } else {
    const ordered = await orderSeriesVolumes(
      recognized.canonicalTitle,
      recognized.author,
      candidates.map((c) => ({ title: c.title, authors: c.authors, year: c.year }))
    );

    const resolvedVolumes = await mapWithConcurrency(ordered, 5, async (volume) => {
      const resolved = await resolveBookData(
        volume.originalTitle,
        volume.title,
        recognized.author,
        volume.year,
        candidates,
        usedGoogleIds,
        usedOpenLibraryKeys
      );
      const id = (await findByTitleAuthor(resolved.title, resolved.author)) ?? resolved.id;
      return { volume, resolved, id };
    });

    for (const { volume, resolved, id } of resolvedVolumes) {
      newBooks.push({
        id,
        title: resolved.title,
        author: resolved.author,
        series: recognized.canonicalTitle,
        seriesIndex: volume.seriesIndex,
        arc: volume.arc || null,
        year: resolved.year,
        genres: resolved.genres,
        coverUrl: resolved.coverUrl,
        source: resolved.source,
        rawJson: resolved.rawJson,
      });
    }
  }

  for (const book of newBooks) await upsertBook(book);

  const statuses = await getShelfStatuses(newBooks.map((b) => b.id));

  console.log(`Wyszukiwanie "${query}" zajęło ${Date.now() - searchStart}ms (${newBooks.length} książek)`);

  return {
    type: recognized.type,
    seriesName: recognized.type === "series" ? recognized.canonicalTitle : null,
    author: recognized.author,
    books: newBooks
      .sort((a, b) => a.seriesIndex - b.seriesIndex)
      .map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        series: b.series,
        arc: b.arc,
        seriesIndex: b.seriesIndex,
        year: b.year,
        genres: b.genres,
        coverUrl: b.coverUrl,
        shelfStatus: (statuses.get(b.id) as "read" | "want" | "not_interested" | undefined) ?? null,
      })),
  };
}

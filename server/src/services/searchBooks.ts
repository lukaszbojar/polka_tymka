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

// Kolejność źródeł danych o książce: 1) Google Books (najpierw w puli kandydatów
// z zapytania o całą serię, potem — jeśli brak trafienia — celowane zapytanie o
// ten jeden tom), 2) Open Library (lepsze pokrycie polskich wydań), 3) dopiero
// gdy obu brak — wiedza własna Claude (tytuł/rok/autor już ustalone wcześniej),
// bez okładki. Dopasowanie robimy po tytule ORYGINALNYM (dużo bardziej
// wiarygodny niż tytuł "po polsku" zgadnięty przez Claude z pamięci) — a gdy
// katalog faktycznie zna wydanie, jego własny tytuł (często polski) zastępuje
// zgadywankę Claude, więc nie polegamy na tłumaczeniu z pamięci.
export async function resolveBookData(
  originalTitle: string,
  polishTitleGuess: string,
  fallbackAuthor: string,
  fallbackYear: number,
  googleCandidates: GoogleBooksResult[],
  usedGoogleIds: Set<string>,
  usedOpenLibraryKeys: Set<string>
): Promise<ResolvedBook> {
  const preference = (c: GoogleBooksResult) =>
    (c.thumbnail ? 1 : 0) + (c.thumbnail && c.language === "pl" ? 1 : 0);

  let gbMatch = pickClosest(
    googleCandidates,
    originalTitle,
    (c) => c.title,
    (c) => c.volumeId,
    preference,
    usedGoogleIds
  );
  if (!gbMatch && polishTitleGuess !== originalTitle) {
    gbMatch = pickClosest(
      googleCandidates,
      polishTitleGuess,
      (c) => c.title,
      (c) => c.volumeId,
      preference,
      usedGoogleIds
    );
  }
  if (!gbMatch) {
    try {
      const targeted = await searchGoogleBooks(`intitle:${originalTitle} inauthor:${fallbackAuthor}`, 10);
      gbMatch = pickClosest(targeted, originalTitle, (c) => c.title, (c) => c.volumeId, preference, usedGoogleIds);
    } catch {
      // ignorujemy — spróbujemy jeszcze Open Library
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

  try {
    const olCandidates = await searchOpenLibraryPolish(originalTitle, fallbackAuthor);
    const olMatch = pickClosest(
      olCandidates,
      originalTitle,
      (r) => r.title,
      (r) => r.workKey || r.title,
      (r) => (r.coverUrl ? 1 : 0),
      usedOpenLibraryKeys
    );
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

    for (const volume of ordered) {
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

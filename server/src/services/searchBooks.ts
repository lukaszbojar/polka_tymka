import { orderSeriesVolumes, recognizeQuery } from "./claude";
import { searchGoogleBooks, type GoogleBooksResult } from "./googleBooks";
import { searchOpenLibraryPolish } from "./openLibrary";
import { getOnShelfIds, upsertBook, type NewBook } from "../repositories/bookRepo";
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
  onShelf: boolean;
}

export interface SearchResult {
  type: "series" | "book";
  seriesName: string | null;
  author: string;
  books: SearchResultBook[];
}

// Wśród kandydatów pasujących do tytułu wybiera ten o najkrótszym, najbliższym
// dopasowaniu (odrzuca "poradniki"/"analizy książki", które są dłuższym
// tekstem zawierającym oryginalny tytuł jako podciąg), preferując okładkę.
// Generyczne — działa zarówno dla wyników Google Books, jak i Open Library.
function pickClosest<T>(
  items: T[],
  targetTitle: string,
  getTitle: (item: T) => string,
  getKey: (item: T) => string,
  hasCover: (item: T) => boolean,
  exclude: Set<string>
): T | null {
  const matches = items
    .filter((item) => !exclude.has(getKey(item)) && titlesMatch(getTitle(item), targetTitle))
    .map((item) => ({ item, len: normalizeTitle(getTitle(item)).length }))
    .sort((a, b) => a.len - b.len);

  if (!matches.length) return null;
  const minLen = matches[0].len;
  const closest = matches.filter((m) => m.len <= minLen + 10);
  return (closest.find((m) => hasCover(m.item)) ?? closest[0]).item;
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

// Kolejność źródeł danych o książce: 1) Google Books, 2) Open Library (lepsze
// pokrycie polskich wydań), 3) dopiero gdy obu brak — wiedza własna Claude
// (tytuł/rok/autor już ustalone wcześniej), bez okładki.
async function resolveBookData(
  targetTitle: string,
  fallbackAuthor: string,
  fallbackYear: number,
  googleCandidates: GoogleBooksResult[],
  usedGoogleIds: Set<string>,
  usedOpenLibraryKeys: Set<string>
): Promise<ResolvedBook> {
  const gbMatch = pickClosest(
    googleCandidates,
    targetTitle,
    (c) => c.title,
    (c) => c.volumeId,
    (c) => !!c.thumbnail,
    usedGoogleIds
  );
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
    const olCandidates = await searchOpenLibraryPolish(targetTitle, fallbackAuthor);
    const olMatch = pickClosest(
      olCandidates,
      targetTitle,
      (r) => r.title,
      (r) => r.workKey || r.title,
      (r) => !!r.coverUrl,
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
    console.error(`Open Library nie odpowiedziało dla "${targetTitle}":`, (err as Error).message);
  }

  return {
    id: `claude:${slugify(targetTitle)}-${slugify(fallbackAuthor)}`,
    title: targetTitle,
    author: fallbackAuthor,
    year: fallbackYear,
    genres: [],
    coverUrl: null,
    source: "claude",
    rawJson: null,
  };
}

// Publiczne wejście: sprawdza cache (TTL 30 dni), w razie trafienia odświeża
// tylko flagi onShelf (mogły się zmienić od czasu zapisania w cache'u).
export async function search(query: string): Promise<SearchResult> {
  const cached = getCachedSearch(query);
  if (cached) {
    const onShelfIds = getOnShelfIds(cached.books.map((b) => b.id));
    return {
      ...cached,
      books: cached.books.map((b) => ({ ...b, onShelf: onShelfIds.has(b.id) })),
    };
  }

  const result = await performSearch(query);
  setCachedSearch(query, result);
  return result;
}

async function performSearch(query: string): Promise<SearchResult> {
  const recognized = await recognizeQuery(query);
  let candidates: GoogleBooksResult[] = [];
  try {
    candidates = await searchGoogleBooks(recognized.searchQuery, 20);
  } catch (err) {
    console.error("Google Books niedostępne, lecę dalej na Open Library:", (err as Error).message);
  }

  const newBooks: NewBook[] = [];
  const usedGoogleIds = new Set<string>();
  const usedOpenLibraryKeys = new Set<string>();

  if (recognized.type === "book") {
    const resolved = await resolveBookData(
      recognized.canonicalTitle,
      recognized.author,
      recognized.year,
      candidates,
      usedGoogleIds,
      usedOpenLibraryKeys
    );
    newBooks.push({
      id: resolved.id,
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
        volume.title,
        recognized.author,
        volume.year,
        candidates,
        usedGoogleIds,
        usedOpenLibraryKeys
      );
      newBooks.push({
        id: resolved.id,
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

  for (const book of newBooks) upsertBook(book);

  const onShelfIds = getOnShelfIds(newBooks.map((b) => b.id));

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
        onShelf: onShelfIds.has(b.id),
      })),
  };
}

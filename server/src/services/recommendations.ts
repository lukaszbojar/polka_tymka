import { db } from "../db";
import { generateSummary, suggestMoreBooks } from "./claude";
import { getOrCreateSeriesSummary } from "../repositories/seriesSummaryRepo";
import { resolveBookData } from "./searchBooks";
import { searchGoogleBooks } from "./googleBooks";
import { upsertBook } from "../repositories/bookRepo";

interface CandidateRow {
  id: string;
  title: string;
  author: string;
  series: string | null;
  year: number;
  genres: string;
  cover_url: string | null;
  summary: string | null;
  source: string;
  raw_json: string | null;
}

export interface Recommendation {
  id: string;
  title: string;
  author: string;
  series: string | null;
  year: number;
  coverUrl: string | null;
  summary: string | null;
  seriesSummary: string | null;
}

function extractDescription(source: string, rawJson: string | null): string | null {
  if (source !== "googlebooks" || !rawJson) return null;
  try {
    return (JSON.parse(rawJson) as { description?: string | null }).description ?? null;
  } catch {
    return null;
  }
}

const normalize = (s: string) => s.trim().toLowerCase();

// Kontekstowy scoring: gatunki/autorzy z "przeczytane" i "do przeczytania" liczą
// na plus, te same cechy z "nie interesuje mnie" na minus — im więcej książek
// Tymek oceni w dowolną stronę, tym trafniejsze kolejne propozycje.
// Deduplikacja po serii (jeden reprezentant na serię) i po tytule/autorze (żeby
// duplikaty tej samej książki z różnych źródeł nie omijały statusu na półce).
// Gdy lokalny cache książek się wyczerpie, dogenerowuje nowe propozycje przez
// Claude (na podstawie całej półki) i wzbogaca je okładką jak przy wyszukiwaniu —
// tak żeby "Pokaż więcej" zawsze mogło zwrócić kolejne unikalne pozycje.
export async function getRecommendations(
  offset = 0,
  limit = 5
): Promise<{ recommendations: Recommendation[]; hasMore: boolean }> {
  const owned = (await db
    .prepare(`SELECT b.title, b.author, b.genres, s.status FROM books b JOIN shelf s ON s.book_id = b.id`)
    .all()) as { title: string; author: string; genres: string; status: string }[];

  const ownedKeys = new Set(owned.map((r) => `${normalize(r.title)}|${normalize(r.author)}`));

  const genreScore = new Map<string, number>();
  const authorScore = new Map<string, number>();
  for (const row of owned) {
    const weight = row.status === "not_interested" ? -1 : 1;
    authorScore.set(row.author, (authorScore.get(row.author) ?? 0) + weight * 3);
    for (const g of JSON.parse(row.genres) as string[]) {
      genreScore.set(g, (genreScore.get(g) ?? 0) + weight);
    }
  }

  const candidates = (
    (await db.prepare(`SELECT * FROM books WHERE id NOT IN (SELECT book_id FROM shelf)`).all()) as CandidateRow[]
  ).filter((c) => !ownedKeys.has(`${normalize(c.title)}|${normalize(c.author)}`));

  const scored = candidates.map((c) => {
    const genres = JSON.parse(c.genres) as string[];
    const score =
      genres.reduce((sum, g) => sum + (genreScore.get(g) ?? 0), 0) + (authorScore.get(c.author) ?? 0);
    return { c, score };
  });

  const bySeries = new Map<string, { c: CandidateRow; score: number }>();
  for (const item of scored) {
    const key = item.c.series ?? item.c.id;
    const existing = bySeries.get(key);
    if (!existing || item.score > existing.score) bySeries.set(key, item);
  }

  let ranked = [...bySeries.values()].sort((a, b) => b.score - a.score);

  if (ranked.length < offset + limit) {
    const needed = offset + limit - ranked.length;
    const knownKeys = new Set(ownedKeys);
    for (const { c } of ranked) knownKeys.add(`${normalize(c.title)}|${normalize(c.author)}`);

    const shelfSummary = owned
      .map((r) => `- ${r.title} (${r.author}) [${r.status === "want" ? "do przeczytania" : r.status}]`)
      .join("\n");

    try {
      const suggestions = await suggestMoreBooks(
        shelfSummary,
        [...knownKeys].map((k) => k.replace("|", " — ")),
        Math.min(needed + 3, 12)
      );

      for (const s of suggestions) {
        const key = `${normalize(s.title)}|${normalize(s.author)}`;
        if (knownKeys.has(key)) continue;

        let googleCandidates: Awaited<ReturnType<typeof searchGoogleBooks>> = [];
        try {
          googleCandidates = await searchGoogleBooks(`intitle:${s.title} inauthor:${s.author}`, 10);
        } catch {
          googleCandidates = [];
        }

        const resolved = await resolveBookData(
          s.title,
          s.title,
          s.author,
          s.year,
          googleCandidates,
          new Set(),
          new Set()
        );
        const resolvedKey = `${normalize(resolved.title)}|${normalize(resolved.author)}`;
        if (knownKeys.has(resolvedKey)) continue;
        knownKeys.add(key);
        knownKeys.add(resolvedKey);

        const genres = resolved.genres.length ? resolved.genres : s.genres;
        await upsertBook({
          id: resolved.id,
          title: resolved.title,
          author: resolved.author,
          series: null,
          seriesIndex: 1,
          arc: null,
          year: resolved.year,
          genres,
          coverUrl: resolved.coverUrl,
          source: resolved.source,
          rawJson: resolved.rawJson,
        });

        const candidateRow: CandidateRow = {
          id: resolved.id,
          title: resolved.title,
          author: resolved.author,
          series: null,
          year: resolved.year,
          genres: JSON.stringify(genres),
          cover_url: resolved.coverUrl,
          summary: null,
          source: resolved.source,
          raw_json: resolved.rawJson,
        };
        bySeries.set(resolved.id, { c: candidateRow, score: 0 });
      }

      ranked = [...bySeries.values()].sort((a, b) => b.score - a.score);
    } catch (err) {
      console.error("Nie udało się dogenerować rekomendacji przez Claude:", (err as Error).message);
    }
  }

  const page = ranked.slice(offset, offset + limit);

  const updateSummary = db.prepare("UPDATE books SET summary = ? WHERE id = ?");

  const recommendations = await Promise.all(
    page.map(async ({ c }): Promise<Recommendation> => {
      let summary = c.summary;
      if (!summary) {
        try {
          summary = await generateSummary(c.title, c.author, extractDescription(c.source, c.raw_json));
          await updateSummary.run(summary, c.id);
        } catch {
          summary = null;
        }
      }

      const seriesSummary = c.series ? await getOrCreateSeriesSummary(c.series, c.author) : null;

      return {
        id: c.id,
        title: c.title,
        author: c.author,
        series: c.series,
        year: c.year,
        coverUrl: c.cover_url,
        summary,
        seriesSummary,
      };
    })
  );

  return { recommendations, hasMore: page.length === limit };
}

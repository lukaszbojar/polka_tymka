import { db } from "../db";
import { generateSummary } from "./claude";
import { getOrCreateSeriesSummary } from "../repositories/seriesSummaryRepo";

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

// Prosty scoring: nakładające się gatunki + bonus za tego samego autora,
// deduplikacja po serii (jeden reprezentant na serię, nie 18 osobnych pozycji).
// Dla zwracanej strony dogenerowuje (i zapisuje w cache'u) brakujące
// streszczenia — książki i serii.
export async function getRecommendations(
  offset = 0,
  limit = 5
): Promise<{ recommendations: Recommendation[]; hasMore: boolean }> {
  const owned = db
    .prepare(`SELECT b.author, b.genres FROM books b JOIN shelf s ON s.book_id = b.id`)
    .all() as { author: string; genres: string }[];

  const genreCounts = new Map<string, number>();
  const authorSet = new Set<string>();
  for (const row of owned) {
    authorSet.add(row.author);
    for (const g of JSON.parse(row.genres) as string[]) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }

  const candidates = db
    .prepare(`SELECT * FROM books WHERE id NOT IN (SELECT book_id FROM shelf)`)
    .all() as CandidateRow[];

  const scored = candidates
    .map((c) => {
      const genres = JSON.parse(c.genres) as string[];
      let score = genres.reduce((sum, g) => sum + (genreCounts.get(g) ?? 0), 0);
      if (authorSet.has(c.author)) score += 3;
      return { c, score };
    })
    .filter((x) => x.score > 0);

  const bySeries = new Map<string, { c: CandidateRow; score: number }>();
  for (const item of scored) {
    const key = item.c.series ?? item.c.id;
    const existing = bySeries.get(key);
    if (!existing || item.score > existing.score) bySeries.set(key, item);
  }

  const ranked = [...bySeries.values()].sort((a, b) => b.score - a.score);
  const page = ranked.slice(offset, offset + limit);

  const updateSummary = db.prepare("UPDATE books SET summary = ? WHERE id = ?");

  const recommendations = await Promise.all(
    page.map(async ({ c }): Promise<Recommendation> => {
      let summary = c.summary;
      if (!summary) {
        try {
          summary = await generateSummary(c.title, c.author, extractDescription(c.source, c.raw_json));
          updateSummary.run(summary, c.id);
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

  return { recommendations, hasMore: offset + limit < ranked.length };
}

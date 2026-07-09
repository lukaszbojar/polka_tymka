import { db } from "../db";
import { generateSeriesSummary } from "../services/claude";

export function getCachedSeriesSummary(series: string): string | null {
  const row = db
    .prepare("SELECT summary FROM series_summaries WHERE series = ?")
    .get(series) as { summary: string } | undefined;
  return row?.summary ?? null;
}

// Generuje i zapisuje streszczenie serii raz — kolejne wywołania czytają z cache'u.
export async function getOrCreateSeriesSummary(
  series: string,
  author: string
): Promise<string | null> {
  const cached = getCachedSeriesSummary(series);
  if (cached) return cached;

  try {
    const summary = await generateSeriesSummary(series, author);
    db.prepare(
      "INSERT OR IGNORE INTO series_summaries (series, summary) VALUES (?, ?)"
    ).run(series, summary);
    return summary;
  } catch (err) {
    console.error(`Nie udało się wygenerować streszczenia serii "${series}":`, (err as Error).message);
    return null;
  }
}

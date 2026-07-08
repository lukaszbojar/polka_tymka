import { db } from "../db";
import { generateSummary } from "./claude";

interface BookToSummarize {
  id: string;
  title: string;
  author: string;
  source: string;
  raw_json: string | null;
}

function extractDescription(source: string, rawJson: string | null): string | null {
  if (source !== "googlebooks" || !rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as { description?: string | null };
    return parsed.description ?? null;
  } catch {
    return null;
  }
}

// Generuje streszczenie dla każdej książki, która go jeszcze nie ma — raz,
// nie przy każdym wyświetleniu (kolejne restarty pomijają już opisane pozycje).
export async function enrichSummaries(): Promise<void> {
  const rows = db
    .prepare("SELECT id, title, author, source, raw_json FROM books WHERE summary IS NULL")
    .all() as BookToSummarize[];
  if (!rows.length) return;

  console.log(`Generowanie streszczeń dla ${rows.length} książek…`);

  const update = db.prepare("UPDATE books SET summary = ? WHERE id = ?");

  for (const book of rows) {
    try {
      const description = extractDescription(book.source, book.raw_json);
      const summary = await generateSummary(book.title, book.author, description);
      update.run(summary, book.id);
    } catch (err) {
      console.error(
        `Nie udało się wygenerować streszczenia dla "${book.title}":`,
        (err as Error).message
      );
    }
  }

  console.log("Generowanie streszczeń zakończone.");
}

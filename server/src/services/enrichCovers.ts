import { db } from "../db";
import { searchGoogleBooks, type GoogleBooksResult } from "./googleBooks";
import { searchOpenLibraryPolish } from "./openLibrary";

interface BookToEnrich {
  id: string;
  title: string;
  author: string;
}

interface FoundCover {
  coverUrl: string | null;
  source: "googlebooks" | "openlibrary" | "none";
  rawJson: string | null;
}

// Wydania z dokładnym dopasowaniem tytułu/autora często nie mają okładki w
// Google Books (zwłaszcza polskie tłumaczenia) — jeśli żaden wynik precyzyjnego
// zapytania jej nie ma, próbujemy luźniejszego zapytania jako fallback.
async function findGoogleBooksMatch(
  title: string,
  author: string
): Promise<GoogleBooksResult | null> {
  const precise = await searchGoogleBooks(`intitle:${title} inauthor:${author}`, 10);
  const withCover = precise.find((r) => r.thumbnail);
  if (withCover) return withCover;

  const loose = await searchGoogleBooks(`${title} ${author}`, 10);
  return loose.find((r) => r.thumbnail) ?? precise[0] ?? loose[0] ?? null;
}

// Kolejność źródeł: najpierw Google Books, a gdy nie da okładki — Open Library
// (ma lepsze pokrycie polskich wydań). Dopiero brak w obu zostawia fallback
// kolorowy po stronie klienta. Błąd sieciowy jednego źródła nie blokuje próby
// drugiego — dopiero gdy padną OBA, cała próba jest ponawiana przy restarcie.
async function findCover(title: string, author: string): Promise<FoundCover> {
  let gbMatch: GoogleBooksResult | null = null;
  let gbFailed = false;
  try {
    gbMatch = await findGoogleBooksMatch(title, author);
  } catch (err) {
    gbFailed = true;
    console.error(`Google Books nie odpowiedziało dla "${title}":`, (err as Error).message);
  }

  if (gbMatch?.thumbnail) {
    return { coverUrl: gbMatch.thumbnail, source: "googlebooks", rawJson: JSON.stringify(gbMatch) };
  }

  let olFailed = false;
  try {
    const olResults = await searchOpenLibraryPolish(title, author, 5);
    const olMatch = olResults.find((r) => r.coverUrl) ?? olResults[0] ?? null;
    if (olMatch?.coverUrl) {
      return { coverUrl: olMatch.coverUrl, source: "openlibrary", rawJson: JSON.stringify(olMatch) };
    }
  } catch (err) {
    olFailed = true;
    console.error(`Open Library nie odpowiedziało dla "${title}":`, (err as Error).message);
  }

  if (gbFailed && olFailed) {
    throw new Error("Oba źródła (Google Books, Open Library) nie odpowiedziały");
  }

  if (gbMatch) {
    return { coverUrl: null, source: "googlebooks", rawJson: JSON.stringify(gbMatch) };
  }
  return { coverUrl: null, source: "none", rawJson: null };
}

// Uzupełnia okładki/metadane dla książek wciąż oznaczonych jako 'seed'. Po próbie
// (udanej lub nie) source zmienia się na wynik wyszukiwania, więc kolejne
// restarty serwera (np. tsx watch) nie odpytują ponownie tych samych pozycji.
export async function enrichMissingCovers(): Promise<void> {
  const rows = db
    .prepare("SELECT id, title, author FROM books WHERE source = 'seed'")
    .all() as BookToEnrich[];
  if (!rows.length) return;

  console.log(`Wzbogacanie ${rows.length} książek danymi z Google Books i Open Library…`);

  const update = db.prepare(
    "UPDATE books SET cover_url = ?, source = ?, raw_json = ? WHERE id = ?"
  );

  for (const book of rows) {
    try {
      const found = await findCover(book.title, book.author);
      update.run(found.coverUrl, found.source, found.rawJson, book.id);
    } catch (err) {
      console.error(`Nie udało się wzbogacić "${book.title}":`, (err as Error).message);
    }
  }

  console.log("Wzbogacanie katalogu zakończone.");
}

// Jednorazowy skrypt konserwacyjny: przechodzi po wszystkich książkach na
// półce i sprawdza w Open Library, czy istnieje dla nich polskie wydanie
// (ta sama logika co /api/search, patrz services/openLibrary.ts). Jeśli
// znajdzie — podmienia tytuł i okładkę w bazie na to wydanie.
//
// Użycie: npx tsx scripts/refresh-polish-covers.ts <libsql-url> [authToken]
import { createClient } from "@libsql/client";
import { searchOpenLibraryPolish } from "../src/services/openLibrary";

const url = process.argv[2];
const authToken = process.argv[3];
if (!url) {
  console.error("Usage: npx tsx scripts/refresh-polish-covers.ts <libsql-url> [authToken]");
  process.exit(1);
}

interface BookRow {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  source: string;
}

async function main() {
  const client = createClient({ url: url!, authToken });
  const { rows } = await client.execute(
    "SELECT DISTINCT b.id, b.title, b.author, b.cover_url, b.source FROM books b JOIN shelf s ON s.book_id = b.id"
  );
  const books = rows as unknown as BookRow[];
  console.log(`Sprawdzam ${books.length} książek z półki...\n`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const book of books) {
    try {
      const results = await searchOpenLibraryPolish(book.title, book.title, book.author);
      const match = results[0];
      if (match?.coverUrl && (match.coverUrl !== book.cover_url || match.title !== book.title)) {
        console.log(`✓ "${book.title}" -> "${match.title}" (nowa okładka)`);
        await client.execute({
          sql: "UPDATE books SET title = ?, cover_url = ?, source = 'openlibrary' WHERE id = ?",
          args: [match.title, match.coverUrl, book.id],
        });
        updated++;
      } else {
        unchanged++;
      }
    } catch (err) {
      console.error(`✗ Błąd dla "${book.title}":`, (err as Error).message);
      failed++;
    }
  }

  console.log(`\nGotowe. Zaktualizowano: ${updated}, bez zmian: ${unchanged}, błędów: ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

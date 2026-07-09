// One-off maintenance script: merges duplicate books (same normalized title+author,
// different id) into a single canonical row, remapping any shelf status, then
// deletes the redundant rows. Usage: node dedupe-books.js <libsql-url> [authToken]
const { createClient } = require("@libsql/client");

const url = process.argv[2];
const authToken = process.argv[3];
if (!url) {
  console.error("Usage: node dedupe-books.js <libsql-url> [authToken]");
  process.exit(1);
}

const SOURCE_PRIORITY = { googlebooks: 3, openlibrary: 2, seed: 1, claude: 0, none: 0 };

async function main() {
  const client = createClient({ url, authToken });
  const { rows } = await client.execute(
    "SELECT id, title, author, cover_url, source FROM books"
  );

  const groups = new Map();
  for (const row of rows) {
    const key = `${String(row.title).trim().toLowerCase()}|${String(row.author).trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let mergedGroups = 0;
  let deletedRows = 0;

  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    mergedGroups++;

    const sorted = [...group].sort((a, b) => {
      const scoreA = (a.cover_url ? 10 : 0) + (SOURCE_PRIORITY[a.source] ?? 0);
      const scoreB = (b.cover_url ? 10 : 0) + (SOURCE_PRIORITY[b.source] ?? 0);
      return scoreB - scoreA;
    });
    const winner = sorted[0];
    const losers = sorted.slice(1);

    console.log(`Merging "${key}": keeping id=${winner.id} (source=${winner.source}), dropping ${losers.map((l) => l.id).join(", ")}`);

    const { rows: winnerShelf } = await client.execute({
      sql: "SELECT status FROM shelf WHERE book_id = ?",
      args: [winner.id],
    });

    if (winnerShelf.length === 0) {
      for (const loser of losers) {
        const { rows: loserShelf } = await client.execute({
          sql: "SELECT status FROM shelf WHERE book_id = ?",
          args: [loser.id],
        });
        if (loserShelf.length > 0) {
          await client.execute({
            sql: "INSERT OR IGNORE INTO shelf (book_id, status) VALUES (?, ?)",
            args: [winner.id, loserShelf[0].status],
          });
          break;
        }
      }
    }

    for (const loser of losers) {
      await client.execute({ sql: "DELETE FROM shelf WHERE book_id = ?", args: [loser.id] });
      await client.execute({ sql: "DELETE FROM books WHERE id = ?", args: [loser.id] });
      deletedRows++;
    }
  }

  console.log(`\nDone. Merged ${mergedGroups} duplicate group(s), deleted ${deletedRows} redundant row(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import express from "express";
import cors from "cors";
import path from "node:path";
import dotenv from "dotenv";
import { seedIfEmpty } from "./db/seed";
import { enrichMissingCovers } from "./services/enrichCovers";
import { enrichSummaries } from "./services/enrichSummaries";
import { search } from "./services/searchBooks";
import {
  addSeriesToShelf,
  addToShelf,
  listShelf,
  removeFromShelf,
} from "./repositories/bookRepo";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/shelf", (_req, res) => {
  res.json({ books: listShelf() });
});

app.post("/api/shelf", (req, res) => {
  const { bookId, series } = req.body ?? {};

  if (bookId) {
    const ok = addToShelf(bookId);
    if (!ok) return res.status(404).json({ error: "Book not found" });
    return res.status(201).json({ books: listShelf() });
  }

  if (series) {
    const added = addSeriesToShelf(series);
    if (added === 0) return res.status(404).json({ error: "Series not found" });
    return res.status(201).json({ books: listShelf() });
  }

  return res.status(400).json({ error: "bookId or series required" });
});

app.delete("/api/shelf/:bookId", (req, res) => {
  removeFromShelf(req.params.bookId);
  res.json({ books: listShelf() });
});

app.get("/api/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.status(400).json({ error: "q required" });

  try {
    const result = await search(q);
    res.json(result);
  } catch (err) {
    console.error("Search failed:", err);
    res.status(502).json({ error: "Wyszukiwanie nie powiodło się" });
  }
});

async function main() {
  seedIfEmpty();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
  await enrichMissingCovers();
  await enrichSummaries();
}

main();

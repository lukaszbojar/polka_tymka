import express from "express";
import cors from "cors";
import { ensureSchema } from "./db";
import { search } from "./services/searchBooks";
import { getRecommendations } from "./services/recommendations";
import {
  addSeriesToShelf,
  addToShelf,
  listShelf,
  removeFromShelf,
  type ShelfStatus,
} from "./repositories/bookRepo";

const SHELF_STATUSES: ShelfStatus[] = ["read", "want", "not_interested"];

export const app = express();

app.use(cors());
app.use(express.json());
app.use(async (_req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (err) {
    console.error("Schema init failed:", err);
    res.status(503).json({ error: "Baza danych jest niedostępna" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/shelf", async (req, res) => {
  const status = SHELF_STATUSES.includes(req.query.status as ShelfStatus)
    ? (req.query.status as ShelfStatus)
    : undefined;
  res.json({ books: await listShelf(status) });
});

app.post("/api/shelf", async (req, res) => {
  const { bookId, series, status } = req.body ?? {};
  const shelfStatus: ShelfStatus = SHELF_STATUSES.includes(status) ? status : "read";

  if (bookId) {
    const ok = await addToShelf(bookId, shelfStatus);
    if (!ok) return res.status(404).json({ error: "Book not found" });
    return res.status(201).json({ books: await listShelf() });
  }

  if (series) {
    const added = await addSeriesToShelf(series, shelfStatus);
    if (added === 0) return res.status(404).json({ error: "Series not found" });
    return res.status(201).json({ books: await listShelf() });
  }

  return res.status(400).json({ error: "bookId or series required" });
});

app.delete("/api/shelf/:bookId", async (req, res) => {
  await removeFromShelf(req.params.bookId);
  res.json({ books: await listShelf() });
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

app.get("/api/recommendations", async (req, res) => {
  const offset = Number(req.query.offset ?? 0) || 0;
  const limit = Number(req.query.limit ?? 5) || 5;
  try {
    res.json(await getRecommendations(offset, limit));
  } catch (err) {
    console.error("Recommendations failed:", err);
    res.status(502).json({ error: "Nie udało się pobrać rekomendacji" });
  }
});

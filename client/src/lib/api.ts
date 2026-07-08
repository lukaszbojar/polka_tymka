import type { Book } from "../types/book";
import type { SearchResult } from "../types/searchResult";

export async function fetchShelf(): Promise<Book[]> {
  const res = await fetch("/api/shelf");
  if (!res.ok) throw new Error(`GET /api/shelf failed: ${res.status}`);
  const data = await res.json();
  return data.books as Book[];
}

export async function removeFromShelf(bookId: string): Promise<Book[]> {
  const res = await fetch(`/api/shelf/${bookId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /api/shelf/${bookId} failed: ${res.status}`);
  const data = await res.json();
  return data.books as Book[];
}

export async function searchBooks(q: string): Promise<SearchResult> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `GET /api/search failed: ${res.status}`);
  }
  return res.json();
}

async function postToShelf(body: Record<string, string>): Promise<Book[]> {
  const res = await fetch("/api/shelf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST /api/shelf failed: ${res.status}`);
  const data = await res.json();
  return data.books as Book[];
}

export function addBookToShelf(bookId: string): Promise<Book[]> {
  return postToShelf({ bookId });
}

export function addSeriesToShelf(series: string): Promise<Book[]> {
  return postToShelf({ series });
}

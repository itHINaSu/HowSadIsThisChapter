// Data loading: the one place that knows where data comes from.
//
// This app reads static JSON from ./api/ (built by the updater container).
// To use the components on howsadisthischapter.com, replace the two fetch
// functions below with Supabase queries that return the same shapes
// (see src/lib/types.ts and INTEGRATION.md); nothing else needs to change.
import { queryOptions } from "@tanstack/react-query";
import type { Book, BookSummary, Library, Meta, Series } from "./types";

export class HttpError extends Error {
  constructor(public status: number, path: string) {
    super(`${status} ${path}`);
  }
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new HttpError(res.status, path);
  return res.json() as Promise<T>;
}

export async function fetchLibrary(): Promise<Library> {
  const [books, meta, series] = await Promise.all([
    getJSON<BookSummary[]>("api/books.json"),
    getJSON<Meta>("api/meta.json"),
    getJSON<Series[]>("api/series.json"),
  ]);
  return { books, meta, series, bySlug: new Map(books.map((b, index) => [b.slug, { ...b, index }])) };
}

export function fetchBook(slug: string): Promise<Book> {
  return getJSON<Book>(`api/books/${encodeURIComponent(slug)}.json`);
}

// TanStack Query options, used by route loaders and components alike.
export const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: fetchLibrary,
  staleTime: 5 * 60 * 1000,
});

export const bookQuery = (slug: string) =>
  queryOptions({
    queryKey: ["book", slug],
    queryFn: () => fetchBook(slug),
    staleTime: 5 * 60 * 1000,
  });

import type { Chapter, DnfStats, SeriesRef } from "./types";

/** Sadness level 1–5 for colouring. */
export const level = (avg: number) => Math.min(5, Math.max(1, Math.round(avg))) as 1 | 2 | 3 | 4 | 5;

/** 3 → "3", 3.25 → "3.3" */
export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const chapterName = (c: Pick<Chapter, "label" | "number">) => c.label || `Chapter ${c.number}`;

export const seriesLabel = (s: SeriesRef | null) => (s ? (s.number ? `${s.title} · Book ${s.number}` : s.title) : "");

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** "12% of 40 readers who logged this book bailed on it." from the site's DNF stats. */
export function dnfText(d: DnfStats): string | null {
  if (!d || typeof d !== "object") return null;
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  const total = num(d.total) ?? num(d.readers) ?? num(d.totalReaders) ?? num(d.count);
  const bailed = num(d.bailed) ?? num(d.dnf) ?? num(d.dnfCount) ?? num(d.bailedCount);
  let pct = num(d.percent) ?? num(d.dnfPercent) ?? num(d.percentage) ?? num(d.rate);
  if (pct !== undefined && pct <= 1 && d.rate !== undefined) pct *= 100;
  if (pct === undefined && bailed !== undefined && total !== undefined && total > 0) pct = (bailed / total) * 100;
  if (pct === undefined) return null;
  return `${Math.round(pct)}% of ${total !== undefined ? `${total} ` : ""}readers who logged this book bailed on it.`;
}

export const SITE = "https://howsadisthischapter.com";

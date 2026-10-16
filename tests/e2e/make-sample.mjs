// Builds a small sample library for the end-to-end tests from the saved real
// book page, in tests/e2e/.data/api (same format the updater writes).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extractLoaderData, normalizeBook } from "../../scripts/lib/parse.mjs";

const root = new URL("../../", import.meta.url).pathname;
const html = readFileSync(`${root}scripts/fixtures/book-page.html`, "utf8");
const base = extractLoaderData(html, "book$slug");
const out = `${root}tests/e2e/.data/api`;
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/books`, { recursive: true });

const long = Array.from({ length: 150 }, (_, i) => (i % 7 === 0 ? 4.6 : 1 + ((i * 37) % 40) / 10));
const specs = [
  ["they-both-die-at-the-end", "They Both Die at the End", "Adam Silvera", base.book.coverImageUrl, { slug: "they-both-die-at-the-end", title: "They Both Die at the End", number: null }, null],
  ["a-memory-of-light", "A Memory of Light", "Robert Jordan, Brandon Sanderson", null, { slug: "wheel-of-time", title: "Wheel of Time", number: 14 }, [2.1, 1.8, 3.2, 4.6, 2.0, 3.9, 4.8, 1.5]],
  ["my-friends", "My friends", "Fredrik Backman", null, null, [1.2, 2.4, 3.1, 2.2, 4.1, 3.0]],
  ["redeeming-6", "Redeeming 6", "Chloe Walsh", null, null, [3.2, 3.8, 4.2, 2.9, 1.6]],
  ["gentle-tale", "A Gentle Tale", "Some Author", null, null, [1.2, 1.4, 1.1, 2.0, 1.6, 1.3]],
  ["city-of-ashes-2", "City Of Ashes 2", "Cassandra Clare", null, { slug: "mortal-instruments", title: "Mortal Instruments", number: 2 }, [1.4, 2.0, 2.6]],
  ["very-long-book", "A Very Long Book", "Prolific Writer", null, null, long],
];
const types = base.warningTypes;
const books = [];
const series = new Map();
for (const [slug, title, author, cover, s, avgs] of specs) {
  const l = structuredClone(base);
  Object.assign(l.book, { slug, title, author, coverImageUrl: cover, seriesSlug: s?.slug ?? null, seriesTitle: s?.title ?? null, seriesNumber: s?.number ?? null });
  if (avgs) {
    l.chapters = avgs.map((_, i) => ({ id: `${slug}-c${i}`, chapterNumber: i + 1, chapterLabel: `Chapter ${i + 1}`, displayOrder: i + 1 }));
    l.ratings = Object.fromEntries(avgs.map((a, i) => [`${slug}-c${i}`, { average: a, votes: i === 2 ? 3 : 12 + i * 5 }]));
    l.warnings = Object.fromEntries(
      avgs.map((a, i) => [`${slug}-c${i}`, a >= 4 ? { [types[3].id]: 6, [types[4].id]: 4, [types[0].id]: 1 } : a >= 3 ? { [types[3].id]: 5 } : {}]),
    );
  }
  const b = normalizeBook(l);
  const { warningTypes, thresholds, ...rest } = b;
  writeFileSync(`${out}/books/${slug}.json`, JSON.stringify(rest));
  const rated = b.chapters.filter((c) => c.average !== null);
  books.push({
    slug, title, author, cover, series: b.series, addedAt: new Date().toISOString(),
    chapters: b.chapters.length, ratedChapters: rated.length, votes: b.chapters.reduce((n, c) => n + c.votes, 0),
    peak: rated.length ? Math.max(...rated.map((c) => c.average)) : null, isSpicy: slug === "redeeming-6",
    levels: b.chapters.map((c) => c.average), warningIds: [...new Set(b.chapters.flatMap((c) => c.warnings.map((w) => w.id)))],
  });
  if (b.series) series.set(b.series.slug, { slug: b.series.slug, title: b.series.title, books: [{ slug, number: b.series.number }] });
}
writeFileSync(`${out}/books.json`, JSON.stringify(books));
writeFileSync(`${out}/series.json`, JSON.stringify([...series.values()]));
writeFileSync(`${out}/meta.json`, JSON.stringify({ generatedAt: new Date().toISOString(), books: books.length, warningTypes: types, thresholds: base.thresholds }));
console.log(`Sample library: ${books.length} books in ${out}`);

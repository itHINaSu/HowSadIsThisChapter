import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractLoaderData, normalizeBook, normalizeWarnings } from "./lib/parse.mjs";

const html = readFileSync(new URL("./fixtures/book-page.html", import.meta.url), "utf8");

test("extracts book loader data from a real page", () => {
  const l = extractLoaderData(html, "book$slug");
  assert.equal(l.book.slug, "they-both-die-at-the-end");
  assert.equal(l.chapters.length, 4);
  assert.equal(l.ratings["6a1e12cd-b743-4e83-ad5b-151355afed04"].average, 5);
});

test("matches live-site ids that contain NUL separators", () => {
  const live = html.replaceAll('"book$slugbookthey-both-die-at-the-end"', '"\\u0000book\\u0000$slug\\u0000book\\u0000they-both-die-at-the-end"');
  assert.notEqual(live, html);
  assert.equal(extractLoaderData(live, "book$slug").book.slug, "they-both-die-at-the-end");
});

test("falls back to the match holding book data when ids change", () => {
  const renamed = html.replaceAll('"book$slugbookthey-both-die-at-the-end"', '"/books/$id/they-both-die-at-the-end"');
  assert.equal(extractLoaderData(renamed, "book$slug").book.slug, "they-both-die-at-the-end");
});

test("normalizes chapters in display order and hides averages below the vote minimum", () => {
  const book = normalizeBook(extractLoaderData(html, "book$slug"));
  assert.deepEqual(book.chapters.map((c) => c.number), [1, 2, 3, 4]);
  assert.equal(book.chapters[3].label, "Part Four: They Both Die at the End");
  assert.equal(book.chapters[3].votes, 1);
  assert.equal(book.chapters[3].average, null); // 1 vote < sadnessMinVotes (5)
  assert.equal(book.series.slug, "they-both-die-at-the-end");
  assert.equal(book.warningTypes.length, 11);
  assert.equal(book.dnf, null);
  assert.equal(book.isSpicy, false);
});

test("shows averages once the vote minimum is met", () => {
  const l = extractLoaderData(html, "book$slug");
  l.ratings["1cc6333e-9382-4cd4-8ab7-70a1597cc9e9"] = { average: 3.456, votes: 7 };
  const book = normalizeBook(l);
  assert.equal(book.chapters[0].average, 3.5);
});

test("warnings: accepts chapter->type->count and applies the vote minimum", () => {
  const out = normalizeWarnings({ c1: { w1: 4, w2: 1 } }, new Set(["c1"]), new Set(["w1", "w2"]));
  assert.deepEqual(out.c1, [{ typeId: "w1", votes: 4 }, { typeId: "w2", votes: 1 }]);
});

test("warnings: accepts arrays of ids and of objects, and type-keyed maps", () => {
  const ch = new Set(["c1"]), types = new Set(["w1"]);
  assert.deepEqual(normalizeWarnings({ c1: ["w1"] }, ch, types).c1, [{ typeId: "w1", votes: null }]);
  assert.deepEqual(normalizeWarnings({ c1: [{ warningTypeId: "w1", votes: 3 }] }, ch, types).c1, [{ typeId: "w1", votes: 3 }]);
  assert.deepEqual(normalizeWarnings({ w1: { c1: 5 } }, ch, types).c1, [{ typeId: "w1", votes: 5 }]);
});

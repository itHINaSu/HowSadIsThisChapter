import { describe, expect, it } from "vitest";
import { verdict } from "./moods";
import { enoughRated, isGentle, isSafeForMood, libraryItems, hasAvoided } from "./books";
import { dnfText, fmt, level } from "./format";
import { DEFAULT_FILTERS } from "./storage";
import type { BookSummary } from "./types";

const book = (over: Partial<BookSummary>): BookSummary => ({
  slug: "b", title: "B", author: "A", cover: null, series: null, addedAt: "", chapters: 6, ratedChapters: 6,
  votes: 10, peak: 2, isSpicy: false, levels: [1, 2, 2, 1, 2, 1], warningIds: [], ...over,
});

describe("verdict (same thresholds as the site)", () => {
  it("fine: go below 4, caution below 4.5", () => {
    expect(verdict("fine", 3.9)).toBe("go");
    expect(verdict("fine", 4)).toBe("caution");
    expect(verdict("fine", 4.5)).toBe("stop");
  });
  it("fragile and devastated", () => {
    expect(verdict("fragile", 2.4)).toBe("go");
    expect(verdict("fragile", 3)).toBe("caution");
    expect(verdict("devastated", 2.5)).toBe("stop");
  });
  it("enraged is always go", () => expect(verdict("enraged", 5)).toBe("go"));
  it("no mood or no average gives no verdict", () => {
    expect(verdict(null, 3)).toBeNull();
    expect(verdict("fine", null)).toBeNull();
  });
});

describe("book judgements", () => {
  it("enoughRated needs 3 chapters and half the book", () => {
    expect(enoughRated(book({ chapters: 10, ratedChapters: 4 }))).toBe(false);
    expect(enoughRated(book({ chapters: 10, ratedChapters: 5 }))).toBe(true);
    expect(enoughRated(book({ chapters: 2, ratedChapters: 2 }))).toBe(false);
  });
  it("gentle and safe for mood", () => {
    expect(isGentle(book({}))).toBe(true);
    expect(isGentle(book({ peak: 3 }))).toBe(false);
    expect(isSafeForMood(book({ levels: [1, 3, null] , chapters: 3, ratedChapters: 3 }), "fragile")).toBe(false);
    expect(isSafeForMood(book({}), "fragile")).toBe(true);
  });
  it("hasAvoided", () => {
    expect(hasAvoided(book({ warningIds: ["x"] }), new Set(["x"]))).toBe(true);
    expect(hasAvoided(book({ warningIds: ["x"] }), new Set())).toBe(false);
  });
});

describe("libraryItems", () => {
  const books = [
    book({ slug: "a", title: "Zed", isSpicy: true, peak: 4, votes: 5 }),
    book({ slug: "b", title: "Alpha", series: { slug: "s", title: "Saga", number: 1 }, votes: 50 }),
    book({ slug: "c", title: "Beta", series: { slug: "s", title: "Saga", number: 2 }, votes: 20 }),
  ];
  const base = { query: "", preset: null, filters: DEFAULT_FILTERS, sort: "recent" as const, mood: null, avoid: new Set<string>() };
  it("searches title, author and series", () => {
    expect(libraryItems(books, [], { ...base, query: "saga" }).map((i) => i.book.slug)).toEqual(["b", "c"]);
  });
  it("sorts", () => {
    expect(libraryItems(books, [], { ...base, sort: "az" }).map((i) => i.book.title)).toEqual(["Alpha", "Beta", "Zed"]);
    expect(libraryItems(books, [], { ...base, sort: "rated" })[0].book.slug).toBe("b");
  });
  it("filters spicy and groups series", () => {
    const items = libraryItems(books, [], { ...base, filters: { ...DEFAULT_FILTERS, hideSpicy: true, groupSeries: true } });
    expect(items).toHaveLength(1);
    expect(items[0].series?.slug).toBe("s");
  });
  it("presets", () => {
    expect(libraryItems(books, [], { ...base, preset: "gentle" }).map((i) => i.book.slug)).toEqual(["b", "c"]);
  });
});

describe("format", () => {
  it("level and fmt", () => {
    expect(level(0.2)).toBe(1);
    expect(level(4.6)).toBe(5);
    expect(fmt(3)).toBe("3");
    expect(fmt(3.25)).toBe("3.3");
  });
  it("dnfText handles several shapes", () => {
    expect(dnfText({ bailed: 3, total: 12 })).toBe("25% of 12 readers who logged this book bailed on it.");
    expect(dnfText({ rate: 0.1 })).toBe("10% of readers who logged this book bailed on it.");
    expect(dnfText(null)).toBeNull();
  });
});

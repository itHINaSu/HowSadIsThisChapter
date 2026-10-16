// Book-level judgements used by the library filters and Discover.
import { verdict } from "./moods";
import type { Filters, MoodId } from "./storage";
import type { BookSummary, Series } from "./types";

/** At least 3 chapters, and half the book, have enough ratings. */
export const enoughRated = (b: BookSummary) => b.ratedChapters >= Math.max(3, Math.ceil(b.chapters / 2));
export const hasAvoided = (b: BookSummary, avoid: Set<string>) =>
  avoid.size > 0 && (b.warningIds ?? []).some((id) => avoid.has(id));
/** No chapter averages above 2.5. */
export const isGentle = (b: BookSummary) => b.peak !== null && b.peak < 2.5 && enoughRated(b);
/** Every rated chapter is a "go" in this mood. */
export const isSafeForMood = (b: BookSummary, mood: MoodId | null) =>
  !!mood && Array.isArray(b.levels) && enoughRated(b) && b.levels.every((avg) => avg === null || verdict(mood, avg) === "go");

export type Sort = "recent" | "az" | "saddest" | "rated";
export const SORTS: [Sort, string][] = [["recent", "Newest"], ["az", "A–Z"], ["saddest", "Saddest"], ["rated", "Most rated"]];

export type PresetContext = { mood: MoodId | null; avoid: Set<string> };
export type Preset = { label: string; test: (b: BookSummary, ctx: PresetContext) => boolean; sort?: Sort };
export type PresetId = "safe" | "gentle" | "avoidfree" | "devastating";

/** Library views linked from Discover ("See all"). */
export const PRESETS: Record<PresetId, Preset> = {
  safe: { label: "Safe for your mood", test: (b, { mood }) => isSafeForMood(b, mood) },
  gentle: { label: "Gentle reads", test: isGentle },
  avoidfree: { label: "No warnings you avoid", test: (b, { avoid }) => b.ratedChapters > 0 && !hasAvoided(b, avoid) },
  devastating: { label: "Most devastating", test: (b) => b.peak !== null && b.ratedChapters >= 3, sort: "saddest" },
};
export const isPreset = (id: unknown): id is PresetId => typeof id === "string" && id in PRESETS;

export type LibraryItem = { book: BookSummary; series?: Series };

export function sortBooks(list: BookSummary[], sort: Sort): BookSummary[] {
  if (sort === "az") return [...list].sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "saddest") return [...list].sort((a, b) => (b.peak ?? -1) - (a.peak ?? -1));
  if (sort === "rated") return [...list].sort((a, b) => b.votes - a.votes);
  return list;
}

/** Search, preset, filters and sort applied to the library; optionally grouped by series. */
export function libraryItems(
  books: BookSummary[],
  allSeries: Series[],
  opts: { query: string; preset: PresetId | null; filters: Filters; sort: Sort; mood: MoodId | null; avoid: Set<string> },
): LibraryItem[] {
  const q = opts.query.trim().toLowerCase();
  const f = opts.filters;
  const preset = opts.preset ? PRESETS[opts.preset] : null;
  const ctx = { mood: opts.mood, avoid: opts.avoid };
  const list = sortBooks(
    books.filter((b) =>
      (!q || [b.title, b.author, b.series?.title].some((s) => s && s.toLowerCase().includes(q))) &&
      (!preset || preset.test(b, ctx)) &&
      (!f.hideSpicy || !b.isSpicy) &&
      (!f.ratedOnly || b.ratedChapters > 0) &&
      (!f.hideAvoided || !hasAvoided(b, opts.avoid)),
    ),
    preset?.sort ?? opts.sort,
  );

  if (!f.groupSeries) return list.map((book) => ({ book }));
  const seen = new Set<string>();
  const items: LibraryItem[] = [];
  for (const b of list) {
    if (!b.series) {
      items.push({ book: b });
    } else if (!seen.has(b.series.slug)) {
      seen.add(b.series.slug);
      const s = allSeries.find((x) => x.slug === b.series!.slug);
      items.push({ book: b, series: s ?? { slug: b.series.slug, title: b.series.title, books: [{ slug: b.slug, number: b.series.number }] } });
    }
  }
  return items;
}

// Pulls the data the site's server already rendered into each page.
//
// TanStack Start pages end with a script like
//   $_TSR.router=($R=>$R[0]={...matches:[...]})($R["tsr"]);$_TSR.e();
// which is the loader data (book, chapters, ratings, ...) serialised by
// seroval. It is an object literal, not JSON, so we evaluate just that
// expression in an empty VM context with a short timeout.
import vm from "node:vm";

const START = "$_TSR.router=";
const END = ";$_TSR.e()";

export function extractRouterState(html) {
  const start = html.indexOf(START);
  if (start === -1) throw new Error("No $_TSR.router block found in page");
  const end = html.indexOf(END, start);
  if (end === -1) throw new Error("Unterminated $_TSR.router block");
  const expr = html.slice(start + START.length, end);
  const context = vm.createContext({ $R: { tsr: [] } });
  return vm.runInContext(`(${expr})`, context, { timeout: 1000 });
}

// Loader data for the first match whose id starts with `routePrefix`
// (match ids look like "book$slugbookthey-both-die-at-the-end").
export function extractLoaderData(html, routePrefix) {
  const state = extractRouterState(html);
  const match = state.matches?.find((m) => typeof m.i === "string" && m.i.startsWith(routePrefix));
  if (!match) throw new Error(`No route match starting with "${routePrefix}"`);
  if (match.s !== "success") throw new Error(`Route "${match.i}" status is ${match.s}`);
  return match.l;
}

// Warnings arrive as `{}` when nobody has voted yet, so their populated
// shape is not known. Accept the plausible ones and return
// [{ typeId, votes }] per chapter; votes is null when the site only
// sends ids (meaning it already applied its own agreement rules).
export function normalizeWarnings(raw, chapterIds, warningTypeIds) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;

  const toList = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((v) => {
          if (typeof v === "string") return { typeId: v, votes: null };
          if (v && typeof v === "object") {
            const typeId = v.warningTypeId ?? v.typeId ?? v.warning_type_id ?? v.id;
            const votes = v.votes ?? v.count ?? v.total ?? null;
            return typeId ? { typeId, votes: typeof votes === "number" ? votes : null } : null;
          }
          return null;
        })
        .filter(Boolean);
    }
    if (value && typeof value === "object") {
      return Object.entries(value).map(([typeId, v]) => ({
        typeId,
        votes: typeof v === "number" ? v : typeof v?.votes === "number" ? v.votes : typeof v?.count === "number" ? v.count : null,
      }));
    }
    return [];
  };

  const keys = Object.keys(raw);
  const keyedByWarning = keys.length > 0 && keys.every((k) => warningTypeIds.has(k)) && !keys.some((k) => chapterIds.has(k));

  if (keyedByWarning) {
    // { warningTypeId: { chapterId: votes } } -> flip it
    for (const [typeId, byChapter] of Object.entries(raw)) {
      for (const { typeId: chapterId, votes } of toList(byChapter)) {
        (out[chapterId] ??= []).push({ typeId, votes });
      }
    }
  } else {
    for (const [chapterId, value] of Object.entries(raw)) out[chapterId] = toList(value);
  }
  return out;
}

// Turn the /book/$slug loader data into the shape the app serves.
export function normalizeBook(l) {
  const b = l.book;
  const thresholds = l.thresholds ?? {};
  const minVotes = thresholds.sadnessMinVotes ?? 5;
  const warnMin = thresholds.warningMinVotes ?? 3;
  const warningTypes = l.warningTypes ?? [];
  const chapterIds = new Set((l.chapters ?? []).map((c) => c.id));
  const warnings = normalizeWarnings(l.warnings, chapterIds, new Set(warningTypes.map((w) => w.id)));

  const chapters = [...(l.chapters ?? [])]
    .sort((a, b) => (a.displayOrder ?? a.chapterNumber) - (b.displayOrder ?? b.chapterNumber))
    .map((c) => {
      const r = l.ratings?.[c.id];
      const votes = r?.votes ?? 0;
      return {
        id: c.id,
        number: c.chapterNumber,
        label: c.chapterLabel,
        votes,
        // Match the site: no average until enough people have rated.
        average: votes >= minVotes && typeof r?.average === "number" ? round1(r.average) : null,
        warnings: (warnings[c.id] ?? [])
          .filter((w) => w.votes === null || w.votes >= warnMin)
          .map((w) => (w.votes === null ? { id: w.typeId } : { id: w.typeId, votes: w.votes })),
      };
    });

  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    author: b.author,
    cover: b.coverImageUrl ?? null,
    isbn: b.isbn13 ?? b.isbn ?? null,
    isSpicy: !!b.isSpicy,
    series: b.seriesSlug ? { slug: b.seriesSlug, title: b.seriesTitle, number: b.seriesNumber ?? null } : null,
    chapters,
    warningTypes,
    thresholds,
  };
}

const round1 = (n) => Math.round(n * 10) / 10;

// The data the app works with. In this repo it comes from the JSON files the
// updater builds (see scripts/build-data.mjs); on howsadisthischapter.com it
// would come straight from Supabase. See INTEGRATION.md.

export type SeriesRef = { slug: string; title: string; number: number | null };

/** One book in the library list, with a per-chapter summary. */
export type BookSummary = {
  slug: string;
  title: string;
  author: string;
  cover: string | null;
  series: SeriesRef | null;
  addedAt: string;
  /** Number of chapters */
  chapters: number;
  /** Chapters with enough ratings to show an average */
  ratedChapters: number;
  /** Total sadness ratings across all chapters */
  votes: number;
  /** Highest chapter average, or null if nothing is rated yet */
  peak: number | null;
  isSpicy: boolean;
  /** Each chapter's average in reading order (null = not enough ratings) */
  levels: (number | null)[];
  /** Content warnings readers agree on, anywhere in the book */
  warningIds: string[];
};

export type ChapterWarning = { id: string; votes?: number };

export type Chapter = {
  id: string;
  number: number;
  label: string | null;
  votes: number;
  /** Average sadness 1–5, or null below the minimum number of ratings */
  average: number | null;
  /** Warnings enough readers agree on */
  warnings: ChapterWarning[];
};

/** Did-not-finish stats, in whatever shape the site provides. */
export type DnfStats = Record<string, unknown> | null;

export type Book = {
  id: string;
  slug: string;
  title: string;
  author: string;
  cover: string | null;
  isbn: string | null;
  isSpicy: boolean;
  series: SeriesRef | null;
  dnf: DnfStats;
  chapters: Chapter[];
};

export type Series = { slug: string; title: string; books: { slug: string; number: number | null }[] };

export type WarningType = { id: string; name: string };

/** The site's display rules (same names as on howsadisthischapter.com). */
export type Thresholds = {
  sadnessMinVotes?: number;
  sadnessLimitedDataVotes?: number;
  warningMinVotes?: number;
  warningAgreement?: number;
  highIntensity?: number;
  worstAhead?: number;
  [key: string]: number | undefined;
};

export type Meta = {
  generatedAt: string;
  books: number;
  warningTypes: WarningType[];
  thresholds: Thresholds;
};

/** Everything the list pages need, loaded once. */
export type Library = {
  books: BookSummary[];
  /** Book by slug; `index` is its position in the list (for numbered covers) */
  bySlug: Map<string, BookSummary & { index: number }>;
  series: Series[];
  meta: Meta;
};

// Builds the static JSON API the PWA reads, under site/api/.
//
//   books.json          every approved book with a short summary
//   books/<slug>.json   one book: chapters, sadness averages, warnings
//   series.json         series and their books in order
//   meta.json           build time, warning types, display thresholds
//
// The book list comes straight from the site's public Supabase tables
// (books/series are readable with the publishable key). Per-chapter
// averages are only computed server-side, so those come from the data
// block embedded in each /book/<slug> page.
//
// Env: OUT_DIR (parent of api/, default site/), MAX_BOOKS (limit, for
//      testing), DELAY_MS (pause between page fetches).
//
// Each run writes to api.tmp/ and swaps it in at the end, so the web
// server never serves a half-written build. If a book page fails, the
// copy from the previous build is reused.
import { mkdir, writeFile, rm, rename, readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractLoaderData, normalizeBook } from "./lib/parse.mjs";

const SITE = "https://howsadisthischapter.com";
const SUPABASE = "https://iaskgacieqgmmfayckfm.supabase.co/rest/v1";
const KEY = "sb_publishable_Ur2jbI7Sk8NHppFCHPmu4Q_lxvCcn93"; // public key shipped in the site's own JS
const UA = "HowSadIsThisChapter-PWA/1.0 (+https://github.com/itHINaSu/HowSadIsThisChapter)";

const ROOT = process.env.OUT_DIR ?? new URL("../site/", import.meta.url).pathname;
const OUT = join(ROOT, "api");
const TMP = join(ROOT, "api.tmp");
const MAX_BOOKS = Number(process.env.MAX_BOOKS) || Infinity;
const DELAY_MS = Number(process.env.DELAY_MS ?? 600);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, init = {}, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { "user-agent": UA, ...init.headers } });
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status} for ${url}`);
      if (i >= tries) throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      if (i >= tries || /HTTP 4/.test(err.message)) throw err;
    }
    await sleep(2000 * i);
  }
}

async function supabaseAll(table, query) {
  const rows = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const url = `${SUPABASE}/${table}?${query}&limit=${page}&offset=${offset}`;
    const res = await fetchWithRetry(url, { headers: { apikey: KEY } });
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) return rows;
  }
}

async function fetchBook(slug) {
  try {
    const res = await fetchWithRetry(`${SITE}/book/${encodeURIComponent(slug)}`);
    return normalizeBook(extractLoaderData(await res.text(), "book$slug"));
  } catch (err) {
    let previous;
    try {
      previous = JSON.parse(await readFile(join(OUT, "books", `${slug}.json`), "utf8"));
    } catch {
      throw err;
    }
    console.warn(`  ${slug}: ${err.message}; reusing previous build`);
    return previous;
  }
}

function summarize(book, addedAt) {
  const rated = book.chapters.filter((c) => c.average !== null);
  return {
    slug: book.slug,
    title: book.title,
    author: book.author,
    cover: book.cover,
    series: book.series,
    addedAt,
    chapters: book.chapters.length,
    ratedChapters: rated.length,
    votes: book.chapters.reduce((n, c) => n + c.votes, 0),
    peak: rated.length ? Math.max(...rated.map((c) => c.average)) : null,
    warnings: book.chapters.some((c) => c.warnings.length > 0),
  };
}

async function main() {
  await mkdir(ROOT, { recursive: true });
  console.log("Fetching book list from Supabase…");
  const rows = await supabaseAll(
    "books",
    "select=slug,title,author,created_at&status=eq.approved&order=created_at.desc",
  );
  const list = rows.slice(0, MAX_BOOKS);
  console.log(`${rows.length} approved books; building ${list.length}`);

  await rm(TMP, { recursive: true, force: true });
  await mkdir(join(TMP, "books"), { recursive: true });

  const summaries = [];
  let meta = null;
  let failed = 0;

  for (const [i, row] of list.entries()) {
    try {
      const book = await fetchBook(row.slug);
      if (book.warningTypes) meta ??= { warningTypes: book.warningTypes, thresholds: book.thresholds };
      const { warningTypes, thresholds, ...rest } = book;
      await writeFile(join(TMP, "books", `${book.slug}.json`), JSON.stringify(rest));
      summaries.push(summarize(book, row.created_at));
    } catch (err) {
      failed++;
      console.warn(`  ${row.slug}: ${err.message}`);
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${list.length}`);
    await sleep(DELAY_MS);
  }

  // Refuse to publish a mostly-empty build over a good one.
  if (summaries.length === 0 || failed > list.length * 0.2) {
    throw new Error(`${failed} of ${list.length} books failed; not publishing`);
  }

  if (!meta) {
    const prev = JSON.parse(await readFile(join(OUT, "meta.json"), "utf8").catch(() => "{}"));
    meta = { warningTypes: prev.warningTypes ?? [], thresholds: prev.thresholds ?? {} };
  }

  const series = new Map();
  for (const s of summaries) {
    if (!s.series) continue;
    const entry = series.get(s.series.slug) ?? { slug: s.series.slug, title: s.series.title, books: [] };
    entry.books.push({ slug: s.slug, number: s.series.number });
    series.set(s.series.slug, entry);
  }
  for (const s of series.values()) s.books.sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9));

  await writeFile(join(TMP, "books.json"), JSON.stringify(summaries));
  await writeFile(join(TMP, "series.json"), JSON.stringify([...series.values()]));
  await writeFile(
    join(TMP, "meta.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: SITE, books: summaries.length, ...meta }),
  );
  const OLD = join(ROOT, "api.old");
  await rm(OLD, { recursive: true, force: true });
  await rename(OUT, OLD).catch(() => {});
  await rename(TMP, OUT);
  await rm(OLD, { recursive: true, force: true });
  console.log(`Done: ${summaries.length} books, ${series.size} series, ${failed} failed`);
}

export { main as buildData };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

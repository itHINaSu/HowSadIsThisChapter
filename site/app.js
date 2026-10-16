// How Sad? — an unofficial, phone-friendly reader for howsadisthischapter.com.
// Reads the static JSON built by scripts/build-data.mjs from ./api/.
// Everything personal (mood, shelf, settings) is kept on this device only.

const SITE = "https://howsadisthischapter.com";
const PAGE_SIZE = 30;
const view = document.getElementById("view");

// ---------- storage ----------

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

const DEFAULT_FILTERS = { hideSpicy: false, ratedOnly: false, hideAvoided: false, groupSeries: false };
const prefs = {
  mood: () => store.get("mood", null),
  avoid: () => new Set(store.get("avoid", [])),
  showWarnings: () => store.get("show-warnings", false),
  shelf: () => store.get("shelf", {}),
  filters: () => ({ ...DEFAULT_FILTERS, ...store.get("filters", {}) }),
};
// Keys exported/imported by "Your data" (stored raw, as localStorage holds them).
const DATA_KEYS = ["mood", "avoid", "show-warnings", "shelf", "filters", "text-size", "sadness-theme"];

// shelf[slug] = { status: "reading" | "finished" | "bailed" | undefined, chapter: index | null, updated }
function updateShelf(slug, patch) {
  const shelf = prefs.shelf();
  const next = { ...shelf[slug], ...patch, updated: Date.now() };
  if (!next.status && (next.chapter === null || next.chapter === undefined)) delete shelf[slug];
  else shelf[slug] = next;
  store.set("shelf", shelf);
}

// Earlier versions stored the chapter per book as "here:<slug>".
(function migrate() {
  try {
    const shelf = prefs.shelf();
    let changed = false;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith("here:")) continue;
      const chapter = store.get(key, null);
      if (chapter !== null && !shelf[key.slice(5)]) {
        shelf[key.slice(5)] = { status: "reading", chapter, updated: Date.now() };
        changed = true;
      }
      localStorage.removeItem(key);
    }
    if (changed) store.set("shelf", shelf);
  } catch {}
})();

// ---------- data ----------

const state = {
  books: null,
  bySlug: new Map(),
  meta: null,
  series: null,
  bookCache: new Map(),
  query: "",
  sort: "recent",
  preset: null,
  shown: PAGE_SIZE,
  libraryScroll: 0,
};

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${path}`), { status: res.status });
  return res.json();
}

async function loadLibrary() {
  if (state.books) return;
  const [books, meta, series] = await Promise.all([
    getJSON("api/books.json"),
    getJSON("api/meta.json"),
    getJSON("api/series.json"),
  ]);
  state.books = books;
  state.bySlug = new Map(books.map((b, i) => [b.slug, { ...b, index: i }]));
  state.meta = meta;
  state.series = series;
  const when = new Date(meta.generatedAt);
  document.getElementById("updated").textContent =
    `Ratings last updated ${when.toLocaleDateString(undefined, { day: "numeric", month: "short" })} at ${when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`;
}

async function getBook(slug) {
  if (!state.bookCache.has(slug)) {
    state.bookCache.set(slug, getJSON(`api/books/${encodeURIComponent(slug)}.json`).catch((err) => {
      state.bookCache.delete(slug);
      throw err;
    }));
  }
  return state.bookCache.get(slug);
}

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const level = (avg) => Math.min(5, Math.max(1, Math.round(avg)));
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const chapterName = (c) => c.label || `Chapter ${c.number}`;
const warningName = (id) => state.meta?.warningTypes?.find((w) => w.id === id)?.name ?? "Content warning";

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

async function share(title, hash) {
  const url = `${location.origin}${location.pathname}${hash}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {}
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    prompt("Copy this link", url);
  }
}

function numberedCover(index, cls = "") {
  const n = String((index ?? 0) + 1).padStart(2, "0");
  return `<div class="cover cover-num v${(index ?? 0) % 3} ${cls}" aria-hidden="true">${n}</div>`;
}

function cover(book, index, cls = "") {
  if (!book.cover) return numberedCover(index, cls);
  return `<img class="cover ${cls}" src="${esc(book.cover)}" alt="Cover of ${esc(book.title)}" loading="lazy" decoding="async" data-index="${index ?? 0}">`;
}

// Covers come from Open Library; fall back to the site's numbered tile
// when one is missing or the phone is offline.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.classList.contains("cover")) {
    img.outerHTML = numberedCover(Number(img.dataset.index), [...img.classList].filter((c) => c !== "cover").join(" "));
  }
}, true);

const seriesLabel = (s) => (s ? (s.number ? `${esc(s.title)} · Book ${esc(s.number)}` : esc(s.title)) : "");

const ICON = {
  search: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`,
  back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,
  eyeOff: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10.73 5.08A10.74 10.74 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"/><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/><path d="m2 2 20 20"/></svg>`,
  share: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg>`,
  filter: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M7 12h10M10 18h4"/></svg>`,
  x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
};

// ---------- moods and verdicts (same thresholds and wording as the main site) ----------

const MOODS = [
  { id: "fine", label: "I'm doing fine!", short: "Doing fine", goBelow: 4, cautionBelow: 4.5 },
  { id: "fragile", label: "I'm a little fragile", short: "A little fragile", goBelow: 2.5, cautionBelow: 4 },
  { id: "devastated", label: "I am emotionally devastated", short: "Devastated", goBelow: 1.5, cautionBelow: 2.5 },
  { id: "enraged", label: "I'm enraged at the state of the world and am reading to cope", short: "Enraged, coping", goBelow: Infinity, cautionBelow: Infinity },
];
const VERDICTS = { go: "Go for it", caution: "Proceed with caution", stop: "Don't do it babe" };

function verdict(moodId, avg) {
  const mood = MOODS.find((m) => m.id === moodId);
  if (!mood || avg === null || avg === undefined) return null;
  return avg < mood.goBelow ? "go" : avg < mood.cautionBelow ? "caution" : "stop";
}

function moodButtons(current) {
  return `<div class="moods">${MOODS.map((m) =>
    `<button type="button" class="btn mood mood-${m.id}" data-mood="${m.id}" aria-pressed="${current === m.id}">${esc(m.label)}</button>`).join("")}</div>`;
}

function bindMoodButtons(root, onChange) {
  root.querySelectorAll("[data-mood]").forEach((btn) =>
    btn.addEventListener("click", () => {
      // Tapping the selected mood again clears it.
      store.set("mood", prefs.mood() === btn.dataset.mood ? null : btn.dataset.mood);
      onChange();
    }),
  );
}

// ---------- book-level judgements used by the library and Discover ----------

const enoughRated = (b) => b.ratedChapters >= Math.max(3, Math.ceil(b.chapters / 2));
const hasAvoided = (b, avoid) => avoid.size > 0 && (b.warningIds ?? []).some((id) => avoid.has(id));
const isGentle = (b) => b.peak !== null && b.peak < 2.5 && enoughRated(b);
const isSafeForMood = (b, mood) =>
  !!mood && Array.isArray(b.levels) && enoughRated(b) && b.levels.every((avg) => avg === null || verdict(mood, avg) === "go");

const PRESETS = {
  safe: { label: "Safe for your mood", test: (b) => isSafeForMood(b, prefs.mood()) },
  gentle: { label: "Gentle reads", test: isGentle },
  avoidfree: { label: "No warnings you avoid", test: (b) => b.ratedChapters > 0 && !hasAvoided(b, prefs.avoid()) },
  devastating: { label: "Most devastating", test: (b) => b.peak !== null && b.ratedChapters >= 3, sort: "saddest" },
};

// A strip with one segment per chapter, coloured by your mood's verdict
// (or by sadness level when no mood is set). Grey = not enough ratings.
function timeline(values, mood, chapters = null) {
  if (!Array.isArray(values) || values.length === 0) return "";
  const segs = values.map((avg, i) => {
    const v = verdict(mood, avg);
    const cls = avg === null || avg === undefined ? "t-none" : v ? `v-${v}` : `s${level(avg)}`;
    if (!chapters) return `<span class="${cls}"></span>`;
    const name = esc(chapterName(chapters[i]));
    const label = avg === null ? `${name}: not enough ratings` : `${name}: ${fmt(avg)}${v ? `, ${VERDICTS[v]}` : ""}`;
    return `<button type="button" class="${cls}" data-jump="${i}" aria-label="${label}" title="${label}"></button>`;
  }).join("");
  return `<div class="timeline${chapters ? " interactive" : ""}"${chapters ? "" : ' aria-hidden="true"'}>${segs}</div>`;
}

// ---------- library ----------

function filteredItems() {
  const q = state.query.trim().toLowerCase();
  const f = prefs.filters();
  const avoid = prefs.avoid();
  const preset = PRESETS[state.preset];
  let list = state.books.filter((b) =>
    (!q || [b.title, b.author, b.series?.title].some((s) => s && s.toLowerCase().includes(q))) &&
    (!preset || preset.test(b)) &&
    (!f.hideSpicy || !b.isSpicy) &&
    (!f.ratedOnly || b.ratedChapters > 0) &&
    (!f.hideAvoided || !hasAvoided(b, avoid)),
  );
  const sort = preset?.sort ?? state.sort;
  if (sort === "az") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "saddest") list = [...list].sort((a, b) => (b.peak ?? -1) - (a.peak ?? -1));
  if (sort === "rated") list = [...list].sort((a, b) => b.votes - a.votes);

  if (!f.groupSeries) return list.map((b) => ({ book: b }));
  const seen = new Set();
  const items = [];
  for (const b of list) {
    if (!b.series) {
      items.push({ book: b });
    } else if (!seen.has(b.series.slug)) {
      seen.add(b.series.slug);
      const s = state.series.find((x) => x.slug === b.series.slug);
      items.push({ book: b, series: s ?? { slug: b.series.slug, title: b.series.title, books: [b] } });
    }
  }
  return items;
}

function bookCard(b, mood = prefs.mood(), avoid = prefs.avoid()) {
  const i = state.bySlug.get(b.slug)?.index ?? 0;
  const flags = [];
  if (b.peak !== null) flags.push(`<span class="peak s${level(b.peak)}" title="Saddest chapter average">Peak ${fmt(b.peak)}</span>`);
  if (hasAvoided(b, avoid)) flags.push(`<span class="flag flag-avoid">Has warnings you avoid</span>`);
  if (b.isSpicy) flags.push(`<span class="flag">Spicy</span>`);
  return `<li><a class="card" href="#/book/${encodeURIComponent(b.slug)}">
    ${cover(b, i)}
    <div class="card-body">
      <h3>${esc(b.title)}</h3>
      <p class="author">${esc(b.author)}</p>
      ${b.series ? `<p class="series-line">${seriesLabel(b.series)}</p>` : ""}
      ${timeline(b.levels, mood)}
      <div class="card-foot"><span>${b.chapters} chapters checked</span>${flags.join("")}</div>
    </div>
  </a></li>`;
}

function seriesCard(s, first) {
  const i = state.bySlug.get(first.slug)?.index ?? 0;
  const n = s.books.length;
  return `<li><a class="card" href="#/series/${encodeURIComponent(s.slug)}">
    ${cover(first, i)}
    <div class="card-body">
      <h3>${esc(s.title)}</h3>
      <p class="author">${esc(first.author)}</p>
      <p class="series-line">Series · ${n} book${n === 1 ? "" : "s"}</p>
      <div class="card-foot"><span>See the whole series</span></div>
    </div>
  </a></li>`;
}

function activeFilterCount() {
  const f = prefs.filters();
  return Object.keys(DEFAULT_FILTERS).filter((k) => f[k]).length;
}

function renderList() {
  const items = filteredItems();
  const el = document.getElementById("book-list");
  const mood = prefs.mood();
  const avoid = prefs.avoid();
  const shown = items.slice(0, state.shown);
  el.innerHTML = shown.length
    ? shown.map((it) => (it.series ? seriesCard(it.series, it.book) : bookCard(it.book, mood, avoid))).join("")
    : `<li class="empty">No books match${state.query ? ` “${esc(state.query)}”` : " these filters"}.</li>`;
  const noun = prefs.filters().groupSeries ? "results" : "books";
  document.getElementById("list-count").textContent = `${items.length} ${items.length === 1 ? noun.replace(/s$/, "") : noun}`;
  document.getElementById("more").hidden = items.length <= state.shown;
  const missing = document.getElementById("missing");
  missing.hidden = !state.query.trim();
  missing.querySelector("a").href = `${SITE}/add-book?title=${encodeURIComponent(state.query.trim())}`;
  const n = activeFilterCount();
  document.getElementById("filters-btn").innerHTML = `${ICON.filter}Filters${n ? ` <span class="count-badge">${n}</span>` : ""}`;
}

async function renderLibrary(params) {
  await loadLibrary();
  if (params.has("sort") || params.has("preset")) {
    state.libraryScroll = 0;
    state.shown = PAGE_SIZE;
  }
  if (params.get("sort")) state.sort = params.get("sort");
  state.preset = PRESETS[params.get("preset")] ? params.get("preset") : null;
  const preset = PRESETS[state.preset];
  const sorts = [["recent", "Recently added"], ["az", "A–Z"], ["saddest", "Saddest"], ["rated", "Most rated"]];
  const f = prefs.filters();
  const toggles = [
    ["hideSpicy", "Hide spicy books"],
    ["ratedOnly", "Only books with ratings"],
    ["hideAvoided", "Hide books with warnings I avoid"],
    ["groupSeries", "Group series together"],
  ];

  view.innerHTML = `
    <section class="hero">
      <div class="hero-mark" aria-hidden="true">?</div>
      <div class="hero-inner">
        <p class="badge">Unofficial mobile reader</p>
        <h1>How Sad?</h1>
        <p class="lede">Chapter sadness ratings from <a href="${SITE}" target="_blank" rel="noopener">How Sad Is This Chapter?</a>, reformatted for your phone. Not affiliated with the original site.</p>
        <label class="search-box">
          ${ICON.search}
          <input id="search" type="search" placeholder="Search a title, author or series" aria-label="Search for a book" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search">
        </label>
      </div>
    </section>
    <section class="section wrap">
      <div class="section-head">
        <div>
          <p class="eyebrow" id="list-count"></p>
          <h2>${preset ? esc(preset.label) : "Current Library"}</h2>
        </div>
        <button type="button" class="btn btn-sm" id="filters-btn"></button>
      </div>
      ${preset ? `<p class="preset-chip"><span>Showing: ${esc(preset.label)}</span><a href="#/" aria-label="Show the whole library">${ICON.x}</a></p>` : ""}
      <div class="toolbar">
        ${preset?.sort ? "" : `<div class="sort" role="group" aria-label="Sort books">
          ${sorts.map(([k, label]) => `<button type="button" class="btn btn-sm" data-sort="${k}" aria-pressed="${state.sort === k}">${label}</button>`).join("")}
        </div>`}
      </div>
      <ul class="cards" id="book-list"></ul>
      <div class="more" id="more"><button type="button" class="btn btn-primary" id="more-btn">Show more</button></div>
      <div class="missing" id="missing" hidden>
        <p class="bold">Not in the library?</p>
        <p class="small">Books are added on the main site. Once it's there, it shows up here after the next update.</p>
        <a class="btn btn-primary" href="${SITE}/add-book" target="_blank" rel="noopener">Add it on How Sad Is This Chapter?</a>
      </div>
    </section>
    <dialog id="filters" class="sheet">
      <h2 class="font-display">Filters</h2>
      ${toggles.map(([k, label]) => `<label class="toggle"><span>${label}</span><input type="checkbox" data-filter="${k}" ${f[k] ? "checked" : ""}></label>`).join("")}
      ${prefs.avoid().size ? "" : `<p class="small muted">Pick warnings to avoid in the <a href="#/me">Me</a> tab to use the warnings filter.</p>`}
      <form method="dialog"><button class="btn btn-primary">Done</button></form>
    </dialog>`;

  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    state.query = search.value;
    state.shown = PAGE_SIZE;
    renderList();
  });
  view.querySelectorAll("[data-sort]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.sort = btn.dataset.sort;
      state.shown = PAGE_SIZE;
      view.querySelectorAll("[data-sort]").forEach((b) => b.setAttribute("aria-pressed", b === btn));
      renderList();
    }),
  );
  const sheet = document.getElementById("filters");
  document.getElementById("filters-btn").addEventListener("click", () => sheet.showModal());
  sheet.querySelectorAll("[data-filter]").forEach((box) =>
    box.addEventListener("change", () => {
      store.set("filters", { ...prefs.filters(), [box.dataset.filter]: box.checked });
      state.shown = PAGE_SIZE;
      renderList();
    }),
  );
  sheet.addEventListener("click", (e) => e.target === sheet && sheet.close());
  document.getElementById("more-btn").addEventListener("click", () => {
    state.shown += PAGE_SIZE;
    renderList();
  });
  renderList();
  requestAnimationFrame(() => window.scrollTo(0, state.libraryScroll));
}

// ---------- book ----------

function dnfText(d) {
  if (!d || typeof d !== "object") return null;
  const total = d.total ?? d.readers ?? d.totalReaders ?? d.count;
  const bailed = d.bailed ?? d.dnf ?? d.dnfCount ?? d.bailedCount;
  let pct = d.percent ?? d.dnfPercent ?? d.percentage ?? d.rate;
  if (typeof pct === "number" && pct <= 1 && d.rate !== undefined) pct *= 100;
  if (typeof pct !== "number" && typeof bailed === "number" && typeof total === "number" && total > 0) pct = (bailed / total) * 100;
  if (typeof pct !== "number") return null;
  return `${Math.round(pct)}% of ${typeof total === "number" ? `${total} ` : ""}readers who logged this book bailed on it.`;
}

function chapterCard(book, c, i, ctx) {
  const { here, showWarnings, mood, avoid, minVotes } = ctx;
  const avg = c.average;
  const s = avg !== null ? level(avg) : 0;
  const count = avg !== null
    ? `${c.votes} rating${c.votes === 1 ? "" : "s"}`
    : `${c.votes} of ${minVotes} ratings needed for an average`;
  const meter = Array.from({ length: 5 }, (_, k) => `<span class="${avg !== null && k < s ? `s${s}` : ""}"></span>`).join("");
  let verdictHtml;
  if (mood === null) {
    verdictHtml = `<p class="verdict-hint">Pick your mood above and we'll tell you if you can handle this one.</p>`;
  } else {
    const v = verdict(mood, avg);
    verdictHtml = v
      ? `<p class="verdict v-${v}" role="status">${VERDICTS[v]}</p>`
      : `<p class="verdict-hint">Not enough ratings for a verdict yet.</p>`;
  }
  const avoided = c.warnings.filter((w) => avoid.has(w.id));
  let cw;
  if (showWarnings) {
    cw = c.warnings.length
      ? `<div class="cw-list">${c.warnings.map((w) => `<span class="${avoid.has(w.id) ? "is-avoided" : ""}">${esc(warningName(w.id))}</span>`).join("")}</div>`
      : `<p class="cw-none">No warnings flagged by enough readers yet.</p>`;
  } else if (avoided.length) {
    // You asked to be told about these, so they show even with spoilers hidden.
    cw = `<div class="cw-list">${avoided.map((w) => `<span class="is-avoided">${esc(warningName(w.id))}</span>`).join("")}</div>
      <div class="cw-hidden">${ICON.eyeOff}Other warnings are hidden until you ask.</div>`;
  } else {
    cw = `<div class="cw-hidden">${ICON.eyeOff}Spoilers are hidden until you ask.</div>`;
  }
  const cls = here === null ? "" : i === here ? "here" : i < here ? "past" : "";
  return `<article class="chapter ${cls}" id="ch-${i}">
    <div class="chapter-head">
      <div>
        <h3>${esc(chapterName(c))}</h3>
        <p class="count">${count}</p>
      </div>
      <div class="avg" aria-label="${avg !== null ? `Average sadness ${fmt(avg)} out of 5` : "Average sadness rating not available"}">
        <span class="num">${avg !== null ? fmt(avg) : "?"}</span><span class="lbl">Average</span>
      </div>
    </div>
    <div class="meter" aria-hidden="true">${meter}</div>
    <div class="chapter-row">${verdictHtml}<button type="button" class="icon-btn" data-share-ch="${i}" aria-label="Share ${esc(chapterName(c))}">${ICON.share}</button></div>
    <div class="cw"><p class="cw-title">Content warnings${avoided.length ? ` <span class="avoid-tag">${avoided.length} you avoid</span>` : ""}</p>${cw}</div>
  </article>`;
}

function aheadSummary(book, here, mood, worst) {
  const rest = book.chapters.slice(here).filter((c) => c.average !== null);
  if (!rest.length) return `<p class="ahead unknown">No chapters from here on have enough ratings yet.</p>`;
  const top = rest.reduce((a, b) => (b.average > a.average ? b : a));
  const label = esc(chapterName(top));
  const v = verdict(mood, top.average);
  if (v === "stop" || (!mood && top.average >= worst)) {
    return `<p class="ahead hot">Brace yourself: the saddest part still ahead is <strong>${label}</strong> (${fmt(top.average)}).</p>`;
  }
  return `<p class="ahead ok">The saddest part still ahead is <strong>${label}</strong> at ${fmt(top.average)}.${mood ? ` ${VERDICTS[v]}.` : ""}</p>`;
}

function nextChapters(book, here, mood, n = 3) {
  return `<ol class="next">${book.chapters.slice(here, here + n).map((c) => {
    const v = verdict(mood, c.average);
    const cls = c.average === null ? "t-none" : v ? `v-${v}` : `s${level(c.average)}`;
    const text = c.average === null ? "?" : fmt(c.average);
    return `<li class="${cls}"><span class="next-name">${esc(chapterName(c))}</span><span class="next-score">${text}${v ? ` · ${VERDICTS[v]}` : ""}</span></li>`;
  }).join("")}</ol>`;
}

async function renderBook(slug, jumpTo) {
  await loadLibrary();
  let book;
  try {
    book = await getBook(slug);
  } catch (err) {
    view.innerHTML = `<div class="wrap"><p class="empty">${err.status === 404 ? "We couldn't find that book." : "Couldn't load this book. Check your connection and try again."}</p><p class="empty"><a class="btn btn-primary" href="#/">Back to the library</a></p></div>`;
    return;
  }

  const t = state.meta.thresholds ?? {};
  const minVotes = t.sadnessMinVotes ?? 5;
  const worst = t.worstAhead ?? 4.5;
  const limited = Math.max(0, ...book.chapters.map((c) => c.votes)) < (t.sadnessLimitedDataVotes ?? 50);
  const index = state.bySlug.get(book.slug)?.index ?? 0;
  const bookHash = `#/book/${encodeURIComponent(book.slug)}`;

  const draw = () => {
    const entry = prefs.shelf()[book.slug] ?? {};
    const here = entry.chapter ?? null;
    const status = entry.status ?? null;
    const mood = prefs.mood();
    const avoid = prefs.avoid();
    const showWarnings = prefs.showWarnings();
    const avoidedChapters = book.chapters.filter((c) => c.warnings.some((w) => avoid.has(w.id)));
    const dnf = dnfText(book.dnf);
    const statuses = [["reading", "Reading"], ["finished", "Finished"], ["bailed", "Bailed"]];

    view.innerHTML = `
      <section class="hero book-hero">
        <div class="hero-inner">
          ${cover(book, index)}
          <div>
            <a href="#/" class="back">${ICON.back}Library</a>
            <p class="badge">Spoiler-light check</p>
            <h1>${esc(book.title)}</h1>
            <p class="by">by ${esc(book.author)}</p>
            ${book.series ? `<p class="part-of">Part of the <a href="#/series/${encodeURIComponent(book.series.slug)}">${esc(book.series.title)} series</a></p>` : ""}
            <div class="hero-actions">
              <a class="btn btn-sm" href="${SITE}/book/${encodeURIComponent(book.slug)}?mode=rate" target="_blank" rel="noopener">Rate this book</a>
              <a class="btn btn-sm" href="${SITE}/book/${encodeURIComponent(book.slug)}" target="_blank" rel="noopener">Open on site</a>
              <button type="button" class="btn btn-sm" id="share-book">${ICON.share}Share</button>
            </div>
          </div>
        </div>
      </section>
      <div class="book-body">
        ${limited ? `<p class="note" role="note">Warning: this book has limited ratings, so these averages may change.</p>` : ""}
        ${dnf ? `<p class="note dnf" role="note">${esc(dnf)}</p>` : ""}
        ${avoidedChapters.length ? `<p class="note avoid-note" role="note">${avoidedChapters.length} chapter${avoidedChapters.length === 1 ? " has" : "s have"} warnings you avoid: ${avoidedChapters.slice(0, 6).map((c) => esc(chapterName(c))).join(", ")}${avoidedChapters.length > 6 ? "…" : ""}.</p>` : ""}

        ${book.chapters.length ? `<section class="panel">
          <h2 class="legend-title">Sadness through the book</h2>
          ${timeline(book.chapters.map((c) => c.average), mood, book.chapters)}
          <p class="timeline-key">${mood ? `Coloured for “${esc(MOODS.find((m) => m.id === mood).short)}”: green go, yellow caution, red don't.` : "Greener is gentler, redder is sadder."} Grey: not enough ratings. Tap a chapter to jump to it.</p>
        </section>` : ""}

        <fieldset class="panel">
          <legend>First things first</legend>
          <h2>How are you doing right now?</h2>
          <p>Choose how you're feeling and we'll tell you if you can handle each chapter.</p>
          ${moodButtons(mood)}
        </fieldset>

        <fieldset class="panel">
          <legend>Where are you at?</legend>
          <div class="segmented" role="group" aria-label="Reading status">
            ${statuses.map(([k, label]) => `<button type="button" class="btn btn-sm" data-status="${k}" aria-pressed="${status === k}">${label}</button>`).join("")}
          </div>
          <select id="here" aria-label="Chapter you're on">
            <option value="">Haven't started / just browsing</option>
            ${book.chapters.map((c, i) => `<option value="${i}" ${here === i ? "selected" : ""}>${esc(chapterName(c))}</option>`).join("")}
          </select>
          ${here !== null && book.chapters[here] ? `${aheadSummary(book, here, mood, worst)}<p class="next-title">Next up</p>${nextChapters(book, here, mood)}` : ""}
        </fieldset>

        <fieldset class="panel">
          <legend>Spoiler comfort</legend>
          <div class="two">
            <button type="button" class="btn" data-cw="0" aria-pressed="${!showWarnings}">Hide content warnings</button>
            <button type="button" class="btn" data-cw="1" aria-pressed="${showWarnings}">Show content warnings</button>
          </div>
        </fieldset>

        <div class="chapters">
          ${book.chapters.length
            ? book.chapters.map((c, i) => chapterCard(book, c, i, { here, showWarnings, mood, avoid, minVotes })).join("")
            : `<p class="empty">No chapters listed for this book yet.</p>`}
        </div>
        <div class="rate-cta">
          <a class="btn btn-primary" href="${SITE}/book/${encodeURIComponent(book.slug)}?mode=rate" target="_blank" rel="noopener">Read it already? Add your ratings</a>
        </div>
      </div>`;

    const keepScroll = (fn) => () => {
      const y = window.scrollY;
      fn();
      draw();
      window.scrollTo(0, y);
    };
    bindMoodButtons(view, keepScroll(() => {}));
    document.getElementById("here").addEventListener("change", (e) => {
      const v = e.target.value;
      const cur = prefs.shelf()[book.slug] ?? {};
      updateShelf(book.slug, { chapter: v === "" ? null : Number(v), status: v === "" ? cur.status : cur.status ?? "reading" });
      draw();
      if (v !== "") document.getElementById(`ch-${v}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    view.querySelectorAll("[data-status]").forEach((btn) =>
      btn.addEventListener("click", keepScroll(() => {
        const cur = prefs.shelf()[book.slug]?.status;
        updateShelf(book.slug, { status: cur === btn.dataset.status ? undefined : btn.dataset.status });
      })),
    );
    view.querySelectorAll("[data-cw]").forEach((btn) =>
      btn.addEventListener("click", keepScroll(() => store.set("show-warnings", btn.dataset.cw === "1"))),
    );
    view.querySelectorAll("[data-jump]").forEach((btn) =>
      btn.addEventListener("click", () =>
        document.getElementById(`ch-${btn.dataset.jump}`)?.scrollIntoView({ behavior: "smooth", block: "start" })),
    );
    document.getElementById("share-book").addEventListener("click", () => share(`${book.title} — How sad is it?`, bookHash));
    view.querySelectorAll("[data-share-ch]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.shareCh);
        share(`${book.title}: ${chapterName(book.chapters[i])}`, `${bookHash}/${i + 1}`);
      }),
    );
  };

  draw();
  const target = jumpTo ? document.getElementById(`ch-${jumpTo - 1}`) : null;
  if (target) {
    target.scrollIntoView({ block: "start" });
    target.classList.add("flash");
  } else {
    window.scrollTo(0, 0);
  }
}

// ---------- series ----------

async function renderSeries(slug) {
  await loadLibrary();
  const series = state.series.find((s) => s.slug === slug);
  if (!series) {
    view.innerHTML = `<div class="wrap"><p class="empty">We couldn't find that series.</p></div>`;
    return;
  }
  const books = series.books.map((s) => state.bySlug.get(s.slug)).filter(Boolean);
  view.innerHTML = `
    <section class="hero">
      <div class="hero-mark" aria-hidden="true">?</div>
      <div class="hero-inner">
        <a href="#/" class="back">${ICON.back}Library</a>
        <p class="badge">Series</p>
        <h1>${esc(series.title)}</h1>
        <p class="lede">${books.length} book${books.length === 1 ? "" : "s"} with chapter ratings.</p>
      </div>
    </section>
    <section class="section wrap">
      <ul class="cards">${books.map((b) => bookCard(b)).join("")}</ul>
    </section>`;
  window.scrollTo(0, 0);
}

// ---------- reading ----------

async function renderReading() {
  await loadLibrary();
  const shelf = prefs.shelf();
  const mood = prefs.mood();
  const worst = state.meta.thresholds?.worstAhead ?? 4.5;
  const entries = Object.entries(shelf)
    .filter(([slug]) => state.bySlug.has(slug))
    .sort((a, b) => (b[1].updated ?? 0) - (a[1].updated ?? 0));
  const reading = entries.filter(([, e]) => e.status === "reading" || (!e.status && e.chapter !== null && e.chapter !== undefined));
  const finished = entries.filter(([, e]) => e.status === "finished");
  const bailed = entries.filter(([, e]) => e.status === "bailed");

  view.innerHTML = `
    <section class="page-head wrap">
      <p class="eyebrow">Your shelf</p>
      <h1 class="font-display">Reading</h1>
      ${mood ? `<p class="small muted">Verdicts for “${esc(MOODS.find((m) => m.id === mood).short)}”. <a href="#/me">Change mood</a></p>`
             : `<p class="small muted"><a href="#/me">Set your mood</a> to see go / caution / don't verdicts here.</p>`}
    </section>
    <section class="wrap shelf">
      ${reading.length ? `<div id="reading-list" class="reading-list"><p class="loading">Loading your books…</p></div>`
        : `<div class="panel empty-shelf"><h2>Nothing on your shelf yet</h2><p>Open a book and pick the chapter you're on, or tap “Reading”. It'll show up here with what's coming next.</p><a class="btn btn-primary" href="#/">Browse the library</a></div>`}
      ${finished.length ? `<h2 class="shelf-title">Finished</h2><ul class="cards">${finished.map(([slug]) => bookCard(state.bySlug.get(slug))).join("")}</ul>` : ""}
      ${bailed.length ? `<h2 class="shelf-title">Bailed</h2><ul class="cards">${bailed.map(([slug]) => bookCard(state.bySlug.get(slug))).join("")}</ul>` : ""}
    </section>`;
  window.scrollTo(0, 0);
  if (!reading.length) return;

  const cards = await Promise.all(reading.map(async ([slug, e]) => {
    const summary = state.bySlug.get(slug);
    let book;
    try {
      book = await getBook(slug);
    } catch {
      return bookCard(summary);
    }
    const here = e.chapter ?? null;
    const progress = here !== null && book.chapters[here]
      ? `<p class="progress">On ${esc(chapterName(book.chapters[here]))} · ${here + 1} of ${book.chapters.length}</p>
         ${nextChapters(book, here, mood)}
         ${aheadSummary(book, here, mood, worst)}`
      : `<p class="progress">Pick the chapter you're on to see what's next.</p>`;
    return `<article class="reading-card">
      <a class="reading-top" href="#/book/${encodeURIComponent(slug)}">
        ${cover(summary, summary.index)}
        <div>
          <h3>${esc(book.title)}</h3>
          <p class="author">${esc(book.author)}</p>
          ${timeline(book.chapters.map((c) => c.average), mood)}
        </div>
      </a>
      ${progress}
    </article>`;
  }));
  const list = document.getElementById("reading-list");
  if (list) list.innerHTML = cards.join("");
}

// ---------- discover ----------

async function renderDiscover() {
  await loadLibrary();
  const mood = prefs.mood();
  const avoid = prefs.avoid();
  const byVotes = (a, b) => b.votes - a.votes;
  const take = (fn, sort = byVotes, n = 6) => state.books.filter(fn).sort(sort).slice(0, n);

  const sections = [];
  if (mood) {
    sections.push({ key: "safe", title: "Safe for your mood", sub: `Every rated chapter is a “go” when you're ${esc(MOODS.find((m) => m.id === mood).short.toLowerCase())}.`, books: take((b) => isSafeForMood(b, mood)) });
  } else {
    sections.push({ prompt: `<a href="#/me">Set your mood</a> to get books that are safe for how you feel right now.`, title: "Safe for your mood" });
  }
  sections.push({ key: "gentle", title: "Gentle reads", sub: "No chapter averages above 2.5.", books: take(isGentle) });
  if (avoid.size) {
    sections.push({ key: "avoidfree", title: "No warnings you avoid", sub: "Rated books where readers haven't flagged any of your avoided warnings.", books: take((b) => b.ratedChapters > 0 && !hasAvoided(b, avoid)) });
  } else {
    sections.push({ prompt: `<a href="#/me">Pick warnings to avoid</a> and we'll find books without them.`, title: "No warnings you avoid" });
  }
  sections.push({ key: "devastating", title: "Bring tissues", sub: "The saddest single chapters in the library.", books: take(PRESETS.devastating.test, (a, b) => b.peak - a.peak) });
  sections.push({ href: "#/?sort=rated", title: "Most rated", sub: "Where the ratings are most reliable.", books: take((b) => b.votes > 0) });

  view.innerHTML = `
    <section class="page-head wrap">
      <p class="eyebrow">Find your next read</p>
      <h1 class="font-display">Discover</h1>
    </section>
    <div class="wrap discover">
      ${sections.map((s) => `
        <section class="disc-section">
          <div class="disc-head">
            <div><h2 class="font-display">${s.title}</h2>${s.sub ? `<p class="small muted">${s.sub}</p>` : ""}</div>
            ${s.books?.length ? `<a class="btn btn-sm" href="${s.href ?? `#/?preset=${s.key}`}">See all</a>` : ""}
          </div>
          ${s.prompt ? `<p class="panel prompt">${s.prompt}</p>`
            : s.books.length ? `<ul class="cards">${s.books.map((b) => bookCard(b, mood, avoid)).join("")}</ul>`
            : `<p class="small muted">Nothing here yet. Check back as more chapters get rated.</p>`}
        </section>`).join("")}
    </div>`;
  window.scrollTo(0, 0);
}

// ---------- me ----------

function applyTheme(choice) {
  if (choice === "system") {
    try { localStorage.removeItem("sadness-theme"); } catch {}
  } else {
    try { localStorage.setItem("sadness-theme", choice); } catch {}
  }
  const dark = choice === "system" ? matchMedia("(prefers-color-scheme: dark)").matches : choice === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
const currentTheme = () => {
  try { return localStorage.getItem("sadness-theme") ?? "system"; } catch { return "system"; }
};
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (currentTheme() === "system") applyTheme("system");
});

function applyTextSize(size) {
  const root = document.documentElement;
  root.classList.remove("text-large", "text-xl");
  if (size && size !== "normal") root.classList.add(`text-${size}`);
}

async function renderMe() {
  await loadLibrary();
  const draw = () => {
    const mood = prefs.mood();
    const avoid = prefs.avoid();
    const size = store.get("text-size", "normal");
    const theme = currentTheme();
    const types = state.meta.warningTypes ?? [];
    view.innerHTML = `
      <section class="page-head wrap">
        <p class="eyebrow">Settings</p>
        <h1 class="font-display">Me</h1>
        <p class="small muted">Everything here stays on this device. No account needed.</p>
      </section>
      <div class="wrap settings">
        <fieldset class="panel">
          <legend>Your mood</legend>
          <p>Used for the go / caution / don't verdicts everywhere in the app.</p>
          ${moodButtons(mood)}
        </fieldset>

        <fieldset class="panel">
          <legend>Warnings you want to avoid</legend>
          <p>Books and chapters with these get flagged, even when other spoilers are hidden. Only warnings enough readers agree on are counted.</p>
          <div class="checks">
            ${types.map((w) => `<label class="toggle"><span>${esc(w.name)}</span><input type="checkbox" data-avoid="${esc(w.id)}" ${avoid.has(w.id) ? "checked" : ""}></label>`).join("")}
          </div>
        </fieldset>

        <fieldset class="panel">
          <legend>Spoilers</legend>
          <label class="toggle"><span>Show content warnings by default</span><input type="checkbox" id="show-warnings" ${prefs.showWarnings() ? "checked" : ""}></label>
        </fieldset>

        <fieldset class="panel">
          <legend>Text size</legend>
          <div class="segmented" role="group" aria-label="Text size">
            ${[["normal", "Normal"], ["large", "Large"], ["xl", "Extra large"]].map(([k, l]) => `<button type="button" class="btn btn-sm" data-size="${k}" aria-pressed="${size === k}">${l}</button>`).join("")}
          </div>
        </fieldset>

        <fieldset class="panel">
          <legend>Theme</legend>
          <div class="segmented" role="group" aria-label="Theme">
            ${[["light", "Light"], ["dark", "Dark"], ["system", "Match phone"]].map(([k, l]) => `<button type="button" class="btn btn-sm" data-theme="${k}" aria-pressed="${theme === k}">${l}</button>`).join("")}
          </div>
        </fieldset>

        <fieldset class="panel">
          <legend>Your data</legend>
          <p>Move your shelf and settings to another phone or browser.</p>
          <div class="two">
            <button type="button" class="btn" id="export">Export</button>
            <button type="button" class="btn" id="import">Import</button>
          </div>
          <input type="file" id="import-file" accept="application/json,.json" hidden>
          <button type="button" class="btn btn-sm danger" id="reset">Clear everything on this device</button>
        </fieldset>

        <section class="panel about">
          <h2 class="legend-title">About this app</h2>
          <p>An independent, fan-made front end for <a href="${SITE}" target="_blank" rel="noopener">How Sad Is This Chapter?</a>. It is <strong>not</strong> made, run, affiliated with or endorsed by that site or its creator.</p>
          <p>All credit for the site, its idea and its design belongs to its creator, and every rating comes from readers on the original site. To rate a book or add one, use the main site.</p>
          <p>Spotted a problem with a rating or book? Report it on the original site. Problems with this app have nothing to do with them.</p>
          <p>To use it like an app, add it to your home screen from your browser's share or menu button.</p>
          <a class="btn btn-primary" href="https://ko-fi.com/catieosaurus" target="_blank" rel="noopener">Tip the original creator</a>
        </section>
      </div>`;

    bindMoodButtons(view, keepY(draw));
    view.querySelectorAll("[data-avoid]").forEach((box) =>
      box.addEventListener("change", () => {
        const set = prefs.avoid();
        box.checked ? set.add(box.dataset.avoid) : set.delete(box.dataset.avoid);
        store.set("avoid", [...set]);
      }),
    );
    document.getElementById("show-warnings").addEventListener("change", (e) => store.set("show-warnings", e.target.checked));
    view.querySelectorAll("[data-size]").forEach((btn) =>
      btn.addEventListener("click", keepY(() => {
        store.set("text-size", btn.dataset.size === "normal" ? null : btn.dataset.size);
        applyTextSize(btn.dataset.size);
        draw();
      })),
    );
    view.querySelectorAll("[data-theme]").forEach((btn) =>
      btn.addEventListener("click", keepY(() => {
        applyTheme(btn.dataset.theme);
        draw();
      })),
    );
    document.getElementById("export").addEventListener("click", () => {
      const data = { app: "how-sad-unofficial", version: 1, exportedAt: new Date().toISOString(), items: {} };
      for (const k of DATA_KEYS) {
        try {
          const v = localStorage.getItem(k);
          if (v !== null) data.items[k] = v;
        } catch {}
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "how-sad-data.json" });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const file = document.getElementById("import-file");
    document.getElementById("import").addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      try {
        const data = JSON.parse(await file.files[0].text());
        if (data?.app !== "how-sad-unofficial" || typeof data.items !== "object") throw new Error("Not a How Sad? export");
        for (const k of DATA_KEYS) {
          if (typeof data.items[k] === "string") localStorage.setItem(k, data.items[k]);
        }
        applyTheme(currentTheme());
        applyTextSize(store.get("text-size", "normal"));
        toast("Imported");
        draw();
      } catch (err) {
        toast(`Couldn't import: ${err.message}`);
      }
    });
    document.getElementById("reset").addEventListener("click", () => {
      if (!confirm("Clear your shelf, mood and settings on this device?")) return;
      for (const k of DATA_KEYS) {
        try { localStorage.removeItem(k); } catch {}
      }
      applyTheme("system");
      applyTextSize("normal");
      toast("Cleared");
      draw();
    });
  };
  draw();
  window.scrollTo(0, 0);
}

function keepY(fn) {
  return () => {
    const y = window.scrollY;
    fn();
    window.scrollTo(0, y);
  };
}

// ---------- routing ----------

function setTab(tab) {
  document.querySelectorAll(".tabbar [data-tab]").forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

async function route() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  const [, kind, slug, extra] = path.split("/");
  try {
    if (kind === "book" && slug) {
      setTab("library");
      await renderBook(decodeURIComponent(slug), Number(extra) || null);
    } else if (kind === "series" && slug) {
      setTab("library");
      await renderSeries(decodeURIComponent(slug));
    } else if (kind === "reading") {
      setTab("reading");
      await renderReading();
    } else if (kind === "discover") {
      setTab("discover");
      await renderDiscover();
    } else if (kind === "me") {
      setTab("me");
      await renderMe();
    } else {
      setTab("library");
      await renderLibrary(params);
    }
  } catch (err) {
    console.error(err);
    view.innerHTML = err.status === 404
      ? `<div class="wrap"><p class="empty">The library is still being built. The first update takes about 10–15 minutes. Check back soon.</p></div>`
      : `<div class="wrap"><p class="empty">Couldn't load the library. Check your connection and try again.</p></div>`;
  }
}

let lastRoute = location.hash;
window.addEventListener("hashchange", () => {
  // Leaving the library: remember where you were in the list.
  if (!lastRoute || lastRoute === "#/" || lastRoute.startsWith("#/?")) state.libraryScroll = state.lastLibraryY ?? 0;
  lastRoute = location.hash;
  route();
});
window.addEventListener("scroll", () => {
  const h = location.hash;
  if (!h || h === "#/" || h.startsWith("#/?")) state.lastLibraryY = window.scrollY;
}, { passive: true });

// Tapping the active tab again scrolls back to the top.
document.querySelectorAll(".tabbar [data-tab]").forEach((a) =>
  a.addEventListener("click", (e) => {
    if (a.getAttribute("aria-current") === "page" && location.hash === a.getAttribute("href")) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }),
);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

route();

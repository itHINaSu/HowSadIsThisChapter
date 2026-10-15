// How Sad? — a phone-friendly reader for howsadisthischapter.com data.
// Reads the static JSON built by scripts/build-data.mjs from ./api/.

const SITE = "https://howsadisthischapter.com";
const PAGE_SIZE = 30;
const view = document.getElementById("view");

const state = {
  books: null,
  meta: null,
  series: null,
  query: "",
  sort: "recent",
  shown: PAGE_SIZE,
  homeScroll: 0,
};

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

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
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
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
  state.meta = meta;
  state.series = series;
  const when = new Date(meta.generatedAt);
  document.getElementById("updated").textContent =
    `Ratings last updated ${when.toLocaleDateString(undefined, { day: "numeric", month: "short" })} at ${when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`;
}

const level = (avg) => Math.min(5, Math.max(1, Math.round(avg)));
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

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
    img.outerHTML = numberedCover(Number(img.dataset.index), "");
  }
}, true);

function seriesLabel(s) {
  if (!s) return "";
  return s.number ? `${esc(s.title)} · Book ${esc(s.number)}` : esc(s.title);
}

const ICON_SEARCH = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;
const ICON_BACK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;
const ICON_EYE_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10.73 5.08A10.74 10.74 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"/><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/><path d="m2 2 20 20"/></svg>`;

// ---------- home ----------

function filteredBooks() {
  const q = state.query.trim().toLowerCase();
  let list = state.books;
  if (q) {
    list = list.filter((b) =>
      [b.title, b.author, b.series?.title].some((f) => f && f.toLowerCase().includes(q)),
    );
  }
  const sorted = [...list];
  if (state.sort === "az") sorted.sort((a, b) => a.title.localeCompare(b.title));
  if (state.sort === "saddest") sorted.sort((a, b) => (b.peak ?? -1) - (a.peak ?? -1));
  if (state.sort === "rated") sorted.sort((a, b) => b.votes - a.votes);
  return sorted;
}

function bookCard(b, i) {
  const peak = b.peak !== null
    ? `<span class="peak s${level(b.peak)}" title="Saddest chapter average">Peak ${fmt(b.peak)}</span>`
    : "";
  return `<li><a class="card" href="#/book/${encodeURIComponent(b.slug)}">
    ${cover(b, i)}
    <div class="card-body">
      <h3>${esc(b.title)}</h3>
      <p class="author">${esc(b.author)}</p>
      ${b.series ? `<p class="series-line">${seriesLabel(b.series)}</p>` : ""}
      <div class="card-foot"><span>${b.chapters} chapters checked</span>${peak}</div>
    </div>
  </a></li>`;
}

function renderList() {
  const list = filteredBooks();
  const el = document.getElementById("book-list");
  const shown = list.slice(0, state.shown);
  el.innerHTML = shown.length
    ? shown.map(bookCard).join("")
    : `<li class="empty">No books match “${esc(state.query)}”. Add it on <a href="${SITE}/add-book" target="_blank" rel="noopener">the main site</a>.</li>`;
  document.getElementById("list-count").textContent = state.query
    ? `${list.length} match${list.length === 1 ? "" : "es"}`
    : `${list.length} books`;
  document.getElementById("more").hidden = list.length <= state.shown;
}

async function renderHome() {
  await loadLibrary();
  const sorts = [
    ["recent", "Recently added"],
    ["az", "A–Z"],
    ["saddest", "Saddest"],
    ["rated", "Most rated"],
  ];
  view.innerHTML = `
    <section class="hero">
      <div class="hero-mark" aria-hidden="true">?</div>
      <div class="hero-inner">
        <p class="badge">Crowdsourcing emotional regulation, one book at a time</p>
        <h1>How Sad Is This Chapter</h1>
        <p class="lede">Find out how emotionally devastating a chapter is before you read it.</p>
        <label class="search-box">
          ${ICON_SEARCH}
          <input id="search" type="search" placeholder="Search a title, author or series" aria-label="Search for a book" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search">
        </label>
      </div>
    </section>
    <section class="section wrap">
      <div class="section-head">
        <div>
          <p class="eyebrow" id="list-count"></p>
          <h2>Current Library</h2>
        </div>
      </div>
      <div class="sort" role="group" aria-label="Sort books">
        ${sorts.map(([k, label]) => `<button type="button" class="btn btn-sm" data-sort="${k}" aria-pressed="${state.sort === k}">${label}</button>`).join("")}
      </div>
      <ul class="cards" id="book-list"></ul>
      <div class="more" id="more"><button type="button" class="btn btn-primary" id="more-btn">Show more</button></div>
    </section>`;

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
  document.getElementById("more-btn").addEventListener("click", () => {
    state.shown += PAGE_SIZE;
    renderList();
  });
  renderList();
  requestAnimationFrame(() => window.scrollTo(0, state.homeScroll));
}

// ---------- book ----------

function chapterCard(c, i, here, showWarnings, warningNames, minVotes) {
  const avg = c.average;
  const s = avg !== null ? level(avg) : 0;
  const count = avg !== null
    ? `${c.votes} rating${c.votes === 1 ? "" : "s"}`
    : `${c.votes} of ${minVotes} ratings needed for an average`;
  const meter = Array.from({ length: 5 }, (_, k) => `<span class="${avg !== null && k < s ? `s${s}` : ""}"></span>`).join("");
  let cw;
  if (!showWarnings) {
    cw = `<div class="cw-hidden">${ICON_EYE_OFF}Spoilers are hidden until you ask.</div>`;
  } else if (c.warnings.length) {
    cw = `<div class="cw-list">${c.warnings.map((w) => `<span>${esc(warningNames.get(w.id) ?? "Content warning")}</span>`).join("")}</div>`;
  } else {
    cw = `<p class="cw-none">No warnings flagged by enough readers yet.</p>`;
  }
  const cls = here === null ? "" : i === here ? "here" : i < here ? "past" : "";
  return `<article class="chapter ${cls}" id="ch-${i}">
    <div class="chapter-head">
      <div>
        <h3>${esc(c.label || `Chapter ${c.number}`)}</h3>
        <p class="count">${count}</p>
      </div>
      <div class="avg" aria-label="${avg !== null ? `Average sadness ${fmt(avg)} out of 5` : "Average sadness rating not available"}">
        <span class="num">${avg !== null ? fmt(avg) : "?"}</span><span class="lbl">Average</span>
      </div>
    </div>
    <div class="meter" aria-hidden="true">${meter}</div>
    <div class="cw"><p class="cw-title">Content warnings</p>${cw}</div>
  </article>`;
}

async function renderBook(slug) {
  await loadLibrary();
  let book;
  try {
    book = await getJSON(`api/books/${encodeURIComponent(slug)}.json`);
  } catch (err) {
    view.innerHTML = `<div class="wrap"><p class="empty">${err.status === 404 ? "We couldn't find that book." : "Couldn't load this book. Check your connection and try again."}</p><p class="empty"><a class="btn btn-primary" href="#/">Back to the library</a></p></div>`;
    return;
  }

  const t = state.meta.thresholds ?? {};
  const minVotes = t.sadnessMinVotes ?? 5;
  const worst = t.worstAhead ?? 4.5;
  const limited = Math.max(0, ...book.chapters.map((c) => c.votes)) < (t.sadnessLimitedDataVotes ?? 50);
  const warningNames = new Map((state.meta.warningTypes ?? []).map((w) => [w.id, w.name]));
  const hereKey = `here:${book.slug}`;
  const index = state.books.findIndex((b) => b.slug === book.slug);

  const draw = () => {
    const here = store.get(hereKey, null);
    const showWarnings = store.get("show-warnings", false);

    let ahead = "";
    if (here !== null && book.chapters[here]) {
      const rest = book.chapters.slice(here).filter((c) => c.average !== null);
      if (!rest.length) {
        ahead = `<p class="ahead unknown">No chapters from here on have enough ratings yet.</p>`;
      } else {
        const top = rest.reduce((a, b) => (b.average > a.average ? b : a));
        const label = esc(top.label || `Chapter ${top.number}`);
        ahead = top.average >= worst
          ? `<p class="ahead hot">Brace yourself: the saddest part still ahead is <strong>${label}</strong> (${fmt(top.average)}).</p>`
          : `<p class="ahead ok">The saddest part still ahead is <strong>${label}</strong> at ${fmt(top.average)}. Nothing devastating so far.</p>`;
      }
    }

    view.innerHTML = `
      <section class="hero book-hero">
        <div class="hero-inner">
          ${cover(book, index)}
          <div>
            <a href="#/" class="back">${ICON_BACK}Library</a>
            <p class="badge">Spoiler-light check</p>
            <h1>${esc(book.title)}</h1>
            <p class="by">by ${esc(book.author)}</p>
            ${book.series ? `<p class="part-of">Part of the <a href="#/series/${encodeURIComponent(book.series.slug)}">${esc(book.series.title)} series</a></p>` : ""}
            <div class="hero-actions">
              <a class="btn btn-sm" href="${SITE}/book/${encodeURIComponent(book.slug)}?mode=rate" target="_blank" rel="noopener">Rate this book</a>
              <a class="btn btn-sm" href="${SITE}/book/${encodeURIComponent(book.slug)}" target="_blank" rel="noopener">Open on site</a>
            </div>
          </div>
        </div>
      </section>
      <div class="book-body">
        ${limited ? `<p class="note" role="note">Warning: this book has limited ratings, so these averages may change.</p>` : ""}
        <fieldset class="panel">
          <legend>Where are you at?</legend>
          <h2>Which chapter are you on?</h2>
          <p>Pick it and we'll tell you how bad it gets from here.</p>
          <select id="here" aria-label="Chapter you're on">
            <option value="">Haven't started / just browsing</option>
            ${book.chapters.map((c, i) => `<option value="${i}" ${here === i ? "selected" : ""}>${esc(c.label || `Chapter ${c.number}`)}</option>`).join("")}
          </select>
          ${ahead}
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
            ? book.chapters.map((c, i) => chapterCard(c, i, here, showWarnings, warningNames, minVotes)).join("")
            : `<p class="empty">No chapters listed for this book yet.</p>`}
        </div>
        <div class="rate-cta">
          <a class="btn btn-primary" href="${SITE}/book/${encodeURIComponent(book.slug)}?mode=rate" target="_blank" rel="noopener">Read it already? Add your ratings</a>
        </div>
      </div>`;

    document.getElementById("here").addEventListener("change", (e) => {
      const v = e.target.value;
      store.set(hereKey, v === "" ? null : Number(v));
      draw();
      if (v !== "") document.getElementById(`ch-${v}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    view.querySelectorAll("[data-cw]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const y = window.scrollY;
        store.set("show-warnings", btn.dataset.cw === "1");
        draw();
        window.scrollTo(0, y);
      }),
    );
  };

  draw();
  window.scrollTo(0, 0);
}

// ---------- series ----------

async function renderSeries(slug) {
  await loadLibrary();
  const series = state.series.find((s) => s.slug === slug);
  if (!series) {
    view.innerHTML = `<div class="wrap"><p class="empty">We couldn't find that series.</p></div>`;
    return;
  }
  const bySlug = new Map(state.books.map((b, i) => [b.slug, [b, i]]));
  const books = series.books.map((s) => bySlug.get(s.slug)).filter(Boolean);
  view.innerHTML = `
    <section class="hero">
      <div class="hero-mark" aria-hidden="true">?</div>
      <div class="hero-inner">
        <a href="#/" class="back">${ICON_BACK}Library</a>
        <p class="badge">Series</p>
        <h1>${esc(series.title)}</h1>
        <p class="lede">${books.length} book${books.length === 1 ? "" : "s"} with chapter ratings.</p>
      </div>
    </section>
    <section class="section wrap">
      <ul class="cards">${books.map(([b, i]) => bookCard(b, i)).join("")}</ul>
    </section>`;
  window.scrollTo(0, 0);
}

// ---------- routing ----------

async function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [, kind, slug] = hash.split("/");
  try {
    if (kind === "book" && slug) await renderBook(decodeURIComponent(slug));
    else if (kind === "series" && slug) await renderSeries(decodeURIComponent(slug));
    else await renderHome();
  } catch (err) {
    console.error(err);
    view.innerHTML = err.status === 404
      ? `<div class="wrap"><p class="empty">The library is still being built. The first update takes about 10–15 minutes. Check back soon.</p></div>`
      : `<div class="wrap"><p class="empty">Couldn't load the library. Check your connection and try again.</p></div>`;
  }
}

window.addEventListener("hashchange", () => route());
window.addEventListener("scroll", () => {
  if ((location.hash || "#/") === "#/") state.homeScroll = window.scrollY;
}, { passive: true });

// ---------- chrome ----------

const ICON_SUN = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
const ICON_MOON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>`;
const toggle = document.getElementById("theme-toggle");
function paintToggle() {
  const dark = document.documentElement.classList.contains("dark");
  toggle.innerHTML = dark ? ICON_SUN : ICON_MOON;
  toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}
toggle.addEventListener("click", () => {
  const dark = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem("sadness-theme", dark ? "dark" : "light");
  } catch {}
  paintToggle();
});
paintToggle();

const about = document.getElementById("about");
document.getElementById("about-btn").addEventListener("click", () => about.showModal());

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

route();

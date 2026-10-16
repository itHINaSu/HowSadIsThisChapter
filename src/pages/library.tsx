// Library: search, sort, filters and presets over every book.
import { Link, getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookCard, CardGrid, SeriesCard } from "@/components/book-card";
import { FilterIcon, SearchIcon, XIcon } from "@/components/icons";
import { InstallBanner } from "@/components/install";
import { Hero, badgeClass, emptyClass, heroTitleClass, wrapClass } from "@/components/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { ToggleRow } from "@/components/ui/toggle-row";
import { PRESETS, SORTS, libraryItems, type Sort } from "@/lib/books";
import { libraryQuery } from "@/lib/data";
import { SITE } from "@/lib/format";
import { DEFAULT_FILTERS, store, useAvoid, useFilters, useMood, type Filters } from "@/lib/storage";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;
const route = getRouteApi("/");

// Kept while the app is open, so coming back to the library finds the same
// search, sort and "show more" position (the router restores the scroll).
const session = { query: "", sort: "recent" as Sort, shown: PAGE_SIZE };

const FILTER_LABELS: [keyof Filters, string][] = [
  ["hideSpicy", "Hide spicy books"],
  ["ratedOnly", "Only books with ratings"],
  ["hideAvoided", "Hide books with warnings I avoid"],
  ["groupSeries", "Group series together"],
];

export function LibraryPage() {
  const { data: library } = useSuspenseQuery(libraryQuery);
  const search = route.useSearch();
  const presetId = search.preset ?? null;
  const preset = presetId ? PRESETS[presetId] : null;
  const mood = useMood();
  const avoid = useAvoid();
  const filters = useFilters();

  const [query, setQueryState] = useState(session.query);
  const [sort, setSortState] = useState<Sort>(search.sort ?? session.sort);
  const [shown, setShownState] = useState(search.sort || search.preset ? PAGE_SIZE : session.shown);
  const setQuery = (q: string) => { session.query = q; setQueryState(q); setShown(PAGE_SIZE); };
  const setSort = (s: Sort) => { session.sort = s; setSortState(s); setShown(PAGE_SIZE); };
  const setShown = (n: number) => { session.shown = n; setShownState(n); };
  useEffect(() => {
    if (search.sort) { session.sort = search.sort; setSortState(search.sort); }
  }, [search.sort]);

  const items = useMemo(
    () => libraryItems(library.books, library.series, { query, preset: presetId, filters, sort, mood, avoid }),
    [library, query, presetId, filters, sort, mood, avoid],
  );
  const activeFilters = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).filter((k) => filters[k]).length;
  const noun = filters.groupSeries ? "result" : "book";
  const sheet = useRef<HTMLDialogElement>(null);
  const indexOf = (slug: string) => library.bySlug.get(slug)?.index ?? 0;

  return (
    <>
      <Hero>
        <p className={badgeClass}>Unofficial mobile reader</p>
        <h1 className={heroTitleClass}>How Sad?</h1>
        <p className="mt-4 max-w-xl text-[1.1rem] font-bold">
          Chapter sadness ratings from <a href={SITE} target="_blank" rel="noopener">How Sad Is This Chapter?</a>, reformatted for
          your phone. Not affiliated with the original site.
        </p>
        <label className="search-box mt-[26px] flex max-w-2xl items-center gap-2 border-2 border-foreground bg-background px-2.5 py-1.5 text-foreground shadow-hard-lg">
          <SearchIcon className="flex-none" />
          <input
            id="search"
            type="search"
            placeholder="Search a title, author or series"
            aria-label="Search for a book"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            className="h-[46px] min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
          />
        </label>
      </Hero>
      <InstallBanner />
      <section className={cn("section pt-9 pb-12", wrapClass)}>
        <div className="mb-[18px] grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b-2 border-foreground pb-3.5">
          <div>
            <p id="list-count" className="eyebrow m-0 text-[.72rem] font-black text-primary uppercase">
              {items.length} {items.length === 1 ? noun : `${noun}s`}
            </p>
            <h2 className="mt-1 font-display text-[1.9rem] leading-[1.1] font-normal">{preset ? preset.label : "Current Library"}</h2>
          </div>
          <Button id="filters-btn" size="sm" className="flex-none self-end" onClick={() => sheet.current?.showModal()}>
            <FilterIcon />
            Filters
            {activeFilters > 0 && (
              <span className="count-badge inline-grid h-5 min-w-5 place-items-center rounded-full bg-primary px-[5px] text-[.7rem] text-primary-foreground">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        {preset && (
          <p className="preset-chip mb-3.5 inline-flex items-center gap-2 border-2 border-foreground bg-highlight py-1 pr-1.5 pl-3 text-[.8rem] font-black text-highlight-foreground uppercase">
            <span>Showing: {preset.label}</span>
            <Link to="/" aria-label="Show the whole library" className="grid size-8 place-items-center">
              <XIcon />
            </Link>
          </p>
        )}

        {!preset?.sort && (
          <div role="group" aria-label="Sort books" className="sort mb-[18px] grid grid-cols-4 gap-1.5 pt-0.5 pr-[3px] pb-1 min-[560px]:flex min-[560px]:gap-2">
            {SORTS.map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                data-sort={k}
                aria-pressed={sort === k}
                onClick={() => setSort(k)}
                className="min-w-0 px-1 text-center text-[.74rem] leading-[1.15] whitespace-normal min-[560px]:flex-none min-[560px]:px-3 min-[560px]:text-[.78rem]"
              >
                {label}
              </Button>
            ))}
          </div>
        )}

        <CardGrid>
          {items.length ? (
            items.slice(0, shown).map((it) =>
              it.series ? (
                <SeriesCard key={`s-${it.series.slug}`} series={it.series} first={it.book} index={indexOf(it.book.slug)} />
              ) : (
                <BookCard key={it.book.slug} book={it.book} index={indexOf(it.book.slug)} />
              ),
            )
          ) : (
            <li className={emptyClass}>No books match{query ? ` “${query}”` : " these filters"}.</li>
          )}
        </CardGrid>

        {items.length > shown && (
          <div className="more mt-7 flex justify-center">
            <Button variant="primary" id="more-btn" onClick={() => setShown(shown + PAGE_SIZE)}>Show more</Button>
          </div>
        )}

        <div id="missing" hidden={!query.trim()} className="missing mt-7 border-2 border-dashed border-foreground p-4 text-center">
          <p className="mb-1.5 font-bold">Not in the library?</p>
          <p className="mb-1.5 text-[.78rem]">Books are added on the main site. Once it's there, it shows up here after the next update.</p>
          <a
            className={cn(buttonVariants({ variant: "primary" }), "mt-2")}
            href={`${SITE}/add-book?title=${encodeURIComponent(query.trim())}`}
            target="_blank"
            rel="noopener"
          >
            Add it on How Sad Is This Chapter?
          </a>
        </div>
      </section>

      <dialog
        id="filters"
        ref={sheet}
        onClick={(e) => e.target === sheet.current && sheet.current.close()}
        className="sheet m-auto w-[min(92vw,26rem)] border-2 border-foreground bg-card p-5 text-foreground shadow-hard-lg"
      >
        <h2 className="mt-0 font-display text-2xl font-normal">Filters</h2>
        {FILTER_LABELS.map(([k, label]) => (
          <ToggleRow
            key={k}
            label={label}
            data-filter={k}
            checked={filters[k]}
            onChange={(e) => {
              store.set("filters", { ...filters, [k]: e.target.checked });
              setShown(PAGE_SIZE);
            }}
          />
        ))}
        {avoid.size === 0 && (
          <p className="text-[.78rem] font-semibold text-muted-foreground">
            Pick warnings to avoid in the <Link to="/me">Me</Link> tab to use the warnings filter.
          </p>
        )}
        <form method="dialog" className="mt-4">
          <Button variant="primary" type="submit">Done</Button>
        </form>
      </dialog>
    </>
  );
}

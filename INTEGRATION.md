# Bringing these features into How Sad Is This Chapter?

This repo is an unofficial, phone-first front end for
[howsadisthischapter.com](https://howsadisthischapter.com). It was rebuilt on
the same stack as the site, so its features can move into the real site,
whole or one at a time, with little translation. This guide is written for the
site's creator and for an AI builder such as Lovable working in her project.

Repository: https://github.com/itHINaSu/HowSadIsThisChapter

> **To an AI assistant reading this:** the target is the existing
> howsadisthischapter.com project (React, TypeScript, TanStack Start/Router,
> TanStack Query, Tailwind, shadcn/ui, Supabase). Don't copy this repo
> wholesale. Port the features the owner asks for, reuse the project's
> existing components, data loaders and Supabase queries, and keep its own
> routes, auth and styles. Everything under `scripts/`, `docker/`,
> `Dockerfile`, `docker-compose*.yml` and `tests/e2e/serve.mjs` exists only
> because this app runs outside the site, and should not be ported.

## Same stack

| | This repo | howsadisthischapter.com |
|---|---|---|
| UI | React 19 + TypeScript | React + TypeScript |
| Routing | TanStack Router (hash URLs, client-only) | TanStack Start (TanStack Router, server-rendered) |
| Data fetching | TanStack Query (`queryOptions`) in route loaders | Route loaders / Supabase |
| Styling | Tailwind CSS v4, shadcn/ui colour names | Tailwind, shadcn/ui |
| Data | Static JSON built from the site's public pages | Supabase |

## Where things are

```
src/
  lib/            Plain TypeScript, no React: portable as-is
    types.ts        Data shapes every component uses
    data.ts         The ONLY place that loads data (swap this for Supabase)
    moods.ts        Moods and go / caution / stop verdicts (the site's own thresholds)
    books.ts        Book judgements, library filters, sorts and presets
    format.ts       Number and label formatting, DNF text
    storage.ts      Personal data on the device (mood, shelf, settings)
    install.ts      "Add to home screen" detection and prompt
    updates.ts      Installed app updates itself (version check + reload)
    share.ts, toast.ts, theme.ts, config.ts, utils.ts (cn)
  components/     Reusable pieces
    ui/             Button (cva variants), Panel, ToggleRow: stand-ins for shadcn/ui
    sadness.tsx     Sadness colours + the per-chapter Timeline strip
    mood-picker.tsx "How are you doing right now?"
    book-card.tsx   Compact book card with sadness strip and flags
    progress.tsx    Next chapters + "saddest part still ahead"
    install.tsx     "Get the app" section and banner
    app-shell.tsx   Header, bottom tab bar / desktop tabs / menu, footer, toast
  pages/          One file per screen: library, book, series, reading, discover, me
  router.tsx      Route definitions and loaders
  index.css       Tailwind theme: colour tokens and the extra tokens below
public/           Manifest, service worker (sw.js), icons
tests/e2e/        Playwright tests describing every behaviour
```

## Features, and what each one needs

| Feature | Files | Needs from the site | Notes |
|---|---|---|---|
| **Bottom tab bar on phones** (Library, Reading, Discover, Me); header tabs on desktop; menu in narrow desktop windows | `components/app-shell.tsx`, `desk`/`desk-narrow` variants in `index.css` | Her route paths | The biggest single mobile improvement. |
| **Sadness timeline**: one coloured segment per chapter, tap to jump | `components/sadness.tsx` (`Timeline`) | Chapter averages in reading order | Used on cards (small) and book pages (tappable). Copes with books of 150+ chapters. |
| **Mood verdicts everywhere** (cards, timeline, next chapters) | `lib/moods.ts`, `components/mood-picker.tsx` | Nothing new | Same thresholds and wording as the site; just reused in more places. |
| **Reading shelf**: reading / finished / bailed, chapter you're on, next three chapters, saddest part ahead | `pages/reading.tsx`, `components/progress.tsx`, `lib/storage.ts` (`useShelf`, `updateShelf`) | Nothing (on-device), or a table per reader if she wants it synced to accounts | |
| **Warnings to avoid**: flagged on cards and chapters even while other spoilers stay hidden | `pages/me.tsx`, `pages/book.tsx` (`ChapterCard`), `lib/books.ts` (`hasAvoided`) | Per-book list of agreed warning ids | Respects her `warningMinVotes` / agreement rules. |
| **Library filters and presets** (hide spicy, rated only, hide avoided, group series; "Gentle reads", "Safe for your mood", "Most devastating") | `pages/library.tsx`, `lib/books.ts` | Per-book summary (see `BookSummary`) | |
| **Discover tab** | `pages/discover.tsx` | Same summaries | Each section links to a library preset. |
| **"Not in the library? Add it"** after a search with no match | `pages/library.tsx` (`#missing`) | Her `/add-book?title=` page | |
| **Text size and theme** settings | `pages/me.tsx`, `lib/theme.ts` | Nothing | Theme uses the site's own `sadness-theme` key. |
| **Export / import personal data** | `pages/me.tsx` | Nothing | Moot if the data moves to accounts. |
| **Installable app (PWA)**: manifest, offline cache, install guide with drawn buttons, self-updating installs | `public/manifest.webmanifest`, `public/sw.js`, `lib/install.ts`, `lib/updates.ts`, `components/install.tsx` | A version string per deploy (see below) | Browser-only code; see "Server rendering". |

## Data: the one file to change

Every component reads data through `src/lib/data.ts`, which returns the
shapes in `src/lib/types.ts`. Here it fetches JSON files; on the real site,
replace `fetchLibrary()` and `fetchBook()` with her own queries and the
components work unchanged.

**`fetchBook(slug)` → `Book`.** Her `/book/$slug` route loader already returns
everything needed: `book`, `chapters`, `ratings` (chapter id → average and
votes), `warnings`, `warningTypes`, `thresholds` and `dnfStats`.
[`scripts/lib/parse.mjs`](scripts/lib/parse.mjs) `normalizeBook()` converts
exactly that loader data into a `Book`, applying her display rules (no
average below `sadnessMinVotes`, warnings below `warningMinVotes` dropped). It
can be reused as-is on her loader's result.

**`fetchLibrary()` → `Library`.** Books (approved), series and warning types
come from her Supabase tables. Each `BookSummary` also carries a few values
computed from the chapter averages, which she may already compute for her own
cards:

| Field | Meaning |
|---|---|
| `levels` | Each chapter's average in reading order (`null` = not enough ratings) |
| `ratedChapters` | Chapters with an average |
| `peak` | Highest chapter average |
| `votes` | Total sadness ratings |
| `warningIds` | Warning type ids agreed on anywhere in the book |
| `chapters` | Number of chapters |

`scripts/build-data.mjs` (`summarize()`) shows how these are derived. On her
side they'd be one aggregate query or view over the votes tables, which only
she can read.

`Meta.thresholds` uses her own names (`sadnessMinVotes`,
`sadnessLimitedDataVotes`, `warningMinVotes`, `worstAhead`, …).

## Personal data and accounts

Mood, shelf, avoided warnings and settings live in `localStorage`
(`src/lib/storage.ts`), so there's no login. On her site they could stay that
way, or the hooks (`useMood`, `useShelf`, `useAvoid`, `updateShelf`, …) could
read and write a per-reader Supabase table when someone is signed in. The
components only use the hooks, so that's the one place to change.

## Styling

Colours use shadcn/ui names that her site already defines (`background`,
`foreground`, `card`, `muted`, `muted-foreground`, `primary`,
`primary-foreground`), plus her `highlight`. Classes like `bg-card`,
`text-primary` and `border-foreground` mean the same thing in both projects.

Extra tokens to add to her theme, from `src/index.css`:

- `go`, `caution`, `stop` (+ `-foreground`): verdict colours, the same values as her mood buttons
- `s1`–`s5`: sadness scale, green to red
- `ink`: dark text on the bright scale colours
- `shadow-hard-xs` … `shadow-hard-lg`: the site's hard offset shadows
- Custom variants: `desk` (computer or wide window), `desk-narrow` (narrow
  desktop window), `installed` (running as the installed app)

`components/ui/button.tsx` and `panel.tsx` mimic her look. In her project,
use her own shadcn `Button` and card components instead, keeping the
`variant`/`size` names in mind (`primary`, `sm`).

## Routes

| This repo (hash URL) | Page file | On her site |
|---|---|---|
| `#/` (`?sort=`, `?preset=`) | `pages/library.tsx` | Her library/home route |
| `#/book/<slug>` and `#/book/<slug>/<chapter>` | `pages/book.tsx` | `/book/$slug` (chapter: scroll to `#ch-<n-1>`) |
| `#/series/<slug>` | `pages/series.tsx` | Her series route |
| `#/reading` | `pages/reading.tsx` | New |
| `#/discover` | `pages/discover.tsx` | New |
| `#/me` | `pages/me.tsx` | New, or her settings/profile page |

Pages read params with `getRouteApi("<route id>")`. In a file-based TanStack
Start project, use `Route.useParams()` / `Route.useSearch()` from the route
file instead.

## Server rendering

Her site renders pages on the server; this app only runs in the browser.
Code that touches `window`, `localStorage`, `matchMedia` or `navigator`
(`storage.ts`, `install.ts`, `updates.ts`, `theme.ts`, the install
components) must run on the client: inside `useEffect`, behind a
client-only wrapper, or with a server fallback. `useStored` already returns
a safe default during server rendering.

Self-updating installs: the Dockerfile stamps each build's commit into
`<meta name="app-version">`, `sw.js` and `version.json`. On her host, any
per-deploy value works, such as a build id or commit SHA exposed as a file.

## Suggested Lovable prompts

Paste one at a time. If Lovable can't open links, paste the file's contents
into the chat after the prompt.

1. *Bottom navigation.* "On screens under 768px wide, add a fixed bottom tab
   bar with Library, Reading, Discover and Me, like
   `src/components/app-shell.tsx` in https://github.com/itHINaSu/HowSadIsThisChapter.
   Highlight the current tab with a pink pill behind its icon. On wider screens
   show the same tabs in the header."
2. *Sadness timeline.* "Add a horizontal strip with one segment per chapter,
   coloured by sadness (or by my mood verdict when a mood is chosen), grey for
   chapters without enough ratings, like `Timeline` in
   `src/components/sadness.tsx`. Show a small one on book cards and a tappable
   one on the book page that scrolls to that chapter."
3. *Reading shelf.* "Let readers mark a book Reading / Finished / Bailed and
   pick the chapter they're on, saved on their device (or to their account
   when signed in). Add a Reading page listing their books with the next three
   chapters' verdicts and the saddest chapter still ahead, like
   `src/pages/reading.tsx` and `src/components/progress.tsx`."
4. *Warnings to avoid.* "Let readers choose content warnings to avoid.
   Flag books and chapters with those warnings in red, even when other content
   warnings are hidden, like `ChapterCard` in `src/pages/book.tsx`."
5. *Library filters and Discover.* "Add a Filters sheet to the library (hide
   spicy, only rated, hide books with warnings I avoid, group series) and a
   Discover page with Gentle reads, Safe for your mood, Bring tissues and Most
   rated, using the rules in `src/lib/books.ts`."
6. *Installable app.* "Make the site an installable PWA with a manifest,
   an offline-capable service worker and an install guide for iPhone,
   Android and desktop, like `public/manifest.webmanifest`, `public/sw.js` and
   `src/components/install.tsx`. Installed copies should reload themselves
   when a new version is deployed, like `src/lib/updates.ts`."

## Checking behaviour

`tests/e2e/*.spec.ts` describe every behaviour in plain steps (for example
"tapping the selected mood again clears it", "nothing is wider than the
screen on a small phone with extra-large text"). They're a useful checklist
when porting a feature, even without running them.

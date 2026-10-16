// Routes (TanStack Router, as on howsadisthischapter.com). Hash URLs like
// #/book/<slug>/<chapter> keep working on any static host and match the
// links people have already shared.
import { QueryClient } from "@tanstack/react-query";
import {
  Link,
  createHashHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { AppShell } from "./components/app-shell";
import { buttonVariants } from "./components/ui/button";
import { emptyClass, wrapClass } from "./components/layout";
import { isPreset, type PresetId, type Sort } from "./lib/books";
import { HttpError, bookQuery, libraryQuery } from "./lib/data";
import { applyPendingUpdate } from "./lib/updates";
import { BookPage } from "./pages/book";
import { DiscoverPage } from "./pages/discover";
import { LibraryPage } from "./pages/library";
import { MePage } from "./pages/me";
import { ReadingPage } from "./pages/reading";
import { SeriesPage } from "./pages/series";

export const queryClient = new QueryClient();

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: AppShell,
  notFoundComponent: () => (
    <div className={wrapClass}>
      <p className={emptyClass}>That page doesn't exist.</p>
      <p className={emptyClass}><Link to="/" className={buttonVariants({ variant: "primary" })}>Back to the library</Link></p>
    </div>
  ),
});

const loadLibrary = ({ context }: { context: { queryClient: QueryClient } }) => context.queryClient.ensureQueryData(libraryQuery);
const SORT_VALUES: Sort[] = ["recent", "az", "saddest", "rated"];

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (s: Record<string, unknown>): { sort?: Sort; preset?: PresetId } => ({
    sort: SORT_VALUES.includes(s.sort as Sort) ? (s.sort as Sort) : undefined,
    preset: isPreset(s.preset) ? s.preset : undefined,
  }),
  loader: loadLibrary,
  component: LibraryPage,
});

const bookRoute = createRoute({
  getParentRoute: () => rootRoute,
  // Optional chapter number for links to a chapter: #/book/<slug>/5
  path: "/book/$slug/{-$chapter}",
  loader: ({ context, params }) =>
    Promise.all([context.queryClient.ensureQueryData(libraryQuery), context.queryClient.ensureQueryData(bookQuery(params.slug))]),
  component: BookPage,
});

const seriesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/series/$slug", loader: loadLibrary, component: SeriesPage });
const readingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/reading", loader: loadLibrary, component: ReadingPage });
const discoverRoute = createRoute({ getParentRoute: () => rootRoute, path: "/discover", loader: loadLibrary, component: DiscoverPage });
const meRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/me",
  validateSearch: (s: Record<string, unknown>): { install?: boolean } => ({ install: "install" in s ? true : undefined }),
  loader: loadLibrary,
  component: MePage,
});

const routeTree = rootRoute.addChildren([libraryRoute, bookRoute, seriesRoute, readingRoute, discoverRoute, meRoute]);

function ErrorPage({ error }: ErrorComponentProps) {
  const status = error instanceof HttpError ? error.status : 0;
  const isBook = error instanceof HttpError && error.message.includes("api/books/");
  const message = isBook
    ? status === 404 ? "We couldn't find that book." : "Couldn't load this book. Check your connection and try again."
    : status === 404
      ? "The library is still being built. The first update takes about 10–15 minutes. Check back soon."
      : "Couldn't load the library. Check your connection and try again.";
  return (
    <div className={wrapClass}>
      <p className={emptyClass}>{message}</p>
      {isBook && <p className={emptyClass}><Link to="/" className={buttonVariants({ variant: "primary" })}>Back to the library</Link></p>}
    </div>
  );
}

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { queryClient },
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: ErrorPage,
  defaultPendingComponent: () => <p className={emptyClass}>Loading the library…</p>,
  defaultPendingMs: 300,
  // Returning to the library (by tab or back button) puts you where you were;
  // other pages restore only on back/forward.
  scrollRestoration: true,
  getScrollRestorationKey: (location) =>
    location.pathname === "/" ? `library${location.searchStr}` : (location.state as { __TSR_key?: string }).__TSR_key || location.href,
});

// An update found while the app was open is applied at the next page change.
router.subscribe("onResolved", () => applyPendingUpdate());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

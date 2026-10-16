// Header, navigation, footer and toast around every page.
//
// Navigation: phones get a bottom tab bar; computers (and any window 768px
// or wider) get the tabs in a sticky header; a narrow window on a computer
// gets a hamburger menu. See the `desk` / `desk-narrow` variants in index.css.
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ComponentType, type MouseEvent } from "react";
import { libraryQuery } from "@/lib/data";
import { SITE } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { DiscoverIcon, LibraryIcon, MeIcon, MenuIcon, ReadingIcon, XIcon } from "./icons";

type Tab = { id: string; to: "/" | "/reading" | "/discover" | "/me"; label: string; Icon: ComponentType<{ size?: number }> };
const TABS: Tab[] = [
  { id: "library", to: "/", label: "Library", Icon: LibraryIcon },
  { id: "reading", to: "/reading", label: "Reading", Icon: ReadingIcon },
  { id: "discover", to: "/discover", label: "Discover", Icon: DiscoverIcon },
  { id: "me", to: "/me", label: "Me", Icon: MeIcon },
];

/** Book and series pages belong to the Library tab. */
function tabFor(pathname: string) {
  const first = pathname.split("/")[1];
  return TABS.find((t) => t.to === `/${first}`)?.id ?? "library";
}

function Nav() {
  const { pathname } = useLocation();
  const active = tabFor(pathname);
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);

  // Close the menu on navigation, Escape, or a click elsewhere.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // composedPath, not target: the clicked icon may already be replaced (☰ → ✕).
    const onClick = (e: globalThis.MouseEvent) => header.current && !e.composedPath().includes(header.current) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  // Tapping the tab you're already on scrolls back to the top.
  const onTab = (t: Tab) => (e: MouseEvent) => {
    setOpen(false);
    if (active === t.id && pathname === t.to) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <header
      ref={header}
      className="nav border-b-2 border-foreground px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-3.5 desk:sticky desk:top-0 desk:z-50 desk:bg-background desk:pt-2.5 desk:pb-2.5"
    >
      <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Link to="/" className="brand truncate font-display text-[.9rem] uppercase no-underline desk:text-base">
          How sad?{" "}
          <span className="unofficial ml-1.5 inline-block border-2 border-foreground bg-highlight px-1.5 py-px align-middle font-sans text-[.62rem] font-black tracking-[.04em] text-highlight-foreground">
            Unofficial
          </span>
        </Link>
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="tabs"
          onClick={() => setOpen((o) => !o)}
          className="menu-btn hidden h-10 w-11 cursor-pointer items-center justify-center border-2 border-foreground bg-background shadow-hard-xs desk-narrow:inline-flex"
        >
          {open ? <XIcon size={22} /> : <MenuIcon />}
        </button>
        <nav
          id="tabs"
          aria-label="Sections"
          data-open={open}
          className={cn(
            "tabbar fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t-2 border-foreground bg-background pb-safe",
            "desk:static desk:flex desk:gap-1.5 desk:border-0 desk:bg-transparent desk:p-0",
            "desk-narrow:absolute desk-narrow:top-[calc(100%+12px)] desk-narrow:right-0 desk-narrow:bottom-auto desk-narrow:left-auto desk-narrow:z-[51]",
            "desk-narrow:hidden desk-narrow:min-w-50 desk-narrow:flex-col desk-narrow:gap-1 desk-narrow:border-2 desk-narrow:bg-background desk-narrow:p-2 desk-narrow:shadow-hard",
            "desk-narrow:data-[open=true]:flex",
          )}
        >
          {TABS.map((t) => {
            const current = active === t.id;
            return (
              <Link
                key={t.id}
                to={t.to}
                data-tab={t.id}
                aria-current={current ? "page" : undefined}
                activeProps={{}}
                onClick={onTab(t)}
                className={cn(
                  "group flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[.7rem] font-black tracking-[.03em] text-muted-foreground uppercase no-underline",
                  "desk:min-h-10 desk:flex-row desk:justify-start desk:gap-2 desk:rounded-full desk:border-2 desk:border-transparent desk:px-3.5 desk:py-1.5 desk:text-[.8rem] desk:hover:border-foreground desk:hover:text-foreground",
                  "desk-narrow:text-[.85rem]",
                  current && "text-foreground desk:border-foreground desk:bg-primary desk:text-primary-foreground desk:shadow-hard-xs",
                )}
              >
                <span
                  className={cn(
                    "grid place-items-center [&_svg]:size-6 desk:[&_svg]:size-[18px]",
                    current && "h-[30px] w-[52px] rounded-full border-2 border-foreground bg-primary text-primary-foreground shadow-hard-xs desk:size-auto desk:border-0 desk:bg-transparent desk:text-inherit desk:shadow-none",
                  )}
                >
                  <t.Icon />
                </span>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const { data } = useQuery(libraryQuery);
  const when = data ? new Date(data.meta.generatedAt) : null;
  return (
    <footer className="footer border-t-2 border-foreground bg-foreground px-4 pt-7 pb-[calc(92px+env(safe-area-inset-bottom))] text-background desk:pb-7">
      <div className="mx-auto max-w-6xl">
        <div className="disclaimer pb-1.5" role="note">
          <p className="mb-2 font-display uppercase">Unofficial fan-made front end</p>
          <p className="mb-2 text-[.78rem] font-bold">
            This app is not How Sad Is This Chapter? and is not made, run, affiliated with or endorsed by its creator. It's an
            independent, read-only front end that displays public data from{" "}
            <a href={SITE} target="_blank" rel="noopener">howsadisthischapter.com</a>.
          </p>
          <p className="mb-2 text-[.78rem] font-bold">
            All credit for the original site, its idea, design and ratings goes to its creator and the readers who rate there.
            Please visit, rate and support the original.
          </p>
        </div>
        {when && (
          <p className="text-[.78rem] opacity-80">
            Ratings last updated {when.toLocaleDateString(undefined, { day: "numeric", month: "short" })} at{" "}
            {when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.
          </p>
        )}
      </div>
    </footer>
  );
}

function Toast() {
  const { message, visible } = useToast();
  return (
    <div
      id="toast"
      role="status"
      aria-live="polite"
      className={cn(
        "toast pointer-events-none fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-1/2 z-[60] border-2 border-foreground bg-highlight px-4 py-2.5 font-black text-highlight-foreground shadow-hard-sm transition-[opacity,transform] duration-200 desk:bottom-6",
        visible ? "-translate-x-1/2 translate-y-0 opacity-100" : "-translate-x-1/2 translate-y-5 opacity-0",
      )}
    >
      {message}
    </div>
  );
}

export function AppShell() {
  return (
    <>
      <Nav />
      <main id="view" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <Toast />
    </>
  );
}

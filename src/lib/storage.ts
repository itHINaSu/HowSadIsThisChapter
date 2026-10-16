// Personal data (mood, shelf, settings) lives in this device's localStorage.
// The keys match the earlier version of the app, so nothing is lost on update.
// On howsadisthischapter.com these could be saved to the reader's account
// instead; see INTEGRATION.md.
import { useMemo, useSyncExternalStore } from "react";

const EVENT = "howsad:store";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const store = {
  get<T>(key: string, fallback: T): T {
    const raw = read(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {}
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
  },
  /** Tell subscribers a key changed outside store.set (e.g. an import). */
  touch(key: string) {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
  },
};

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** A localStorage value as React state; re-renders wherever it changes. */
export function useStored<T>(key: string, fallback: T): T {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  return useMemo(() => store.get(key, fallback), [raw, key]);
}

// ---------- the app's preferences ----------

export type MoodId = "fine" | "fragile" | "devastated" | "enraged";
export type Filters = { hideSpicy: boolean; ratedOnly: boolean; hideAvoided: boolean; groupSeries: boolean };
export const DEFAULT_FILTERS: Filters = { hideSpicy: false, ratedOnly: false, hideAvoided: false, groupSeries: false };

export type ShelfStatus = "reading" | "finished" | "bailed";
/** shelf[slug]: reading status and the chapter index the reader is on. */
export type ShelfEntry = { status?: ShelfStatus; chapter?: number | null; updated?: number };
export type Shelf = Record<string, ShelfEntry>;

/** Keys exported/imported by "Your data" on the Me tab. */
export const DATA_KEYS = ["mood", "avoid", "show-warnings", "shelf", "filters", "text-size", "sadness-theme", "install-dismissed"];

export const useMood = () => useStored<MoodId | null>("mood", null);
export function useAvoid(): Set<string> {
  const list = useStored<string[]>("avoid", []);
  return useMemo(() => new Set(list), [list]);
}
export const useShowWarnings = () => useStored<boolean>("show-warnings", false);
export const useShelf = () => useStored<Shelf>("shelf", {});
export function useFilters(): Filters {
  const saved = useStored<Partial<Filters>>("filters", {});
  return useMemo(() => ({ ...DEFAULT_FILTERS, ...saved }), [saved]);
}

export function updateShelf(slug: string, patch: ShelfEntry) {
  const shelf = store.get<Shelf>("shelf", {});
  const next = { ...shelf[slug], ...patch, updated: Date.now() };
  if (!next.status && (next.chapter === null || next.chapter === undefined)) delete shelf[slug];
  else shelf[slug] = next;
  store.set("shelf", shelf);
}

/** Earlier versions stored the chapter per book as "here:<slug>". */
export function migrateStorage() {
  try {
    const shelf = store.get<Shelf>("shelf", {});
    let changed = false;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith("here:")) continue;
      const chapter = store.get<number | null>(key, null);
      if (chapter !== null && !shelf[key.slice(5)]) {
        shelf[key.slice(5)] = { status: "reading", chapter, updated: Date.now() };
        changed = true;
      }
      localStorage.removeItem(key);
    }
    if (changed) store.set("shelf", shelf);
  } catch {}
}

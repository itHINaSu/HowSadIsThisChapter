// Keeping an installed app up to date without a reinstall.
//
// Each build stamps its version into index.html and version.json (see the
// Dockerfile). When the server has a newer one, reload: straight away when
// the reader comes back to the app, or at the next page change if it's
// noticed while they're using it.
import { toast } from "./toast";

const APP_VERSION = document.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content ?? "";
let pending = false;

async function serverVersion(): Promise<string | null> {
  try {
    const res = await fetch("version.json", { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

async function newerVersionAvailable() {
  if (!APP_VERSION || APP_VERSION.startsWith("__")) return false; // local dev build
  const version = await serverVersion();
  // Never reload twice for the same version (e.g. if a stale copy was served).
  let tried: string | null = null;
  try {
    tried = sessionStorage.getItem("reloaded-for");
  } catch {}
  return !!version && version !== APP_VERSION && version !== tried;
}

export async function applyUpdate() {
  const version = await serverVersion();
  try {
    if (version) sessionStorage.setItem("reloaded-for", version);
    sessionStorage.setItem("just-updated", "1");
  } catch {}
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  await reg?.update().catch(() => {});
  location.reload();
}

async function check(now: boolean) {
  if (!(await newerVersionAvailable())) return;
  if (now) applyUpdate();
  else pending = true;
}

/** Call on every page change: applies an update that was found earlier. */
export function applyPendingUpdate() {
  if (pending) applyUpdate();
}

export function watchForUpdates() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check(true);
  });
  window.addEventListener("pageshow", (e) => e.persisted && check(true));
  setInterval(() => document.visibilityState === "visible" && check(false), 15 * 60 * 1000);
  try {
    if (sessionStorage.getItem("just-updated")) {
      sessionStorage.removeItem("just-updated");
      setTimeout(() => toast("Updated to the latest version"), 600);
    }
  } catch {}
}

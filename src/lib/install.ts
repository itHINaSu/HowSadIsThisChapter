// Installing the app to the home screen / desktop.
import { useSyncExternalStore } from "react";

export const isInstalled = () =>
  matchMedia("(display-mode: standalone)").matches ||
  matchMedia("(display-mode: fullscreen)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export type Platform = "ios" | "android" | "desktop" | "mac" | "firefox";

export function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return "mac";
  return "desktop";
}

// Chrome, Edge and Brave (Android and desktop) offer a one-tap install.
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
type State = { prompt: InstallPromptEvent | null; installed: boolean };
let state: State = { prompt: null, installed: false };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

export function listenForInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    set({ prompt: e as InstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => set({ prompt: null, installed: true }));
}

export function useInstall() {
  const s = useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state);
  return {
    /** True when running as the installed app (or it was just installed). */
    installed: s.installed || isInstalled(),
    canPrompt: !!s.prompt,
    async install() {
      const prompt = s.prompt;
      if (!prompt) return;
      set({ prompt: null });
      await prompt.prompt();
      await prompt.userChoice.catch(() => {});
    },
  };
}

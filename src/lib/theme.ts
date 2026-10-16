// Light / dark theme (same storage key as the main site) and text size.
// index.html applies both before the first paint; these keep them in sync.
import { store } from "./storage";

export type ThemeChoice = "light" | "dark" | "system";

export const currentTheme = (): ThemeChoice => {
  try {
    return (localStorage.getItem("sadness-theme") as ThemeChoice | null) ?? "system";
  } catch {
    return "system";
  }
};

export function applyTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem("sadness-theme");
    else localStorage.setItem("sadness-theme", choice);
  } catch {}
  const dark = choice === "system" ? matchMedia("(prefers-color-scheme: dark)").matches : choice === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  store.touch("sadness-theme");
}

export function watchSystemTheme() {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (currentTheme() === "system") applyTheme("system");
  });
}

export type TextSize = "normal" | "large" | "xl";

export function applyTextSize(size: TextSize) {
  const root = document.documentElement;
  root.classList.remove("text-large", "text-xl");
  if (size !== "normal") root.classList.add(`text-${size}`);
}

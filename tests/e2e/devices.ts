import { devices } from "@playwright/test";

/** A Playwright device preset without its browser choice (we always use Chromium). */
export function device(name: keyof typeof devices) {
  const { defaultBrowserType, ...rest } = devices[name];
  return rest;
}

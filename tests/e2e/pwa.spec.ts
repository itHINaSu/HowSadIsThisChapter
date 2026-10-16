// Installing, self-updating, and shared links.
import { expect, test } from "@playwright/test";
import { device } from "./devices";

const iPhone = device("iPhone 13");

test.describe("install guide on a phone", () => {
  test.use(iPhone);
  test("banner, steps for this device, dismiss", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.locator(".install-banner")).toBeVisible();
    await page.locator(".install-banner a").click();
    await expect(page.locator("#install")).toContainText("Add to Home Screen");
    await page.locator(".other-devices summary").click();
    await expect(page.locator(".other-devices")).toContainText("Android");
    await page.goto("/#/");
    await page.click("[data-install-dismiss]");
    await expect(page.locator(".install-banner")).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".card").first()).toBeVisible();
    await expect(page.locator(".install-banner")).toHaveCount(0);
  });
});

test.describe("install guide on Android", () => {
  test.use(device("Pixel 7"));
  test("shows Android steps", async ({ page }) => {
    await page.goto("/#/me");
    await expect(page.locator("#install .steps").first()).toContainText("Install app");
  });
});

test.describe("install guide on desktop", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test("no banner; desktop steps on Me", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.locator(".card").first()).toBeVisible();
    await expect(page.locator(".install-banner")).toHaveCount(0);
    await page.goto("/#/me");
    await expect(page.locator("#install")).toContainText("address bar");
  });
});

test.describe("inside the installed app", () => {
  test.use(iPhone);
  test("hides the banner and the install section", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
    await page.goto("/#/");
    await expect(page.locator(".card").first()).toBeVisible();
    await expect(page.locator(".install-banner")).toHaveCount(0);
    await page.goto("/#/me");
    await expect(page.locator("[data-mood]").first()).toBeVisible();
    await expect(page.locator("#install")).toHaveCount(0);
  });
});

test.describe("updates", () => {
  test.use(iPhone);
  test.afterEach(async ({ request }) => {
    await request.get("/__test/version?v=v1");
  });
  test("an open app reloads itself into a new version", async ({ page, request }) => {
    await request.get("/__test/version?v=v1");
    await page.goto("/#/reading");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const version = () => page.evaluate(() => document.querySelector<HTMLMetaElement>('meta[name="app-version"]')!.content);
    expect(await version()).toBe("v1");

    await request.get("/__test/version?v=v2");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(version, { timeout: 10_000 }).toBe("v2");
    expect(page.url()).toMatch(/#\/reading$/);
    await expect(page.locator("#toast")).toHaveText("Updated to the latest version");
    // The new service worker takes over and clears the old version's cache.
    await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 10_000 }).toContain("shell-v2");
    await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 10_000 }).not.toContain("shell-v1");
  });
});

test.describe("sharing a book", () => {
  test.use(iPhone);
  test.afterEach(async ({ request }) => {
    await request.get("/__test/config?publicUrl=");
  });
  for (const [publicUrl, expected] of [
    ["", "https://howsadisthischapter.com/book/my-friends"],
    ["https://howsad.example.com", "https://howsad.example.com/#/book/my-friends"],
  ]) {
    test(`links to ${expected}`, async ({ page, request }) => {
      await request.get(`/__test/config?publicUrl=${encodeURIComponent(publicUrl)}`);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", { value: (d: { url: string }) => ((window as unknown as { shared: string }).shared = d.url, Promise.resolve()) });
      });
      await page.goto("/#/book/my-friends");
      await page.click("#share-book");
      expect(await page.evaluate(() => (window as unknown as { shared: string }).shared)).toBe(expected);
      await expect(page.locator("[data-share-ch]")).toHaveCount(0);
    });
  }
});

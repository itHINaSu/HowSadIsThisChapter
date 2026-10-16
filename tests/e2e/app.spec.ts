// The main reader journeys on a phone: mood, avoided warnings, filters,
// search, a book page, the shelf, Discover presets, deep links and settings.
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

test("the full reader journey", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Me: mood and a warning to avoid
  await page.goto("/#/me");
  await page.click('[data-mood="fragile"]');
  await page.locator('label.toggle:has-text("Main character death") input').check();
  expect(await page.evaluate(() => JSON.parse(localStorage.mood))).toBe("fragile");
  // tapping the selected mood again clears it, then pick it again
  await page.click('[data-mood="fragile"]');
  expect(await page.evaluate(() => localStorage.mood)).toBeUndefined();
  await page.click('[data-mood="fragile"]');

  // Library: strips and avoided-warning flags
  await page.click('.tabbar [data-tab="library"]');
  await expect(page.locator(".card").first()).toBeVisible();
  expect(await page.locator(".card .timeline").count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator(".flag-avoid").first()).toBeVisible();

  // Filters hide spicy and avoided books
  await page.click("#filters-btn");
  await page.check('[data-filter="hideAvoided"]');
  await page.check('[data-filter="hideSpicy"]');
  await page.click("#filters button.btn-primary");
  const titles = await page.locator(".card h3").allTextContents();
  expect(titles).not.toContain("Redeeming 6");
  expect(titles).not.toContain("A Memory of Light");
  await expect(page.locator("#filters-btn .count-badge")).toHaveText("2");

  // Search with no match offers adding it on the original site
  await page.fill("#search", "zzz nothing");
  await expect(page.locator("#missing")).toBeVisible();
  expect(await page.getAttribute("#missing a", "href")).toContain("add-book?title=zzz");
  await page.fill("#search", "");
  await page.click("#filters-btn");
  await page.uncheck('[data-filter="hideAvoided"]');
  await page.uncheck('[data-filter="hideSpicy"]');
  await page.click("#filters button.btn-primary");

  // Sort
  await page.click('[data-sort="az"]');
  expect((await page.locator(".card h3").allTextContents())[0]).toBe("A Gentle Tale");

  // Book page: avoided note, picking a chapter shelves the book
  await page.click('a[href$="#/book/a-memory-of-light"]');
  await expect(page.locator(".chapter").first()).toBeVisible();
  await expect(page.locator(".note.avoid-note")).toBeVisible();
  await expect(page.locator(".verdict").first()).toBeVisible();
  await page.selectOption("#here", "2");
  await expect(page.locator(".ahead")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.shelf)["a-memory-of-light"].status)).toBe("reading");
  await page.click('[data-jump="6"]');
  await expect(page.locator("#ch-6")).toBeInViewport();
  // Spoilers: hidden by default except avoided warnings, shown on request
  await expect(page.locator("#ch-3 .is-avoided")).toBeVisible();
  await page.click('[data-cw="1"]');
  await expect(page.locator("#ch-3 .cw-list span")).toHaveCount(2);

  // Finished shelf and Reading tab
  await page.goto("/#/book/my-friends");
  await page.click('[data-status="finished"]');
  await page.click('.tabbar [data-tab="reading"]');
  await expect(page.locator(".reading-card .next")).toBeVisible();
  await expect(page.locator(".reading-card")).toHaveCount(1);
  await expect(page.locator(".shelf-title", { hasText: "Finished" })).toBeVisible();

  // Discover → "See all" opens the library preset
  await page.click('.tabbar [data-tab="discover"]');
  await expect(page.locator(".disc-section").first()).toBeVisible();
  await page.locator('.disc-section:has-text("Gentle reads") a.btn').click();
  await expect(page.locator(".preset-chip")).toBeVisible();
  for (const t of await page.locator(".card h3").allTextContents()) expect(["A Gentle Tale", "City Of Ashes 2"]).toContain(t);

  // Deep link to a chapter
  await page.goto("/#/book/a-memory-of-light/5");
  await expect(page.locator("#ch-4")).toBeInViewport();

  // Settings: text size, theme, export, and they survive a reload
  await page.goto("/#/me");
  await page.click('[data-size="xl"]');
  expect(await page.evaluate(() => document.documentElement.classList.contains("text-xl"))).toBe(true);
  await page.click('[data-theme="dark"]');
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export")]);
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.items.shelf).toBeTruthy();
  expect(exported.items.mood).toBeTruthy();
  await page.reload();
  await expect(page.locator('[data-size="xl"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);

  expect(errors).toEqual([]);
});

test("data from the previous version of the app carries over", async ({ page }) => {
  await page.goto("/#/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("here:my-friends", "2"); // oldest format
    localStorage.setItem("mood", JSON.stringify("devastated"));
  });
  await page.goto("/#/reading");
  await page.reload();
  await expect(page.locator(".reading-card")).toHaveCount(1);
  await expect(page.getByText("Verdicts for “Devastated”")).toBeVisible();
});

test("returning to the library keeps your place", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.locator(".card").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(200);
  await page.click('.tabbar [data-tab="discover"]');
  await expect(page.locator(".disc-section").first()).toBeVisible();
  await page.click('.tabbar [data-tab="library"]');
  await expect(page.locator(".card").first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(700);
});

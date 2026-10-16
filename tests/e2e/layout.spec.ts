// Layout across devices: which navigation shows, the desktop menu, and that
// nothing is ever wider than the screen.
import { expect, test, type Page } from "@playwright/test";
import { device } from "./devices";

async function navMode(page: Page) {
  return page.evaluate(() => {
    const tabbar = getComputedStyle(document.querySelector(".tabbar")!);
    const menu = getComputedStyle(document.querySelector(".menu-btn")!);
    return tabbar.position === "fixed" ? "bottom bar" : menu.display !== "none" ? "menu" : "header tabs";
  });
}

const cases: [string, Parameters<typeof test.use>[0], string][] = [
  ["desktop", { viewport: { width: 1280, height: 800 } }, "header tabs"],
  ["narrow desktop window", { viewport: { width: 600, height: 800 } }, "menu"],
  ["touch laptop", { viewport: { width: 1366, height: 768 }, hasTouch: true, isMobile: true }, "header tabs"],
  ["iPhone", device("iPhone 13"), "bottom bar"],
  ["Android", device("Pixel 7"), "bottom bar"],
  ["iPad", device("iPad (gen 7) landscape"), "header tabs"],
];

for (const [name, opts, expected] of cases) {
  test.describe(name, () => {
    test.use(opts);
    test(`uses ${expected}`, async ({ page }) => {
      await page.goto("/#/");
      await expect(page.locator(".card").first()).toBeVisible();
      expect(await navMode(page)).toBe(expected);
    });
  });
}

test.describe("desktop menu in a narrow window", () => {
  test.use({ viewport: { width: 600, height: 800 } });
  test("opens, navigates and closes", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.locator(".card").first()).toBeVisible();
    await expect(page.locator(".tabbar")).toBeHidden();
    await page.click(".menu-btn");
    await expect(page.locator(".tabbar")).toBeVisible();
    await page.click('.tabbar [data-tab="me"]');
    await expect(page).toHaveURL(/#\/me/);
    await expect(page.locator(".tabbar")).toBeHidden();
    await page.click(".menu-btn");
    await page.keyboard.press("Escape");
    await expect(page.locator(".tabbar")).toBeHidden();
    await page.click(".menu-btn");
    await page.mouse.click(300, 600);
    await expect(page.locator(".tabbar")).toBeHidden();
  });
});

for (const size of [null, "large", "xl"]) {
  test.describe(`small phone, ${size ?? "normal"} text`, () => {
    test.use(device("iPhone SE"));
    test("nothing is wider than the screen", async ({ page }) => {
      if (size) await page.addInitScript((s) => localStorage.setItem("text-size", JSON.stringify(s)), size);
      for (const route of ["#/", "#/reading", "#/discover", "#/me", "#/book/a-memory-of-light", "#/book/very-long-book"]) {
        await page.goto("/" + route);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(150);
        const overflow = await page.evaluate(() => {
          const out: string[] = [];
          const W = document.documentElement.clientWidth;
          if (document.documentElement.scrollWidth > W) out.push(`page ${document.documentElement.scrollWidth}`);
          const sort = document.querySelector(".sort");
          if (sort && sort.scrollWidth > sort.clientWidth) out.push("sort row");
          const tl = document.querySelector(".timeline.interactive");
          if (tl && tl.getBoundingClientRect().right > tl.parentElement!.getBoundingClientRect().right + 0.5) out.push("timeline");
          return out;
        });
        expect(overflow, route).toEqual([]);
      }
    });
  });
}

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const destination = "artifacts/final-structural-redesign";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, route, width, scrollY = 0] of [
    ["home", "/", 1440],
    ["home-categories", "/", 1440, 760],
    ["quests", "/quests", 1440],
    ["skills", "/skills", 390],
    ["skills-controls", "/skills", 390, 1700],
    ["skills", "/skills", 1440],
    ["bossing", "/bossing", 1440],
    ["diaries", "/diaries", 1440],
    ["infernal", "/infernal", 1440],
    ["infernal-controls", "/infernal", 1440, 650],
    ["gathering", "/misc-gathering", 1440],
    ["gold", "/gold", 390],
    ["items", "/products", 390],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height: width < 700 ? 844 : 1000 },
    });
    await page.goto(`http://127.0.0.1:3000${route}`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    const heroImage = page.locator(".service-hero img");
    if (await heroImage.count()) {
      await heroImage.waitFor({ state: "visible" });
      await heroImage.evaluate((image) => image.decode());
    }
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    if (scrollY) {
      await page.evaluate(
        (top) => window.scrollTo({ top, behavior: "instant" }),
        scrollY,
      );
    }
    await page.screenshot({ path: `${destination}/${name}-${width}.png` });
    console.log(`Captured ${route} at ${width}px`);
    await page.close();
  }
} finally {
  await browser.close();
}

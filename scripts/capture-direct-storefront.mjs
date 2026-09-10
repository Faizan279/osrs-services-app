import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const destination = "artifacts/reference-ui-redesign";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, route, width, scrollY = 0] of [
    ["home", "/", 1440],
    ["home", "/", 390],
    ["quests", "/quests", 1440],
    ["skills", "/skills", 390],
    ["skills-controls", "/skills", 390, 700],
    ["skills", "/skills", 1440],
    ["bossing", "/bossing", 1440],
    ["diaries", "/diaries", 1440],
    ["infernal", "/infernal", 1440],
    ["infernal", "/infernal", 390],
    ["gathering", "/misc-gathering", 1440],
    ["gold", "/gold", 390],
    ["gold", "/gold", 1440],
    ["items", "/products", 1440],
    ["diaries", "/diaries", 390],
    ["quests", "/quests", 390],
    ["bossing", "/bossing", 390],
    ["items", "/products", 390],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height: width < 700 ? 844 : 1000 },
    });
    await page.goto(`http://127.0.0.1:3000${route}`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    if (route === "/infernal") {
      for (const [label, value] of [
        ["Ranged level", "99"],
        ["Magic level", "99"],
        ["Defence level", "90"],
        ["Prayer level", "77"],
      ])
        await page.getByLabel(label, { exact: true }).fill(value);
      await page
        .getByLabel("Customer confirms the selected Infernal setup")
        .check();
      await expect(
        page.getByRole("button", { name: "Add to cart", exact: true }).first(),
      ).toBeEnabled({ timeout: 30000 });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
    }
    if (route === "/skills" && width === 1440) {
      await page.getByRole("button", { name: "Mining", exact: true }).click();
      await page.getByLabel("Current level", { exact: true }).fill("77");
      await page.getByLabel("Target level", { exact: true }).fill("99");
      await expect(
        page.getByRole("button", { name: "Add to cart", exact: true }).first(),
      ).toBeEnabled({ timeout: 30000 });
    }
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

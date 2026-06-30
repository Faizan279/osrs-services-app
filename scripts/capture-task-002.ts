import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-002");

async function openHomepage(page: Page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Your next goal, handled with care." })
    .waitFor();
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  });

  try {
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });
    const desktopPage = await desktop.newPage();
    await openHomepage(desktopPage);
    await desktopPage.screenshot({
      path: path.join(outputDirectory, "homepage-desktop-above-fold-1440.png"),
    });
    await desktopPage.screenshot({
      path: path.join(outputDirectory, "homepage-desktop-full-1440.png"),
      fullPage: true,
    });
    await desktopPage.evaluate(() => window.scrollTo(0, 0));
    await desktopPage
      .getByRole("button", { name: "Services", exact: true })
      .click();
    await desktopPage.locator("#desktop-services-menu").waitFor();
    await desktopPage.waitForTimeout(250);
    await desktopPage.screenshot({
      path: path.join(outputDirectory, "desktop-services-menu-open-1440.png"),
    });
    await desktop.close();

    const tablet = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      deviceScaleFactor: 1,
    });
    const tabletPage = await tablet.newPage();
    await openHomepage(tabletPage);
    await tabletPage.screenshot({
      path: path.join(outputDirectory, "homepage-tablet-768.png"),
      fullPage: true,
    });
    await tablet.close();

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const mobilePage = await mobile.newPage();
    await openHomepage(mobilePage);
    await mobilePage.screenshot({
      path: path.join(outputDirectory, "homepage-mobile-390.png"),
      fullPage: true,
    });
    await mobilePage.evaluate(() => window.scrollTo(0, 0));
    await mobilePage
      .getByRole("button", { name: "Open mobile navigation" })
      .click();
    await mobilePage
      .getByRole("dialog", { name: "Mobile navigation" })
      .waitFor();
    await mobilePage.waitForTimeout(300);
    await mobilePage.screenshot({
      path: path.join(outputDirectory, "mobile-navigation-open-390.png"),
    });
    await mobile.close();
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

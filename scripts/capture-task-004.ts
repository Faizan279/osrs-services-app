import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-004");
const publicPath = "/services/achievement-diaries/diary-progression";

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content:
      "* { cursor: none !important; } html { scroll-behavior: auto !important; }",
  });
}

async function signIn(page: Page) {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password)
    throw new Error("Admin seed credentials are required.");
  await page.goto(`${baseUrl}/login?next=/admin/catalogue/services`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/catalogue/services");
}

async function openDiaryOfferings(page: Page) {
  await page.goto(`${baseUrl}/admin/catalogue/services?q=Diary`);
  await settle(page);
  const editLink = page
    .locator('a[href^="/admin/catalogue/services/"]')
    .filter({ hasText: "Edit" })
    .first();
  if ((await editLink.count()) === 0) {
    throw new Error(
      `Diary editor link missing at ${page.url()}: ${await page.locator("body").innerText()}`,
    );
  }
  await editLink.click();
  await page.getByRole("link", { name: "Manage offerings" }).click();
  await settle(page);
}

async function runEligibility(page: Page) {
  await page.getByLabel("RuneScape name").fill("Sample User");
  await page
    .getByLabel("Service option")
    .selectOption({ label: "Kandarin Hard Diary" });
  await page.getByRole("button", { name: "Check eligibility" }).click();
  await page
    .getByRole("heading", { name: "Results for Sample Adventurer" })
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
    const page = await desktop.newPage();
    await page.goto(`${baseUrl}${publicPath}`);
    await settle(page);
    await page.screenshot({
      path: path.join(outputDirectory, "public-catalogue-engine-1440.png"),
      fullPage: true,
    });
    await page.goto(`${baseUrl}${publicPath}?f_region=kandarin`);
    await settle(page);
    await page.screenshot({
      path: path.join(outputDirectory, "public-catalogue-filtered-1440.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "View requirements" }).click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({
      path: path.join(outputDirectory, "public-requirement-dialog-1440.png"),
    });
    await page.keyboard.press("Escape");
    await runEligibility(page);
    await page
      .getByText("Attack level", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(outputDirectory, "public-rsn-eligibility-met-1440.png"),
    });
    await page
      .getByText("Magic level", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(outputDirectory, "public-rsn-eligibility-mixed-1440.png"),
    });

    const admin = await desktop.newPage();
    await signIn(admin);
    await openDiaryOfferings(admin);
    await admin.addStyleTag({
      content: ".screenshot-sensitive { visibility: hidden !important; }",
    });
    await admin.screenshot({
      path: path.join(outputDirectory, "admin-offerings-list-1440.png"),
      fullPage: true,
    });
    await admin
      .locator("article")
      .filter({ hasText: "Kandarin Hard Diary" })
      .getByRole("link", { name: "Edit" })
      .click();
    await settle(admin);
    await admin.screenshot({
      path: path.join(outputDirectory, "admin-offering-editor-1440.png"),
      fullPage: true,
    });
    await admin
      .getByRole("heading", { name: "Eligibility rules" })
      .scrollIntoViewIfNeeded();
    await admin.screenshot({
      path: path.join(outputDirectory, "admin-eligibility-rules-1440.png"),
    });
    await desktop.close();

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const publicMobile = await mobile.newPage();
    await publicMobile.goto(`${baseUrl}${publicPath}`);
    await settle(publicMobile);
    await publicMobile.screenshot({
      path: path.join(outputDirectory, "public-catalogue-mobile-390.png"),
      fullPage: true,
    });
    await runEligibility(publicMobile);
    await publicMobile
      .getByRole("heading", { name: "Results for Sample Adventurer" })
      .scrollIntoViewIfNeeded();
    await publicMobile.screenshot({
      path: path.join(outputDirectory, "public-eligibility-mobile-390.png"),
    });
    const adminMobile = await mobile.newPage();
    await signIn(adminMobile);
    await openDiaryOfferings(adminMobile);
    await adminMobile.screenshot({
      path: path.join(outputDirectory, "admin-offerings-mobile-390.png"),
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

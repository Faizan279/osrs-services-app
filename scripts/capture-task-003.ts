import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-003");

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content:
      "* { cursor: none !important; } html { scroll-behavior: auto !important; }",
  });
}

async function signIn(page: Page, next = "/admin/catalogue") {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required.");
  }
  await page.goto(`${baseUrl}/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL(`**${next}`);
}

async function redactAdminIdentity(page: Page) {
  await page.addStyleTag({
    content: ".screenshot-sensitive { visibility: hidden !important; }",
  });
}

async function openServiceEditor(page: Page) {
  await page.goto(`${baseUrl}/admin/catalogue/services`);
  await settle(page);
  const row = page
    .getByRole("row")
    .filter({ hasText: "Skill training request" });
  await row.getByRole("link", { name: "Edit" }).click();
  await page.waitForURL(/\/admin\/catalogue\/services\/[^/]+$/);
  await settle(page);
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
    const publicPage = await desktop.newPage();
    await publicPage.goto(`${baseUrl}/services`);
    await settle(publicPage);
    await publicPage.screenshot({
      path: path.join(outputDirectory, "public-services-directory-1440.png"),
      fullPage: true,
    });
    await publicPage.goto(
      `${baseUrl}/services/power-levelling/skill-training-request`,
    );
    await settle(publicPage);
    await publicPage.screenshot({
      path: path.join(outputDirectory, "public-service-detail-1440.png"),
      fullPage: true,
    });

    const adminPage = await desktop.newPage();
    await signIn(adminPage);
    await settle(adminPage);
    await adminPage
      .getByRole("heading", { name: "Catalogue", exact: true })
      .waitFor();
    await redactAdminIdentity(adminPage);
    await adminPage.screenshot({
      path: path.join(outputDirectory, "admin-catalogue-overview-1440.png"),
      fullPage: true,
    });
    await adminPage.goto(`${baseUrl}/admin/catalogue/services`);
    await settle(adminPage);
    await adminPage
      .getByRole("heading", { name: "Services", exact: true })
      .waitFor();
    await redactAdminIdentity(adminPage);
    await adminPage.screenshot({
      path: path.join(outputDirectory, "admin-services-list-1440.png"),
      fullPage: true,
    });
    await openServiceEditor(adminPage);
    await redactAdminIdentity(adminPage);
    await adminPage.screenshot({
      path: path.join(outputDirectory, "admin-service-editor-1440.png"),
    });
    await adminPage.locator("#requirements").scrollIntoViewIfNeeded();
    await adminPage.screenshot({
      path: path.join(outputDirectory, "admin-service-requirements-1440.png"),
    });
    await adminPage.locator("#publishing").scrollIntoViewIfNeeded();
    await adminPage.evaluate(() => window.scrollBy(0, -180));
    await adminPage.screenshot({
      path: path.join(outputDirectory, "admin-service-publishing-1440.png"),
    });
    await desktop.close();

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const publicMobile = await mobile.newPage();
    await publicMobile.goto(`${baseUrl}/services`);
    await settle(publicMobile);
    await publicMobile.screenshot({
      path: path.join(outputDirectory, "public-services-mobile-390.png"),
      fullPage: true,
    });
    const adminMobile = await mobile.newPage();
    await signIn(adminMobile, "/admin/catalogue/services");
    await settle(adminMobile);
    await adminMobile
      .getByRole("heading", { name: "Services", exact: true })
      .waitFor();
    await redactAdminIdentity(adminMobile);
    await adminMobile.screenshot({
      path: path.join(outputDirectory, "admin-services-mobile-390.png"),
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

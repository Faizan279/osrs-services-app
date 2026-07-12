import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";
import mariadb from "mariadb";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-006");
const publicPath = "/services/bossing-pvm/pvm-support";
const bossingFlagKey = "bossing_calculator_enabled";

type FlagSnapshot = {
  enabled: boolean;
} | null;

async function connectDatabase() {
  if (
    !process.env.DATABASE_USER ||
    !process.env.DATABASE_NAME ||
    !process.env.DATABASE_HOST
  ) {
    throw new Error(
      "Database environment is required to enable the Task 006 screenshot flag.",
    );
  }

  return mariadb.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    allowPublicKeyRetrieval:
      process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === "true",
  });
}

async function enableBossingFlagForScreenshots() {
  const connection = await connectDatabase();
  try {
    const rows = (await connection.query(
      "SELECT enabled FROM FeatureFlag WHERE `key` = ? LIMIT 1",
      [bossingFlagKey],
    )) as Array<{ enabled: boolean | number }>;
    const row = rows[0];
    if (!row) {
      throw new Error(`Feature flag ${bossingFlagKey} is missing.`);
    }
    await connection.query(
      "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = ?",
      [bossingFlagKey],
    );
    return { enabled: Boolean(row.enabled) } satisfies FlagSnapshot;
  } finally {
    await connection.end();
  }
}

async function restoreBossingFlag(snapshot: FlagSnapshot) {
  if (!snapshot) return;
  const connection = await connectDatabase();
  try {
    await connection.query(
      "UPDATE FeatureFlag SET enabled = ? WHERE `key` = ?",
      [snapshot.enabled ? 1 : 0, bossingFlagKey],
    );
  } finally {
    await connection.end();
  }
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content: [
      "* { cursor: none !important; }",
      "html { scroll-behavior: auto !important; }",
      "a[href='#main-content'] { display: none !important; }",
      "header[class*='sticky'], [class*='xl:sticky'] { position: static !important; inset: auto !important; transform: none !important; }",
    ].join(" "),
  });
}

async function signIn(page: Page) {
  const sessionToken = process.env.CAPTURE_ADMIN_SESSION_TOKEN;
  if (sessionToken) {
    await page.context().addCookies([
      {
        name: process.env.AUTH_SESSION_COOKIE ?? "osrs_session",
        value: sessionToken,
        url: baseUrl,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto(`${baseUrl}/admin/catalogue/services`);
    await page.waitForURL(
      (url) => url.pathname === "/admin/catalogue/services",
    );
    return;
  }

  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error("Admin seed credentials are required.");
  }
  await page.goto(`${baseUrl}/login?next=/admin/catalogue/services`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/catalogue/services");
}

async function openBossingAdmin(page: Page) {
  await page.goto(`${baseUrl}/admin/catalogue/services?q=PvM%20support`);
  await settle(page);
  const editLink = page
    .locator('a[href^="/admin/catalogue/services/"]')
    .filter({ hasText: "Edit" })
    .first();
  if ((await editLink.count()) === 0) {
    throw new Error(
      `Bossing service editor link missing at ${page.url()}: ${await page.locator("body").innerText()}`,
    );
  }
  await editLink.click();
  await page.getByRole("link", { name: "Manage bossing" }).click();
  await settle(page);
}

async function estimate(page: Page) {
  await page.getByRole("button", { name: "Estimate total" }).click();
  await page.getByRole("heading", { name: /^\$/ }).waitFor();
  await settle(page);
}

async function validationError(page: Page) {
  await page.getByLabel("Current KC to target KC").check();
  await page.getByRole("spinbutton", { name: "Current KC" }).fill("25");
  await page.getByRole("spinbutton", { name: "Target KC" }).fill("25");
  await page.getByRole("button", { name: "Estimate total" }).click();
  await page.locator("#bossing-calculator-status").waitFor();
  await page
    .locator("#bossing-calculator-status")
    .filter({ hasText: "Target KC must be greater than current KC." })
    .waitFor();
  await settle(page);
}

function serviceIdFromBossingUrl(page: Page) {
  const parts = new URL(page.url()).pathname.split("/");
  const index = parts.findIndex((part) => part === "services");
  const serviceId = parts[index + 1];
  if (!serviceId)
    throw new Error(`Could not read service id from ${page.url()}`);
  return serviceId;
}

async function main() {
  const flagSnapshot = await enableBossingFlagForScreenshots();
  let browser: Browser | null = null;
  try {
    await mkdir(outputDirectory, { recursive: true });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });
    const publicPage = await desktop.newPage();
    await publicPage.goto(`${baseUrl}${publicPath}`);
    await settle(publicPage);
    await publicPage.screenshot({
      path: path.join(outputDirectory, "public-bossing-calculator-1440.png"),
      fullPage: true,
    });
    await estimate(publicPage);
    await publicPage.screenshot({
      path: path.join(outputDirectory, "public-bossing-estimate-1440.png"),
      fullPage: true,
    });
    await publicPage
      .getByRole("heading", { name: "Public stat requirements" })
      .scrollIntoViewIfNeeded();
    await settle(publicPage);
    await publicPage.screenshot({
      path: path.join(outputDirectory, "public-bossing-requirements-1440.png"),
      fullPage: true,
    });
    await validationError(publicPage);
    await publicPage.screenshot({
      path: path.join(outputDirectory, "public-bossing-validation-1440.png"),
      fullPage: true,
    });

    const admin = await desktop.newPage();
    await signIn(admin);
    await openBossingAdmin(admin);
    await admin.addStyleTag({
      content: ".screenshot-sensitive { visibility: hidden !important; }",
    });
    await admin.screenshot({
      path: path.join(outputDirectory, "admin-bossing-overview-1440.png"),
      fullPage: true,
    });
    const serviceId = serviceIdFromBossingUrl(admin);
    await admin
      .getByRole("row")
      .filter({ has: admin.getByRole("link", { name: "Edit" }) })
      .last()
      .getByRole("link", { name: "Edit" })
      .click();
    await settle(admin);
    await admin.screenshot({
      path: path.join(outputDirectory, "admin-bossing-method-editor-1440.png"),
      fullPage: true,
    });
    await admin.goto(
      `${baseUrl}/admin/catalogue/services/${serviceId}/preview`,
    );
    await settle(admin);
    await admin.screenshot({
      path: path.join(outputDirectory, "admin-bossing-preview-1440.png"),
      fullPage: true,
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
      path: path.join(outputDirectory, "public-bossing-mobile-390.png"),
      fullPage: true,
    });
    const adminMobile = await mobile.newPage();
    await signIn(adminMobile);
    await openBossingAdmin(adminMobile);
    await adminMobile.screenshot({
      path: path.join(outputDirectory, "admin-bossing-mobile-390.png"),
      fullPage: true,
    });
    await mobile.close();
  } finally {
    await browser?.close();
    await restoreBossingFlag(flagSnapshot);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

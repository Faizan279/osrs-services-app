import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-005");
const publicPath = "/services/power-levelling/skill-training-request";

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

async function openSkillingAdmin(page: Page) {
  await page.goto(`${baseUrl}/admin/catalogue/services?q=Skill%20training`);
  await settle(page);
  const editLink = page
    .locator('a[href^="/admin/catalogue/services/"]')
    .filter({ hasText: "Edit" })
    .first();
  if ((await editLink.count()) === 0) {
    throw new Error(
      `Skilling service editor link missing at ${page.url()}: ${await page.locator("body").innerText()}`,
    );
  }
  await editLink.click();
  await page.getByRole("link", { name: "Manage skilling" }).click();
  await settle(page);
}

async function estimate(page: Page) {
  await page.getByRole("button", { name: "Estimate total" }).click();
  await page.getByRole("heading", { name: "$5.00" }).waitFor();
  await settle(page);
}

async function validationError(page: Page) {
  await page.getByLabel("Current level").fill("50");
  await page.getByLabel("Target level").fill("50");
  await page.getByRole("button", { name: "Estimate total" }).click();
  await page.locator("#skilling-calculator-status").waitFor();
  await page
    .locator("#skilling-calculator-status")
    .filter({ hasText: "Target level must be higher than current level." })
    .waitFor();
  await settle(page);
}

function serviceIdFromSkillingUrl(page: Page) {
  const parts = new URL(page.url()).pathname.split("/");
  const index = parts.findIndex((part) => part === "services");
  const serviceId = parts[index + 1];
  if (!serviceId)
    throw new Error(`Could not read service id from ${page.url()}`);
  return serviceId;
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
    await publicPage.goto(`${baseUrl}${publicPath}`);
    await settle(publicPage);
    await publicPage.screenshot({
      path: path.join(outputDirectory, "public-skilling-calculator-1440.png"),
      fullPage: true,
    });
    await estimate(publicPage);
    await publicPage.screenshot({
      path: path.join(outputDirectory, "public-skilling-estimate-1440.png"),
      fullPage: true,
    });
    await validationError(publicPage);
    await publicPage.screenshot({
      path: path.join(outputDirectory, "public-skilling-validation-1440.png"),
      fullPage: true,
    });

    const admin = await desktop.newPage();
    await signIn(admin);
    await openSkillingAdmin(admin);
    await admin.addStyleTag({
      content: ".screenshot-sensitive { visibility: hidden !important; }",
    });
    await admin.screenshot({
      path: path.join(outputDirectory, "admin-skilling-overview-1440.png"),
      fullPage: true,
    });
    const serviceId = serviceIdFromSkillingUrl(admin);
    await admin.getByRole("link", { name: "Edit" }).first().click();
    await settle(admin);
    await admin.screenshot({
      path: path.join(outputDirectory, "admin-skilling-method-editor-1440.png"),
      fullPage: true,
    });
    await admin.goto(
      `${baseUrl}/admin/catalogue/services/${serviceId}/preview`,
    );
    await settle(admin);
    await admin.screenshot({
      path: path.join(outputDirectory, "admin-skilling-preview-1440.png"),
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
      path: path.join(outputDirectory, "public-skilling-mobile-390.png"),
      fullPage: true,
    });
    const adminMobile = await mobile.newPage();
    await signIn(adminMobile);
    await openSkillingAdmin(adminMobile);
    await adminMobile.screenshot({
      path: path.join(outputDirectory, "admin-skilling-mobile-390.png"),
      fullPage: true,
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

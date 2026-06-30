import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-001");

async function main() {
  if (!email || !password) {
    throw new Error(
      "ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required to capture Task 001 screenshots.",
    );
  }

  await mkdir(outputDirectory, { recursive: true });

  const browser = await chromium.launch();

  try {
    for (const viewport of [
      { name: "1440", width: 1440, height: 1000 },
      { name: "390", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(outputDirectory, `login-${viewport.name}.png`),
        fullPage: false,
      });

      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign in securely" }).click();
      await page.waitForURL("**/admin");
      await page.goto(`${baseUrl}/admin/design-system`, {
        waitUntil: "networkidle",
      });
      await page
        .getByRole("heading", { name: "OSRS Services design system" })
        .waitFor();
      await page.screenshot({
        path: path.join(outputDirectory, `design-system-${viewport.name}.png`),
        fullPage: false,
      });

      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

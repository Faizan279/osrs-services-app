import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const webServerCommand =
  process.env.PLAYWRIGHT_USE_DEV_SERVER === "true"
    ? "pnpm dev"
    : "pnpm build && pnpm start";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["junit", { outputFile: "test-results/e2e-junit.xml" }],
      ]
    : "list",
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: webServerCommand,
    url: "http://127.0.0.1:3000/health",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});

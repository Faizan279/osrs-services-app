import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
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
    command: "pnpm build && pnpm start",
    url: "http://127.0.0.1:3000/health",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});

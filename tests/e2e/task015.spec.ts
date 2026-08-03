import { expect, test, type Page } from "@playwright/test";
import mariadb from "mariadb";

async function databaseRows<T extends Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
) {
  const connection = await mariadb.createConnection({
    host: process.env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    allowPublicKeyRetrieval:
      process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === "true",
  });
  try {
    return (await connection.query(sql, values)) as T[];
  } finally {
    await connection.end();
  }
}

function tagForProject(projectName: string) {
  return projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

async function cleanupTask015Fixtures(tag: string) {
  await databaseRows(
    `DELETE FROM ChatConversation
     WHERE id IN (
       SELECT conversationId FROM ChatMessage WHERE body LIKE ?
     )`,
    [`Task 015 E2E ${tag}%`],
  );
  await databaseRows("DELETE FROM ChatGuestSession WHERE displayName = ?", [
    `Task 015 E2E ${tag}`,
  ]);
}

async function setChatAvailability(enabled: boolean) {
  await databaseRows(
    `UPDATE FeatureFlag
     SET enabled = CASE \`key\`
       WHEN 'live_chat_enabled' THEN ?
       WHEN 'guest_live_chat_enabled' THEN ?
       WHEN 'customer_live_chat_enabled' THEN ?
       WHEN 'chat_realtime_enabled' THEN 0
       ELSE enabled
     END
     WHERE \`key\` IN (
       'live_chat_enabled',
       'guest_live_chat_enabled',
       'customer_live_chat_enabled',
       'chat_realtime_enabled'
     )`,
    [enabled ? 1 : 0, enabled ? 1 : 0, enabled ? 1 : 0],
  );
  await databaseRows(
    `UPDATE ChatSettings
     SET availabilityMode = ?,
       publicLauncherEnabled = ?,
       offlineIntakeEnabled = ?,
       publicOnlineMessage = 'Support intake is available for Task 015 E2E.',
       publicOfflineMessage = 'Support intake is offline for Task 015 E2E.',
       publicMaintenanceMessage = 'Support intake is under maintenance for Task 015 E2E.',
       realtimeExpected = 0,
       needsClientReview = 1,
       concurrencyVersion = concurrencyVersion + 1
     WHERE stableKey = 'chat-default-settings'`,
    [enabled ? "ONLINE" : "OFFLINE", enabled ? 1 : 0, enabled ? 1 : 0],
  );
}

async function signInAdmin(page: Page) {
  test.skip(
    !process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD,
    "Admin seed credentials are required.",
  );
  await page.goto("/login?next=/admin/chat");
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/chat");
}

test.describe("Task 015 live chat foundation", () => {
  test("support page renders the default disabled state", async ({
    page,
  }, testInfo) => {
    const tag = tagForProject(testInfo.project.name);
    await cleanupTask015Fixtures(tag);
    await setChatAvailability(false);

    await page.goto("/support");

    await expect(
      page.getByRole("heading", { name: "Support chat" }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Chat is unavailable while the feature is disabled"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open support chat" }),
    ).toHaveCount(0);
  });

  test("guest chat starts through HTTP fallback and appears in admin queue", async ({
    page,
  }, testInfo) => {
    const tag = tagForProject(testInfo.project.name);
    const displayName = `Task 015 E2E ${tag}`;
    const message = `Task 015 E2E ${tag} needs order help.`;
    await cleanupTask015Fixtures(tag);
    await setChatAvailability(true);

    await page.goto("/support");
    await page.getByLabel("Display name").fill(displayName);
    await page.getByLabel("Category").fill("Order help");
    await page.getByLabel("Initial message").fill(message);
    await page.getByRole("button", { name: "Start chat" }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Acknowledge the chat safety reminder",
      }),
    ).toBeVisible();

    await page
      .getByLabel(/plain text and must not include credentials/i)
      .check();
    await page.getByRole("button", { name: "Start chat" }).click();

    await expect(
      page.getByRole("log", { name: "Chat transcript" }),
    ).toContainText(message);
    await expect(page.getByText("HTTP fallback")).toBeVisible();
    const visibleCookies = await page.evaluate(() => document.cookie);
    expect(visibleCookies).not.toContain("osrs_chat_guest");

    const guestSessionRows = await databaseRows<{ value: number }>(
      "SELECT COUNT(*) AS value FROM ChatGuestSession WHERE displayName = ? AND CHAR_LENGTH(tokenHash) = 64",
      [displayName],
    );
    expect(Number(guestSessionRows[0]?.value ?? 0)).toBe(1);

    await signInAdmin(page);
    await expect(
      page.getByRole("heading", { name: "Support chat" }),
    ).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });
});

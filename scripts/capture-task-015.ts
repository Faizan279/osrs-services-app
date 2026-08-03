import "dotenv/config";

import { createHash, createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import mariadb, { type Connection } from "mariadb";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-015");

const customerId = "task015shotcustomer";
const profileId = "task015shotprofile";
const sessionId = "task015shotsession";
const customerSessionToken = deriveToken("task015 screenshot customer session");
const guestDisplayName = "Task 015 Screenshot Guest";

const flagKeys = [
  "live_chat_enabled",
  "guest_live_chat_enabled",
  "customer_live_chat_enabled",
  "chat_realtime_enabled",
  "customer_accounts_enabled",
  "customer_dashboard_enabled",
] as const;

type FlagSnapshot = Map<string, boolean>;

function deriveToken(label: string) {
  return createHash("sha256")
    .update(label, "utf8")
    .digest("base64url")
    .slice(0, 43);
}

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(value: string) {
  return createHmac("sha256", requiredEnv("AUTH_SECRET"))
    .update(value, "utf8")
    .digest("hex");
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function connectDatabase() {
  return mariadb.createConnection({
    host: requiredEnv("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: requiredEnv("DATABASE_USER"),
    password: requiredEnv("DATABASE_PASSWORD"),
    database: requiredEnv("DATABASE_NAME"),
    allowPublicKeyRetrieval:
      process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === "true",
  });
}

async function rows<T>(
  connection: Connection,
  sql: string,
  values: unknown[] = [],
) {
  return (await connection.query(sql, values)) as T[];
}

async function snapshotFlags(connection: Connection) {
  const result = await rows<{ key: string; enabled: boolean | number }>(
    connection,
    `SELECT \`key\`, enabled FROM FeatureFlag WHERE \`key\` IN (${flagKeys
      .map(() => "?")
      .join(", ")})`,
    [...flagKeys],
  );
  return new Map(result.map((row) => [row.key, Boolean(row.enabled)]));
}

async function restoreFlags(snapshot: FlagSnapshot) {
  const connection = await connectDatabase();
  try {
    for (const [key, enabled] of snapshot) {
      await connection.query(
        "UPDATE FeatureFlag SET enabled = ? WHERE `key` = ?",
        [enabled ? 1 : 0, key],
      );
    }
  } finally {
    await connection.end();
  }
}

async function cleanup(connection: Connection) {
  const conversations = await rows<{
    id: string;
    guestSessionId: string | null;
  }>(
    connection,
    `SELECT conversation.id, conversation.guestSessionId
     FROM ChatConversation conversation
     LEFT JOIN ChatGuestSession guest ON guest.id = conversation.guestSessionId
     WHERE conversation.customerUserId = ?
       OR guest.displayName = ?`,
    [customerId, guestDisplayName],
  );
  for (const conversation of conversations) {
    await connection.query("DELETE FROM ChatConversation WHERE id = ?", [
      conversation.id,
    ]);
  }
  for (const conversation of conversations) {
    if (conversation.guestSessionId) {
      await connection.query("DELETE FROM ChatGuestSession WHERE id = ?", [
        conversation.guestSessionId,
      ]);
    }
  }
  await connection.query("DELETE FROM ChatGuestSession WHERE displayName = ?", [
    guestDisplayName,
  ]);
  await connection.query("DELETE FROM CustomerNotification WHERE userId = ?", [
    customerId,
  ]);
  await connection.query(
    "DELETE FROM CustomerNotificationPreference WHERE userId = ?",
    [customerId],
  );
  await connection.query("DELETE FROM Session WHERE id = ?", [sessionId]);
  await connection.query("DELETE FROM CustomerProfile WHERE userId = ?", [
    customerId,
  ]);
  await connection.query("DELETE FROM UserRole WHERE userId = ?", [customerId]);
  await connection.query("DELETE FROM User WHERE id = ?", [customerId]);
}

async function setChatEnabled(connection: Connection, enabled: boolean) {
  await connection.query(
    `UPDATE FeatureFlag
     SET enabled = CASE \`key\`
       WHEN 'live_chat_enabled' THEN ?
       WHEN 'guest_live_chat_enabled' THEN ?
       WHEN 'customer_live_chat_enabled' THEN ?
       WHEN 'chat_realtime_enabled' THEN 0
       WHEN 'customer_accounts_enabled' THEN 1
       WHEN 'customer_dashboard_enabled' THEN 1
       ELSE enabled
     END
     WHERE \`key\` IN (${flagKeys.map(() => "?").join(", ")})`,
    [enabled ? 1 : 0, enabled ? 1 : 0, enabled ? 1 : 0, ...flagKeys],
  );
  await connection.query(
    `UPDATE ChatSettings
     SET availabilityMode = ?,
       publicLauncherEnabled = ?,
       offlineIntakeEnabled = ?,
       publicOnlineMessage = 'Support intake is available for Task 015 screenshots.',
       publicOfflineMessage = 'Support intake is offline for Task 015 screenshots.',
       publicMaintenanceMessage = 'Support intake is under maintenance for Task 015 screenshots.',
       maximumMessageLength = 2000,
       realtimeExpected = 0,
       needsClientReview = 1,
       concurrencyVersion = concurrencyVersion + 1
     WHERE stableKey = 'chat-default-settings'`,
    [enabled ? "ONLINE" : "OFFLINE", enabled ? 1 : 0, enabled ? 1 : 0],
  );
  await connection.query(
    `UPDATE CustomerAccountSettings
     SET dashboardEnabled = 1,
       needsClientReview = 1
     WHERE stableKey = 'customer-accounts-default-settings'`,
  );
}

async function prepareCustomer(connection: Connection) {
  await connection.query(
    `INSERT INTO User
      (id, email, name, passwordHash, status, accountType, createdAt, updatedAt)
     VALUES (?, 'task015-screenshot@example.test',
      'Task 015 Screenshot Customer', ?, 'ACTIVE', 'CUSTOMER', NOW(3), NOW(3))`,
    [customerId, hash("task015 screenshot customer password marker")],
  );
  await connection.query(
    `INSERT INTO CustomerProfile
      (id, userId, displayName, defaultRsn, timezone, locale,
       emailVerificationStatus, registrationSource, needsReview, termsVersion,
       privacyPolicyVersion, termsAcceptedAt, privacyAcceptedAt,
       createdAt, updatedAt)
     VALUES (?, ?, 'Task 015 Screenshot Customer', 'Task015', 'UTC', 'en-US',
      'VERIFIED', 'CI_SCREENSHOT', 1, 'task015-screenshot-terms',
      'task015-screenshot-privacy', NOW(3), NOW(3), NOW(3), NOW(3))`,
    [profileId, customerId],
  );
  await connection.query(
    `INSERT INTO Session
      (id, sessionToken, userId, audience, expires, createdAt, lastSeenAt)
     VALUES (?, ?, ?, 'CUSTOMER', DATE_ADD(NOW(3), INTERVAL 1 DAY),
      NOW(3), NOW(3))`,
    [sessionId, hmac(customerSessionToken), customerId],
  );
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content: [
      "* { cursor: none !important; }",
      "html { scroll-behavior: auto !important; }",
      "a[href='#main-content'] { display: none !important; }",
      "header[class*='sticky'] { position: static !important; inset: auto !important; transform: none !important; }",
    ].join(" "),
  });
}

async function screenshot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({
    path: path.join(outputDirectory, name),
    fullPage: false,
  });
}

async function startGuestConversation(page: Page) {
  await page.getByLabel("Display name").fill(guestDisplayName);
  await page.getByLabel("Category").fill("Order help");
  await page
    .getByLabel("Initial message")
    .fill("Task 015 screenshot guest conversation.");
  await page.getByLabel(/plain text and must not include credentials/i).check();
  await page.getByRole("button", { name: "Start chat" }).click();
  await page
    .getByRole("log", { name: "Chat transcript" })
    .filter({ hasText: "Task 015 screenshot guest conversation." })
    .waitFor();
}

async function startCustomerConversation(page: Page) {
  await page
    .getByLabel("Initial message")
    .fill("Task 015 screenshot customer support conversation.");
  await page.getByLabel(/plain text and must not include credentials/i).check();
  await page.getByRole("button", { name: "Start chat" }).click();
  await page
    .getByRole("log", { name: "Chat transcript" })
    .filter({ hasText: "Task 015 screenshot customer support conversation." })
    .waitFor();
}

async function addCustomerCookie(context: BrowserContext) {
  await context.addCookies([
    {
      name: process.env.CUSTOMER_SESSION_COOKIE ?? "osrs_customer_session",
      value: customerSessionToken,
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function signInAdmin(page: Page) {
  await page.goto(`${baseUrl}/login?next=/admin/chat`);
  await page.getByLabel("Email address").fill(requiredEnv("ADMIN_SEED_EMAIL"));
  await page.getByLabel("Password").fill(requiredEnv("ADMIN_SEED_PASSWORD"));
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/chat");
}

async function capturePublic(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  let connection = await connectDatabase();
  try {
    await setChatEnabled(connection, false);
  } finally {
    await connection.end();
  }
  await page.goto(`${baseUrl}/support`);
  await page.getByText("Chat is unavailable").waitFor();
  await screenshot(page, "public-chat-disabled-1440.png");

  connection = await connectDatabase();
  try {
    await setChatEnabled(connection, true);
  } finally {
    await connection.end();
  }
  await page.goto(`${baseUrl}/support`);
  await page.getByRole("button", { name: "Start chat" }).waitFor();
  await screenshot(page, "public-chat-enabled-1440.png");
  await startGuestConversation(page);
  await screenshot(page, "public-chat-active-1440.png");

  await page.goto(`${baseUrl}/`);
  await page.getByRole("button", { name: "Open support chat" }).click();
  await page.getByRole("heading", { name: "Support chat" }).last().waitFor();
  await screenshot(page, "support-launcher-1440.png");
  await context.close();
}

async function capturePublicMobile(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/support`);
  await page.getByRole("button", { name: "Start chat" }).waitFor();
  await screenshot(page, "public-chat-mobile-390.png");
  await context.close();
}

async function captureCustomer(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await addCustomerCookie(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/account/support`);
  await page.getByRole("heading", { name: "Support" }).waitFor();
  await screenshot(page, "customer-chat-page-1440.png");
  await startCustomerConversation(page);
  await screenshot(page, "customer-chat-active-1440.png");
  await context.close();
}

async function captureAdmin(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signInAdmin(page);
  await page.getByRole("heading", { name: "Support chat" }).waitFor();
  await screenshot(page, "admin-chat-overview-1440.png");
  await screenshot(page, "admin-chat-settings-1440.png");
  await page.getByRole("link", { name: "Open" }).first().click();
  await page.getByRole("button", { name: "Redact" }).first().waitFor();
  await screenshot(page, "admin-chat-detail-1440.png");
  await context.close();
}

async function captureAdminMobile(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signInAdmin(page);
  await page.getByRole("heading", { name: "Support chat" }).waitFor();
  await screenshot(page, "admin-chat-mobile-390.png");
  await context.close();
}

async function main() {
  const connection = await connectDatabase();
  let flagSnapshot: FlagSnapshot | null = null;
  let browser: Browser | null = null;
  try {
    flagSnapshot = await snapshotFlags(connection);
    await cleanup(connection);
    await prepareCustomer(connection);
    await setChatEnabled(connection, true);
    await mkdir(outputDirectory, { recursive: true });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    await capturePublic(browser);
    await capturePublicMobile(browser);
    await captureCustomer(browser);
    await captureAdmin(browser);
    await captureAdminMobile(browser);
  } finally {
    await browser?.close();
    await connection.end();
    if (flagSnapshot) await restoreFlags(flagSnapshot);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

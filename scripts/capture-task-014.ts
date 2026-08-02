import "dotenv/config";

import { createHash, createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";
import mariadb, { type Connection } from "mariadb";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-014");
const customerId = "task014shotcustomer";
const profileId = "task014shotprofile";
const orderId = "task014shotorder";
const contactId = "task014shotcontact";
const orderItemId = "task014shotitem";
const orderLinkId = "task014shotlink";
const sessionId = "task014shotsession";
const notificationId = "task014shotnotification";
const paymentNotificationId = "task014shotpaynotification";
const sessionToken = deriveToken("task014 screenshot customer session");
const featureFlagKeys = [
  "customer_accounts_enabled",
  "customer_registration_enabled",
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

function requiredRow<T>(result: T[]) {
  const row = result[0];
  if (!row) throw new Error("Expected a database row for Task 014 setup.");
  return row;
}

async function snapshotFlags(connection: Connection) {
  const placeholders = featureFlagKeys.map(() => "?").join(", ");
  const result = await rows<{ key: string; enabled: boolean | number }>(
    connection,
    `SELECT \`key\`, enabled FROM FeatureFlag WHERE \`key\` IN (${placeholders})`,
    [...featureFlagKeys],
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
  await connection.query(
    "DELETE FROM CustomerNotificationPreference WHERE userId = ?",
    [customerId],
  );
  await connection.query("DELETE FROM CustomerNotification WHERE userId = ?", [
    customerId,
  ]);
  await connection.query("DELETE FROM CustomerSecurityEvent WHERE userId = ?", [
    customerId,
  ]);
  await connection.query("DELETE FROM CustomerAccountEvent WHERE userId = ?", [
    customerId,
  ]);
  await connection.query("DELETE FROM CustomerAuthToken WHERE userId = ?", [
    customerId,
  ]);
  await connection.query(
    "DELETE FROM CustomerOrderClaimEvent WHERE userId = ?",
    [customerId],
  );
  await connection.query("DELETE FROM CustomerOrderLink WHERE id = ?", [
    orderLinkId,
  ]);
  await connection.query("DELETE FROM Session WHERE userId = ?", [customerId]);
  await connection.query("DELETE FROM OrderPaymentEvent WHERE orderId = ?", [
    orderId,
  ]);
  await connection.query("DELETE FROM OrderStatusEvent WHERE orderId = ?", [
    orderId,
  ]);
  await connection.query("DELETE FROM OrderItem WHERE orderId = ?", [orderId]);
  await connection.query("DELETE FROM `Order` WHERE id = ?", [orderId]);
  await connection.query("DELETE FROM GuestOrderContact WHERE id = ?", [
    contactId,
  ]);
  await connection.query("DELETE FROM CustomerProfile WHERE userId = ?", [
    customerId,
  ]);
  await connection.query("DELETE FROM UserRole WHERE userId = ?", [customerId]);
  await connection.query("DELETE FROM User WHERE id = ?", [customerId]);
}

async function prepareRows(connection: Connection) {
  await cleanup(connection);
  const settings = requiredRow(
    await rows<{
      termsVersion: string;
      privacyPolicyVersion: string;
    }>(
      connection,
      `SELECT termsVersion, privacyPolicyVersion
       FROM CheckoutSettings
       WHERE stableKey = 'checkout-default-settings'
       LIMIT 1`,
    ),
  );
  const paymentMethod = requiredRow(
    await rows<{ id: string }>(
      connection,
      `SELECT id
       FROM CheckoutPaymentMethod
       WHERE stableKey = 'manual-review'
       LIMIT 1`,
    ),
  );
  await connection.query(
    `UPDATE FeatureFlag
     SET enabled = 1
     WHERE \`key\` IN (
       'customer_accounts_enabled',
       'customer_registration_enabled',
       'customer_dashboard_enabled'
     )`,
  );
  await connection.query(
    `UPDATE CustomerAccountSettings
     SET registrationEnabled = 1,
       dashboardEnabled = 1,
       passwordRecoveryEnabled = 1,
       notificationProviderConfigured = 0,
       needsClientReview = 1
     WHERE stableKey = 'customer-accounts-default-settings'`,
  );
  await connection.query(
    `INSERT INTO User
      (id, email, name, passwordHash, status, accountType, createdAt, updatedAt)
     VALUES (?, 'task014-screenshot@example.test', 'Task 014 Screenshot',
      ?, 'ACTIVE', 'CUSTOMER', NOW(3), NOW(3))`,
    [customerId, hash("task014 screenshot customer password hash marker")],
  );
  await connection.query(
    `INSERT INTO CustomerProfile
      (id, userId, displayName, discordUsername, defaultRsn, timezone, locale,
       emailVerificationStatus, registrationSource, needsReview, termsVersion,
       privacyPolicyVersion, termsAcceptedAt, privacyAcceptedAt,
       createdAt, updatedAt)
     VALUES (?, ?, 'Task 014 Screenshot', 'task014.shot', 'Task014',
      'UTC', 'en-US', 'PENDING_VERIFICATION', 'CI_SCREENSHOT', 1, ?, ?,
      NOW(3), NOW(3), NOW(3), NOW(3))`,
    [
      profileId,
      customerId,
      settings.termsVersion,
      settings.privacyPolicyVersion,
    ],
  );
  await connection.query(
    `INSERT INTO Session
      (id, sessionToken, userId, audience, expires, createdAt, lastSeenAt)
     VALUES (?, ?, ?, 'CUSTOMER', DATE_ADD(NOW(3), INTERVAL 1 DAY),
      NOW(3), NOW(3))`,
    [sessionId, hmac(sessionToken), customerId],
  );
  await connection.query(
    `INSERT INTO GuestOrderContact
      (id, displayName, email, discordUsername, rsn, consentAt,
       termsVersion, privacyPolicyVersion, createdAt)
     VALUES (?, 'Task 014 Guest Snapshot', 'task014-screenshot@example.test',
      'task014.guest', 'Task014', NOW(3), ?, ?, NOW(3))`,
    [contactId, settings.termsVersion, settings.privacyPolicyVersion],
  );
  await connection.query(
    `INSERT INTO \`Order\`
      (id, orderNumber, guestContactId, paymentMethodId, trackingTokenHash,
       checkoutIdempotencyKeyHash, status, paymentStatus, paymentMethodType,
       currencyCode, subtotalCents, adjustmentTotalCents, finalTotalCents,
       termsVersion, privacyPolicyVersion, createdAt, updatedAt)
     VALUES (?, 'TASK014-SHOT', ?, ?, ?, ?, 'IN_PROGRESS', 'PAID',
      'MANUAL_REVIEW', 'USD', 6400, 0, 6400, ?, ?, NOW(3), NOW(3))`,
    [
      orderId,
      contactId,
      paymentMethod.id,
      hash("task014 screenshot tracking marker"),
      hash("task014 screenshot checkout marker"),
      settings.termsVersion,
      settings.privacyPolicyVersion,
    ],
  );
  await connection.query(
    `INSERT INTO OrderItem
      (id, orderId, kind, publicTitle, publicConfigurationSummary, quantity,
       currencyCode, priceLines, subtotalCents, adjustmentTotalCents,
       finalTotalCents, sourceReference, publicSourceSlug,
       customerSafeSnapshot, resourceReservationState, createdAt)
     VALUES (?, ?, 'PRODUCT_ESTIMATE', 'Premium raid preparation',
      'Customer-safe service summary with no internal notes.', 1, 'USD',
      JSON_ARRAY(JSON_OBJECT('label', 'Premium raid preparation',
        'amountCents', 6400)),
      6400, 0, 6400, 'task014-shot-source', 'premium-raid-prep',
      JSON_OBJECT('task', '014', 'safe', true), 'ACTIVE', NOW(3))`,
    [orderItemId, orderId],
  );
  await connection.query(
    `INSERT INTO OrderStatusEvent
      (id, orderId, eventType, previousStatus, newStatus, publicNote,
       reasonCode, sequence, createdAt)
     VALUES ('task014shotstatus1', ?, 'CREATED', NULL, 'AWAITING_PAYMENT',
      'Order received for manual review.', 'TASK014_SCREENSHOT', 1, NOW(3)),
      ('task014shotstatus2', ?, 'STATUS_CHANGED', 'AWAITING_PAYMENT',
      'IN_PROGRESS', 'Work is in progress.', 'TASK014_SCREENSHOT', 2, NOW(3))`,
    [orderId, orderId],
  );
  await connection.query(
    `INSERT INTO OrderPaymentEvent
      (id, orderId, previousPaymentStatus, newPaymentStatus,
       paymentMethodType, publicNote, reasonCode, sequence, createdAt)
     VALUES ('task014shotpayment1', ?, NULL, 'AWAITING_INSTRUCTIONS',
      'MANUAL_REVIEW', 'Payment instructions are pending manual review.',
      'TASK014_SCREENSHOT', 1, NOW(3)),
      ('task014shotpayment2', ?, 'AWAITING_INSTRUCTIONS', 'PAID',
      'MANUAL_REVIEW', 'Payment was confirmed manually.',
      'TASK014_SCREENSHOT', 2, NOW(3))`,
    [orderId, orderId],
  );
  await connection.query(
    `INSERT INTO CustomerOrderLink
      (id, userId, orderId, source, safeCreatedByContext, createdAt, updatedAt)
     VALUES (?, ?, ?, 'AUTHENTICATED_CHECKOUT', 'ci-screenshot',
      NOW(3), NOW(3))`,
    [orderLinkId, customerId, orderId],
  );
  await connection.query(
    `INSERT INTO CustomerNotification
      (id, userId, orderId, type, status, title, body, dedupeKey,
       safeMetadata, createdAt, updatedAt)
     VALUES (?, ?, ?, 'ORDER_STATUS_CHANGED', 'UNREAD', 'Order is moving',
      'Your order status changed to in progress.',
      'task014-shot-order-status', JSON_OBJECT('safe', true), NOW(3), NOW(3)),
      (?, ?, ?, 'ORDER_PAYMENT_CHANGED', 'READ', 'Payment confirmed',
      'Manual payment review is complete.',
      'task014-shot-payment', JSON_OBJECT('safe', true), NOW(3), NOW(3))`,
    [
      notificationId,
      customerId,
      orderId,
      paymentNotificationId,
      customerId,
      orderId,
    ],
  );
  for (const type of [
    "ACCOUNT",
    "SECURITY",
    "ORDER_STATUS_CHANGED",
    "ORDER_PAYMENT_CHANGED",
    "EMAIL_VERIFICATION",
    "PASSWORD_RECOVERY",
  ]) {
    await connection.query(
      `INSERT INTO CustomerNotificationPreference
        (id, userId, type, inAppEnabled, emailEnabled, marketingConsent,
         createdAt, updatedAt)
       VALUES (?, ?, ?, 1, 0, 0, NOW(3), NOW(3))`,
      [
        `task014shotpref${type.toLowerCase().replace(/_/g, "")}`,
        customerId,
        type,
      ],
    );
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
      ".screenshot-sensitive { color: transparent !important; text-shadow: none !important; }",
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

async function signInAdmin(page: Page) {
  await page.goto(`${baseUrl}/login?next=/admin/customers`);
  await page.getByLabel("Email address").fill(requiredEnv("ADMIN_SEED_EMAIL"));
  await page.getByLabel("Password").fill(requiredEnv("ADMIN_SEED_PASSWORD"));
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/customers");
}

async function capturePublic(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/account/register`);
  await page
    .getByRole("heading", { name: "Create a customer account" })
    .waitFor();
  await screenshot(page, "public-customer-register-1440.png");
  await page.goto(`${baseUrl}/account/login`);
  await page.getByRole("heading", { name: "Customer sign in" }).waitFor();
  await screenshot(page, "public-customer-login-1440.png");
  await context.close();
}

async function addCustomerCookie(
  context: Awaited<ReturnType<Browser["newContext"]>>,
) {
  await context.addCookies([
    {
      name: process.env.CUSTOMER_SESSION_COOKIE ?? "osrs_customer_session",
      value: sessionToken,
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function captureCustomer(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await addCustomerCookie(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/account`);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  await screenshot(page, "public-customer-dashboard-1440.png");
  await page.goto(`${baseUrl}/account/orders`);
  await page.getByRole("heading", { name: "Orders" }).waitFor();
  await screenshot(page, "public-customer-orders-1440.png");
  await page.goto(`${baseUrl}/account/orders/TASK014-SHOT`);
  await page.getByRole("heading", { name: "TASK014-SHOT" }).waitFor();
  await screenshot(page, "public-customer-order-detail-1440.png");
  await page.goto(`${baseUrl}/account/notifications`);
  await page.getByRole("heading", { name: "Notifications" }).waitFor();
  await screenshot(page, "public-customer-notifications-1440.png");
  await page.goto(`${baseUrl}/account/security`);
  await page.getByRole("heading", { name: "Security" }).waitFor();
  await screenshot(page, "public-customer-security-1440.png");
  await context.close();
}

async function captureMobile(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await addCustomerCookie(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/account`);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  await screenshot(page, "public-customer-dashboard-mobile-390.png");
  await context.close();
}

async function captureAdmin(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signInAdmin(page);
  await page.getByRole("heading", { name: "Customers" }).waitFor();
  await screenshot(page, "admin-customers-overview-1440.png");
  await page.goto(`${baseUrl}/admin/customers/${customerId}`);
  await page.getByRole("heading", { name: "Task 014 Screenshot" }).waitFor();
  await screenshot(page, "admin-customer-detail-1440.png");
  await context.close();
}

async function main() {
  const connection = await connectDatabase();
  let flagSnapshot: FlagSnapshot | null = null;
  let browser: Browser | null = null;
  try {
    flagSnapshot = await snapshotFlags(connection);
    await prepareRows(connection);
    await mkdir(outputDirectory, { recursive: true });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    await capturePublic(browser);
    await captureCustomer(browser);
    await captureMobile(browser);
    await captureAdmin(browser);
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

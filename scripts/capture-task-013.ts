import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";
import mariadb, { type Connection } from "mariadb";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-013");
const cartToken = "task013ScreenshotCartToken12345678901234567";
const trackingToken = "task013ScreenshotTrackToken12345678901234";
const flagKeys = ["cart_enabled", "guest_checkout_enabled"] as const;

type FlagSnapshot = Map<string, boolean>;

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
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
  if (!row) throw new Error("Expected a database row for Task 013 setup.");
  return row;
}

async function snapshotFlags(connection: Connection) {
  const placeholders = flagKeys.map(() => "?").join(", ");
  const result = await rows<{ key: string; enabled: boolean | number }>(
    connection,
    `SELECT \`key\`, enabled FROM FeatureFlag WHERE \`key\` IN (${placeholders})`,
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

function itemSnapshot({
  title,
  totalCents,
  itemKind = "PRODUCT_ESTIMATE",
  reservationRequired = true,
  repricingRequired = false,
}: {
  title: string;
  totalCents: number;
  itemKind?: "PRODUCT_ESTIMATE" | "SKILLING_ESTIMATE";
  reservationRequired?: boolean;
  repricingRequired?: boolean;
}) {
  return JSON.stringify({
    schemaVersion: 1,
    itemKind,
    compatibilityGroup: "STANDARD_SERVICE",
    publicTitle: title,
    publicDescription: "Screenshot checkout item",
    publicConfigurationSummary:
      itemKind === "PRODUCT_ESTIMATE"
        ? "Bond marketplace demo x 2 bonds"
        : "Agility training preview with standard delivery",
    quantity: itemKind === "PRODUCT_ESTIMATE" ? "2" : "1",
    currency: "USD",
    authoritativeLineItems: [{ label: title, amountCents: totalCents }],
    subtotalCents: totalCents,
    customerSafeGlobalPricingLines: [],
    finalEstimatedTotalCents: totalCents,
    sourceRevision: { id: null, revisionNumber: null },
    generatedAt: "2026-07-31T15:00:00.000Z",
    repricingRequired,
    reservationRequired,
  });
}

async function cleanup(connection: Connection) {
  await connection.query(
    "DELETE FROM OrderNotificationOutbox WHERE id LIKE 'task013shot%'",
  );
  await connection.query(
    "DELETE FROM OrderPaymentEvent WHERE id LIKE 'task013shot%'",
  );
  await connection.query(
    "DELETE FROM OrderStatusEvent WHERE id LIKE 'task013shot%'",
  );
  await connection.query("DELETE FROM OrderItem WHERE id LIKE 'task013shot%'");
  await connection.query("DELETE FROM `Order` WHERE id LIKE 'task013shot%'");
  await connection.query(
    "DELETE FROM GuestOrderContact WHERE id LIKE 'task013shot%'",
  );
  await connection.query("DELETE FROM CartItem WHERE id LIKE 'task013shot%'");
  await connection.query("DELETE FROM Cart WHERE id LIKE 'task013shot%'");
}

async function prepareRows(connection: Connection) {
  await cleanup(connection);
  const settings = requiredRow(
    await rows<{
      id: string;
      termsVersion: string;
      privacyPolicyVersion: string;
    }>(
      connection,
      "SELECT id, termsVersion, privacyPolicyVersion FROM CheckoutSettings ORDER BY createdAt ASC LIMIT 1",
    ),
  );
  const method = requiredRow(
    await rows<{ id: string }>(
      connection,
      "SELECT id FROM CheckoutPaymentMethod WHERE stableKey = 'manual-review' LIMIT 1",
    ),
  );
  const product = requiredRow(
    await rows<{
      productStableKey: string;
      variantStableKey: string;
    }>(
      connection,
      `SELECT product.stableKey AS productStableKey,
         variant.stableKey AS variantStableKey
       FROM ProductVariant variant
       INNER JOIN Product product ON product.id = variant.productId
       WHERE variant.stableKey = 'product-variant-bond-unit'
       LIMIT 1`,
    ),
  );

  await connection.query(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` IN ('cart_enabled', 'guest_checkout_enabled')",
  );
  await connection.query(
    `UPDATE CheckoutSettings
     SET guestCheckoutEnabled = 1, needsClientReview = 0
     WHERE id = ?`,
    [settings.id],
  );

  const productSnapshot = itemSnapshot({
    title: "Bond marketplace demo",
    totalCents: 999,
  });
  const skillingSnapshot = itemSnapshot({
    title: "Agility training",
    totalCents: 1500,
    itemKind: "SKILLING_ESTIMATE",
    reservationRequired: false,
  });
  await connection.query(
    `INSERT INTO Cart
      (id, tokenHash, status, compatibilityGroup, currencyCode,
       subtotalCents, adjustmentTotalCents, finalTotalCents, itemCount,
       expiresAt, createdAt, updatedAt)
     VALUES ('task013shotcart', ?, 'ACTIVE', 'STANDARD_SERVICE', 'USD',
       2499, 0, 2499, 2, DATE_ADD(NOW(3), INTERVAL 2 HOUR), NOW(3), NOW(3))`,
    [hash(cartToken)],
  );
  await connection.query(
    `INSERT INTO CartItem
      (id, cartId, kind, compatibilityGroup, sourceReference, publicSourceSlug,
       quantity, currencyCode, customerSelections, customerSafeSnapshot,
       subtotalCents, adjustmentTotalCents, finalTotalCents, validationState,
       stockRecheckRequired, availabilityRecheckRequired, createdAt, updatedAt)
     VALUES ('task013shotcartitem', 'task013shotcart', 'PRODUCT_ESTIMATE',
       'STANDARD_SERVICE', ?, 'bond-marketplace-demo', 2, 'USD',
       JSON_OBJECT('screenshot', true), ?, 999, 0, 999,
       'RESERVATION_REQUIRED', 1, 1, NOW(3), NOW(3))`,
    [
      `${product.productStableKey}:${product.variantStableKey}`,
      productSnapshot,
    ],
  );
  await connection.query(
    `INSERT INTO CartItem
      (id, cartId, kind, compatibilityGroup, sourceReference, publicSourceSlug,
       quantity, currencyCode, customerSelections, customerSafeSnapshot,
       subtotalCents, adjustmentTotalCents, finalTotalCents, validationState,
       createdAt, updatedAt)
     VALUES ('task013shotskillitem', 'task013shotcart', 'SKILLING_ESTIMATE',
       'STANDARD_SERVICE', 'task013-screenshot-skilling', 'agility-training',
       1, 'USD', JSON_OBJECT('screenshot', true), ?, 1500, 0, 1500,
       'VALID', NOW(3), NOW(3))`,
    [skillingSnapshot],
  );

  await connection.query(
    `INSERT INTO GuestOrderContact
      (id, displayName, email, discordUsername, rsn, consentAt,
       termsVersion, privacyPolicyVersion, createdAt)
     VALUES ('task013shotcontact', 'Task 013 Screenshot',
       'task013-screenshot@example.test', 'task013.screenshot', 'Task013',
       NOW(3), ?, ?, NOW(3))`,
    [settings.termsVersion, settings.privacyPolicyVersion],
  );
  await connection.query(
    `INSERT INTO \`Order\`
      (id, orderNumber, guestContactId, paymentMethodId, trackingTokenHash,
       checkoutIdempotencyKeyHash, status, paymentStatus, paymentMethodType,
       currencyCode, subtotalCents, adjustmentTotalCents, finalTotalCents,
       termsVersion, privacyPolicyVersion, createdAt, updatedAt)
     VALUES ('task013shotorder', 'TASK013-SHOT', 'task013shotcontact',
       ?, ?, ?, 'AWAITING_PAYMENT', 'AWAITING_INSTRUCTIONS',
       'MANUAL_REVIEW', 'USD', 999, 0, 999, ?, ?, NOW(3), NOW(3))`,
    [
      method.id,
      hash(trackingToken),
      hash("task013-screenshot-checkout"),
      settings.termsVersion,
      settings.privacyPolicyVersion,
    ],
  );
  await connection.query(
    `INSERT INTO OrderItem
      (id, orderId, kind, publicTitle, publicConfigurationSummary, quantity,
       currencyCode, priceLines, subtotalCents, adjustmentTotalCents,
       finalTotalCents, sourceReference, publicSourceSlug, customerSafeSnapshot,
       resourceReservationState, createdAt)
     VALUES ('task013shotitem', 'task013shotorder', 'PRODUCT_ESTIMATE',
       'Bond marketplace demo', 'Bond marketplace demo x 2 bonds', 2, 'USD',
       ?, 999, 0, 999, ?, 'bond-marketplace-demo', ?, 'ACTIVE', NOW(3))`,
    [
      JSON.stringify([{ label: "Bond marketplace demo", amountCents: 999 }]),
      `${product.productStableKey}:${product.variantStableKey}`,
      productSnapshot,
    ],
  );
  await connection.query(
    `INSERT INTO OrderStatusEvent
      (id, orderId, eventType, previousStatus, newStatus, publicNote,
       reasonCode, sequence, createdAt)
     VALUES ('task013shotstatus', 'task013shotorder', 'CREATED', NULL,
       'AWAITING_PAYMENT', 'Order received for manual payment review.',
       'TASK013_SCREENSHOT', 1, NOW(3))`,
  );
  await connection.query(
    `INSERT INTO OrderPaymentEvent
      (id, orderId, previousPaymentStatus, newPaymentStatus, paymentMethodType,
       publicNote, reasonCode, sequence, createdAt)
     VALUES ('task013shotpayment', 'task013shotorder', NULL,
       'AWAITING_INSTRUCTIONS', 'MANUAL_REVIEW',
       'Payment instructions will be provided after your order is reviewed.',
       'TASK013_SCREENSHOT', 1, NOW(3))`,
  );
  await connection.query(
    `INSERT INTO OrderNotificationOutbox
      (id, orderId, notificationType, status, recipientHash, templateVersion,
       payload, createdAt, updatedAt)
     VALUES ('task013shotnotify', 'task013shotorder', 'ORDER_CONFIRMATION',
       'SUPPRESSED_NOT_CONFIGURED', ?, 'task013-v1',
       JSON_OBJECT('screenshot', true), NOW(3), NOW(3))`,
    [hash("task013-screenshot@example.test")],
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

async function signIn(page: Page) {
  const email = requiredEnv("ADMIN_SEED_EMAIL");
  const password = requiredEnv("ADMIN_SEED_PASSWORD");
  await page.goto(`${baseUrl}/login?next=/admin/orders`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/orders");
}

async function capturePublic(browser: Browser, connection: Connection) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await context.addCookies([
    {
      name: "osrs_guest_cart",
      value: cartToken,
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/cart`);
  await page.getByRole("heading", { name: "Cart" }).waitFor();
  await screenshot(page, "public-cart-1440.png");
  await screenshot(page, "public-cart-mixed-items-1440.png");

  await connection.query(
    `UPDATE CartItem
     SET validationState = 'REPRICE_REQUIRED',
       repricingRequired = 1,
       updatedAt = NOW(3)
     WHERE id = 'task013shotskillitem'`,
  );
  await page.reload();
  await page.getByText("Review updated total").waitFor();
  await screenshot(page, "public-cart-repricing-1440.png");

  await page.goto(`${baseUrl}/checkout`);
  await page.getByRole("heading", { name: "Guest checkout" }).waitFor();
  await screenshot(page, "public-checkout-1440.png");

  await page.goto(`${baseUrl}/checkout/confirmation/${trackingToken}`);
  await page.getByText("TASK013-SHOT").waitFor();
  await screenshot(page, "public-order-confirmation-1440.png");

  await page.goto(`${baseUrl}/orders/track/${trackingToken}`);
  await page.getByText("TASK013-SHOT").waitFor();
  await screenshot(page, "public-order-tracking-1440.png");
  await context.close();
}

async function captureMobile(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await context.addCookies([
    {
      name: "osrs_guest_cart",
      value: cartToken,
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/checkout`);
  await page.getByRole("heading", { name: "Guest checkout" }).waitFor();
  await screenshot(page, "public-checkout-mobile-390.png");
  await context.close();
}

async function captureAdmin(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signIn(page);
  await page.getByRole("heading", { name: "Orders" }).waitFor();
  await screenshot(page, "admin-orders-overview-1440.png");

  await page.goto(`${baseUrl}/admin/orders/task013shotorder`);
  await page.getByText("TASK013-SHOT").waitFor();
  await screenshot(page, "admin-order-detail-1440.png");

  await page
    .getByRole("heading", { name: "Payment review" })
    .scrollIntoViewIfNeeded();
  await screenshot(page, "admin-order-payment-review-1440.png");
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
    await capturePublic(browser, connection);
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

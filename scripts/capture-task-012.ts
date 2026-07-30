import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";
import mariadb, { type Connection } from "mariadb";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-012");
const flagKeys = [
  "product_marketplace_enabled",
  "global_pricing_enabled",
] as const;

type FlagSnapshot = Map<string, boolean>;

async function connectDatabase() {
  if (
    !process.env.DATABASE_USER ||
    !process.env.DATABASE_NAME ||
    !process.env.DATABASE_HOST
  ) {
    throw new Error(
      "Database environment is required to enable Task 012 screenshots.",
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

async function queryRows<T>(
  connection: Connection,
  sql: string,
  values: unknown[] = [],
) {
  return (await connection.query(sql, values)) as T[];
}

function requiredRow<T>(rows: T[]) {
  const row = rows[0];
  if (!row) throw new Error("Expected a database row for Task 012 setup.");
  return row;
}

async function snapshotFlags(connection: Connection) {
  const placeholders = flagKeys.map(() => "?").join(", ");
  const rows = await queryRows<{ key: string; enabled: boolean | number }>(
    connection,
    `SELECT \`key\`, enabled FROM FeatureFlag WHERE \`key\` IN (${placeholders})`,
    [...flagKeys],
  );
  const snapshot: FlagSnapshot = new Map(
    rows.map((row) => [row.key, Boolean(row.enabled)]),
  );
  for (const key of flagKeys) {
    if (!snapshot.has(key)) throw new Error(`Feature flag ${key} is missing.`);
  }
  return snapshot;
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

async function upsertProductPricingRevision(connection: Connection) {
  const ruleSet = requiredRow(
    await queryRows<{ id: string }>(
      connection,
      "SELECT id FROM PricingRuleSet ORDER BY createdAt ASC LIMIT 1",
    ),
  );
  const publishedAt = "2026-07-30T15:00:00.000Z";
  const snapshot = {
    schemaVersion: 1,
    ruleSetId: ruleSet.id,
    revisionId: "task012pricingrevision",
    revisionNumber: 12,
    currencyCode: "USD",
    publishedAt,
    rules: [
      {
        id: "task012handling",
        publicLabel: "Product handling",
        enabled: true,
        ruleType: "FIXED_ADDITION",
        amountCents: 50,
        valueBps: null,
        priority: 0,
        exclusiveGroupKey: null,
        effectiveStart: null,
        effectiveEnd: null,
        applicability: [
          {
            scope: "ENGINE_TYPE",
            engineType: "PRODUCT_MARKETPLACE",
            categoryId: null,
            serviceId: null,
          },
        ],
      },
    ],
  };
  await connection.query(
    `INSERT INTO PricingRevision
      (id, ruleSetId, revisionNumber, snapshot, publishedAt, createdAt)
     VALUES ('task012pricingrevision', ?, 12, ?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE
       snapshot = VALUES(snapshot),
       publishedAt = VALUES(publishedAt)`,
    [ruleSet.id, JSON.stringify(snapshot), "2026-07-30 15:00:00.000"],
  );
}

async function setBondStock(connection: Connection, onHandQuantity: number) {
  await connection.query(
    `UPDATE ProductVariant
     SET onHandQuantity = ?, availabilityState = 'AVAILABLE',
       status = 'AVAILABLE', enabled = 1, lowStockThreshold = 3,
       concurrencyVersion = concurrencyVersion + 1
     WHERE stableKey = 'product-variant-bond-unit'`,
    [onHandQuantity],
  );
}

async function prepareProductRows(connection: Connection) {
  const admin = requiredRow(
    await queryRows<{ id: string }>(
      connection,
      "SELECT id FROM User WHERE email = ? LIMIT 1",
      [process.env.ADMIN_SEED_EMAIL?.toLowerCase()],
    ),
  );
  await connection.query(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'product_marketplace_enabled'",
  );
  await connection.query(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'global_pricing_enabled'",
  );
  await connection.query(
    `UPDATE CatalogueService
     SET availabilityState = 'AVAILABLE', publicationStatus = 'PUBLISHED'
     WHERE seededKey = 'product-marketplace'`,
  );
  await connection.query(
    "UPDATE ProductMarketplace SET availabilityState = 'AVAILABLE' WHERE stableKey = 'product-main-marketplace'",
  );
  await connection.query(
    "UPDATE ProductCategory SET enabled = 1 WHERE stableKey IN ('product-category-items', 'product-category-bonds', 'product-category-outfits')",
  );
  await connection.query(
    `UPDATE Product
     SET publicationStatus = 'PUBLISHED', availabilityState = 'AVAILABLE',
       publishedAt = COALESCE(publishedAt, '2026-07-30 15:00:00.000')
     WHERE stableKey = 'product-osrs-bond-demo'`,
  );
  await setBondStock(connection, 20);
  await upsertProductPricingRevision(connection);

  await connection.query(
    "DELETE FROM ProductReservationEvent WHERE reservationId = 'task012screenshotreservation'",
  );
  await connection.query(
    "DELETE FROM ProductInventoryReservation WHERE id = 'task012screenshotreservation'",
  );
  await connection.query(
    "DELETE FROM ProductInventoryLedgerEntry WHERE id = 'task012screenshotledger'",
  );
  await connection.query(
    `INSERT INTO ProductInventoryLedgerEntry
      (id, variantId, entryType, quantity, resultingOnHandQuantity,
       reason, internalNote, actorId, referenceKey, createdAt)
     VALUES ('task012screenshotledger', 'prodvarbondunit012', 'STOCK_IN',
       20, 20, 'Screenshot stock fixture', NULL, ?,
       'task012-screenshot-ledger', NOW(3))`,
    [admin.id],
  );
  await connection.query(
    `INSERT INTO ProductInventoryReservation
      (id, stableKey, variantId, quantity, status, expiresAt, releasedAt,
       safeInternalPurpose, actorId, idempotencyKey, futureExternalRef,
       concurrencyVersion, createdAt, updatedAt)
     VALUES ('task012screenshotreservation',
       'task012-screenshot-reservation', 'prodvarbondunit012', 2,
       'ACTIVE', '2030-01-01 00:00:00.000', NULL,
       'Screenshot internal reservation fixture', ?,
       'task012-screenshot-reservation-key', NULL, 1, NOW(3), NOW(3))`,
    [admin.id],
  );
  await connection.query(
    `INSERT INTO ProductReservationEvent
      (id, reservationId, eventType, safeMetadata, actorId, createdAt)
     VALUES ('task012screenshotevent', 'task012screenshotreservation',
       'ACTIVE', ?, ?, NOW(3))`,
    [JSON.stringify({ screenshot: true }), admin.id],
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
    await page.goto(`${baseUrl}/admin/products`);
    await page.waitForURL((url) => url.pathname === "/admin/products");
    return;
  }

  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error("Admin seed credentials are required.");
  }
  await page.goto(`${baseUrl}/login?next=/admin/products`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/products");
}

async function screenshot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({
    path: path.join(outputDirectory, name),
    fullPage: false,
  });
}

async function capturePublicPages(browser: Browser, connection: Connection) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/products`);
  await page
    .getByRole("heading", { name: "OSRS Product Marketplace" })
    .waitFor();
  await screenshot(page, "public-products-marketplace-1440.png");

  await page.goto(
    `${baseUrl}/products?type=BOND&category=bonds&q=bond&inStock=1&sort=price_asc`,
  );
  await page.getByText("Bond marketplace demo").first().waitFor();
  await screenshot(page, "public-products-filtered-1440.png");

  await page.goto(`${baseUrl}/products/bond-marketplace-demo`);
  await page.getByRole("heading", { name: "Bond marketplace demo" }).waitFor();
  await screenshot(page, "public-product-detail-1440.png");

  await page.getByRole("spinbutton", { name: "Quantity" }).fill("5");
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await page.getByText("Product handling").waitFor();
  await screenshot(page, "public-product-estimate-1440.png");

  await setBondStock(connection, 0);
  await page.goto(`${baseUrl}/products/bond-marketplace-demo`);
  await page.getByText("Currently out of stock.").first().waitFor();
  await screenshot(page, "public-product-out-of-stock-1440.png");

  await setBondStock(connection, 20);
  await context.close();
}

async function captureMobilePage(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/products`);
  await page
    .getByRole("heading", { name: "OSRS Product Marketplace" })
    .waitFor();
  await page.getByText("Product filters").waitFor();
  await screenshot(page, "public-products-mobile-390.png");
  await context.close();
}

async function captureAdminPages(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signIn(page);
  await page.getByRole("heading", { name: "Products Centre" }).waitFor();
  await screenshot(page, "admin-products-overview-1440.png");

  await page.goto(`${baseUrl}/admin/products/prodsourcebond012`);
  await page.getByRole("heading", { name: "Bond marketplace demo" }).waitFor();
  await screenshot(page, "admin-product-editor-1440.png");

  await page.goto(`${baseUrl}/admin/products/prodsourcebond012/inventory`);
  await page.getByText("Screenshot stock fixture").waitFor();
  await screenshot(page, "admin-product-inventory-1440.png");

  await page.goto(`${baseUrl}/admin/products/prodsourcebond012/reservations`);
  await page
    .getByRole("heading", { name: "Expire stale reservations" })
    .waitFor();
  await page.getByText("2").first().waitFor();
  await screenshot(page, "admin-product-reservations-1440.png");

  await context.close();
}

async function main() {
  const connection = await connectDatabase();
  let flagSnapshot: FlagSnapshot | null = null;
  let browser: Browser | null = null;
  try {
    flagSnapshot = await snapshotFlags(connection);
    await prepareProductRows(connection);
    await mkdir(outputDirectory, { recursive: true });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    await capturePublicPages(browser, connection);
    await captureMobilePage(browser);
    await captureAdminPages(browser);
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

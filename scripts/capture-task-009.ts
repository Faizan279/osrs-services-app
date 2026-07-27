import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";
import mariadb, { type Connection } from "mariadb";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-009");
const goldPath = "/services/gold/gold-trading";
const flagKeys = ["gold_engine_enabled", "global_pricing_enabled"] as const;

const screenshotRateSetId = "task009scrrateset";
const screenshotBuyRateId = "task009scrbuyrate";
const screenshotSellRateId = "task009scrsellrate";
const screenshotRevisionId = "task009scrrevision";
const screenshotRevisionNumber = 9009;

type FlagSnapshot = Map<string, boolean>;
type MarketSnapshot = {
  id: string;
  availabilityState: string;
  stockQuantityGp: string;
  buyingCapacityGp: string;
  secureServiceEnabled: boolean;
  secureServicePricingMode: string;
  secureServiceFixedMinorUnits: number;
  secureServiceBps: number;
  secureServiceCustomerBuys: boolean;
  secureServiceCustomerSells: boolean;
};

async function connectDatabase() {
  if (
    !process.env.DATABASE_USER ||
    !process.env.DATABASE_NAME ||
    !process.env.DATABASE_HOST
  ) {
    throw new Error(
      "Database environment is required to enable Task 009 screenshots.",
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

async function snapshotMarket(connection: Connection) {
  const market = (
    await queryRows<MarketSnapshot>(
      connection,
      `SELECT id, availabilityState, CAST(stockQuantityGp AS CHAR) AS stockQuantityGp,
        CAST(buyingCapacityGp AS CHAR) AS buyingCapacityGp,
        secureServiceEnabled, secureServicePricingMode,
        secureServiceFixedMinorUnits, secureServiceBps,
        secureServiceCustomerBuys, secureServiceCustomerSells
       FROM GoldMarket
       WHERE stableKey = 'gold-main-market'
       LIMIT 1`,
    )
  )[0];
  if (!market) throw new Error("Gold market is missing.");
  return {
    ...market,
    secureServiceEnabled: Boolean(market.secureServiceEnabled),
    secureServiceCustomerBuys: Boolean(market.secureServiceCustomerBuys),
    secureServiceCustomerSells: Boolean(market.secureServiceCustomerSells),
  };
}

async function restoreMarket(snapshot: MarketSnapshot) {
  const connection = await connectDatabase();
  try {
    await connection.query(
      `UPDATE GoldMarket
       SET availabilityState = ?, stockQuantityGp = ?, buyingCapacityGp = ?,
         secureServiceEnabled = ?, secureServicePricingMode = ?,
         secureServiceFixedMinorUnits = ?, secureServiceBps = ?,
         secureServiceCustomerBuys = ?, secureServiceCustomerSells = ?
       WHERE id = ?`,
      [
        snapshot.availabilityState,
        snapshot.stockQuantityGp,
        snapshot.buyingCapacityGp,
        snapshot.secureServiceEnabled ? 1 : 0,
        snapshot.secureServicePricingMode,
        snapshot.secureServiceFixedMinorUnits,
        snapshot.secureServiceBps,
        snapshot.secureServiceCustomerBuys ? 1 : 0,
        snapshot.secureServiceCustomerSells ? 1 : 0,
        snapshot.id,
      ],
    );
  } finally {
    await connection.end();
  }
}

async function setStock(stockQuantityGp: string) {
  const connection = await connectDatabase();
  try {
    await connection.query(
      "UPDATE GoldMarket SET stockQuantityGp = ? WHERE stableKey = 'gold-main-market'",
      [stockQuantityGp],
    );
  } finally {
    await connection.end();
  }
}

async function prepareGoldRows(connection: Connection, market: MarketSnapshot) {
  const service = (
    await queryRows<{
      id: string;
      slug: string;
      categoryId: string;
      categorySlug: string;
      publicName: string;
    }>(
      connection,
      `SELECT service.id, service.slug, service.categoryId,
        category.slug AS categorySlug
       FROM CatalogueService service
       INNER JOIN CatalogueCategory category ON category.id = service.categoryId
       WHERE service.seededKey = 'gold-trading'
       LIMIT 1`,
    )
  )[0];
  if (!service) throw new Error("Seeded gold service is missing.");

  await connection.query(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'gold_engine_enabled'",
  );
  await connection.query(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'global_pricing_enabled'",
  );
  await connection.query(
    `UPDATE GoldMarket
     SET availabilityState = 'AVAILABLE', stockQuantityGp = 200000000,
       buyingCapacityGp = 200000000, secureServiceEnabled = 1,
       secureServicePricingMode = 'FIXED_MINOR_UNITS',
       secureServiceFixedMinorUnits = 199, secureServiceBps = 0,
       secureServiceCustomerBuys = 1, secureServiceCustomerSells = 1
     WHERE id = ?`,
    [market.id],
  );
  await connection.query(
    `INSERT INTO GoldRateSet
      (id, marketId, status, version, publishedAt, internalNotes,
       needsClientReview, concurrencyVersion, createdAt, updatedAt)
     VALUES (?, ?, 'PUBLISHED', 9009, NOW(3), ?, 0, 1, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE
       marketId = VALUES(marketId),
       status = VALUES(status),
       version = VALUES(version),
       publishedAt = NOW(3),
       updatedAt = NOW(3)`,
    [
      screenshotRateSetId,
      market.id,
      "Temporary Task 009 screenshot published rate set.",
    ],
  );
  for (const [id, direction, rateMinorUnitsPerMillion] of [
    [screenshotBuyRateId, "CUSTOMER_BUYS_GOLD", 25],
    [screenshotSellRateId, "CUSTOMER_SELLS_GOLD", 18],
  ] as const) {
    await connection.query(
      `INSERT INTO GoldRate
        (id, rateSetId, direction, rateMinorUnitsPerMillion,
         minimumQuantityGp, maximumQuantityGp, automaticReviewMaximumGp,
         effectiveStart, effectiveEnd, enabled, needsClientReview,
         concurrencyVersion, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 10000000, 500000000, 100000000,
         '2026-07-24 00:00:00.000', NULL, 1, 0, 1, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         rateMinorUnitsPerMillion = VALUES(rateMinorUnitsPerMillion),
         minimumQuantityGp = VALUES(minimumQuantityGp),
         maximumQuantityGp = VALUES(maximumQuantityGp),
         automaticReviewMaximumGp = VALUES(automaticReviewMaximumGp),
         effectiveStart = VALUES(effectiveStart),
         effectiveEnd = VALUES(effectiveEnd),
         enabled = VALUES(enabled),
         updatedAt = NOW(3)`,
      [id, screenshotRateSetId, direction, rateMinorUnitsPerMillion],
    );
  }

  const snapshot = {
    schemaVersion: 1,
    market: {
      id: market.id,
      stableKey: "gold-main-market",
      slug: "gold-trading",
      serviceId: service.id,
      serviceSlug: service.slug,
      categoryId: service.categoryId,
      categorySlug: service.categorySlug,
      publicName: "OSRS Gold Trading",
      currencyCode: "USD",
    },
    revision: {
      id: screenshotRevisionId,
      revisionNumber: screenshotRevisionNumber,
      publishedAt: "2026-07-25T00:00:00.000Z",
    },
    rates: [
      {
        direction: "CUSTOMER_BUYS_GOLD",
        rateMinorUnitsPerMillion: 25,
        minimumQuantityGp: "10000000",
        maximumQuantityGp: "500000000",
        automaticReviewMaximumGp: "100000000",
        effectiveStart: "2026-07-24T00:00:00.000Z",
        effectiveEnd: null,
        enabled: true,
      },
      {
        direction: "CUSTOMER_SELLS_GOLD",
        rateMinorUnitsPerMillion: 18,
        minimumQuantityGp: "10000000",
        maximumQuantityGp: "500000000",
        automaticReviewMaximumGp: "100000000",
        effectiveStart: "2026-07-24T00:00:00.000Z",
        effectiveEnd: null,
        enabled: true,
      },
    ],
  };
  await connection.query(
    `DELETE FROM GoldRateRevision
     WHERE id = ? OR (marketId = ? AND revisionNumber = ?)`,
    [screenshotRevisionId, market.id, screenshotRevisionNumber],
  );
  await connection.query(
    `INSERT INTO GoldRateRevision
      (id, marketId, rateSetId, revisionNumber, snapshotSchemaVersion,
       snapshot, publishedAt, createdAt)
     VALUES (?, ?, ?, ?, 1, ?, NOW(3), NOW(3))`,
    [
      screenshotRevisionId,
      market.id,
      screenshotRateSetId,
      screenshotRevisionNumber,
      JSON.stringify(snapshot),
    ],
  );
}

async function removeGoldRows() {
  const connection = await connectDatabase();
  try {
    await connection.query("DELETE FROM GoldRateRevision WHERE id = ?", [
      screenshotRevisionId,
    ]);
    await connection.query("DELETE FROM GoldRateSet WHERE id = ?", [
      screenshotRateSetId,
    ]);
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
    await page.goto(`${baseUrl}/admin/gold`);
    await page.waitForURL((url) => url.pathname === "/admin/gold");
    return;
  }

  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error("Admin seed credentials are required.");
  }
  await page.goto(`${baseUrl}/login?next=/admin/gold`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/gold");
}

async function screenshot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({
    path: path.join(outputDirectory, name),
    fullPage: true,
  });
}

async function runGoldEstimate(
  page: Page,
  quantity: string,
  expectedText: string,
) {
  await page.getByLabel("Custom quantity in millions of GP").fill(quantity);
  await page.getByLabel("RuneScape name").fill("Valid Rsn");
  await page.getByRole("button", { name: "Estimate trade" }).click();
  await page.getByText(expectedText).waitFor();
  await settle(page);
}

async function capturePublicPages(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  const buy = await context.newPage();
  await buy.goto(`${baseUrl}${goldPath}`);
  await screenshot(buy, "public-gold-buy-1440.png");

  const sell = await context.newPage();
  await sell.goto(`${baseUrl}${goldPath}`);
  await sell.getByRole("tab", { name: "Sell Gold" }).click();
  await screenshot(sell, "public-gold-sell-1440.png");

  const estimate = await context.newPage();
  await estimate.goto(`${baseUrl}${goldPath}`);
  await runGoldEstimate(estimate, "50", "$12.50");
  await screenshot(estimate, "public-gold-buy-estimate-1440.png");

  const manual = await context.newPage();
  await manual.goto(`${baseUrl}${goldPath}`);
  await runGoldEstimate(manual, "150", "Manual review is required");
  await screenshot(manual, "public-gold-manual-review-1440.png");

  await setStock("20");
  const unavailable = await context.newPage();
  await unavailable.goto(`${baseUrl}${goldPath}`);
  await runGoldEstimate(
    unavailable,
    "50",
    "above current public stock availability",
  );
  await screenshot(unavailable, "public-gold-unavailable-1440.png");
  await setStock("200000000");

  await context.close();
}

async function captureMobilePage(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${goldPath}`);
  await runGoldEstimate(page, "50", "$12.50");
  await screenshot(page, "public-gold-mobile-390.png");
  await context.close();
}

async function captureAdminPages(browser: Browser, marketId: string) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signIn(page);
  await page.addStyleTag({
    content: ".screenshot-sensitive { visibility: hidden !important; }",
  });
  await screenshot(page, "admin-gold-overview-1440.png");

  await page.goto(`${baseUrl}/admin/gold/markets/${marketId}/rates`);
  await page.getByRole("heading", { name: "Draft rates" }).waitFor();
  await screenshot(page, "admin-gold-rate-editor-1440.png");

  await page.goto(`${baseUrl}/admin/gold/markets/${marketId}/inventory`);
  await page.getByRole("heading", { name: "Inventory ledger" }).waitFor();
  await screenshot(page, "admin-gold-inventory-1440.png");

  await page.goto(`${baseUrl}/admin/gold/markets/${marketId}/history`);
  await page.getByText(`#${screenshotRevisionNumber}`).waitFor();
  await screenshot(page, "admin-gold-history-1440.png");
  await context.close();
}

async function main() {
  const connection = await connectDatabase();
  let flagSnapshot: FlagSnapshot | null = null;
  let marketSnapshot: MarketSnapshot | null = null;
  let browser: Browser | null = null;
  try {
    flagSnapshot = await snapshotFlags(connection);
    marketSnapshot = await snapshotMarket(connection);
    await prepareGoldRows(connection, marketSnapshot);
    await mkdir(outputDirectory, { recursive: true });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    await captureAdminPages(browser, marketSnapshot.id);
    await capturePublicPages(browser);
    await captureMobilePage(browser);
  } finally {
    await browser?.close();
    await connection.end();
    if (marketSnapshot) await restoreMarket(marketSnapshot);
    if (flagSnapshot) await restoreFlags(flagSnapshot);
    await removeGoldRows();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

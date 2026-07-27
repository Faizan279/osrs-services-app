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
    bigIntAsNumber: true,
    allowPublicKeyRetrieval:
      process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === "true",
  });
  try {
    return (await connection.query(sql, values)) as T[];
  } finally {
    await connection.end();
  }
}

function requiredRow<T>(rows: T[]) {
  const row = rows[0];
  if (!row) throw new Error("Expected a database row for E2E setup.");
  return row;
}

async function signInToGold(page: Page) {
  await page.goto("/login?next=/admin/gold");
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/gold");
  await expect(
    page.getByRole("heading", { name: "Gold", exact: true }),
  ).toBeVisible();
}

async function goldMarket() {
  return requiredRow(
    await databaseRows<{
      id: string;
      serviceId: string;
      serviceSlug: string;
      categoryId: string;
      categorySlug: string;
    }>(
      `SELECT market.id, service.id AS serviceId, service.slug AS serviceSlug,
        service.categoryId, category.slug AS categorySlug
       FROM GoldMarket market
       INNER JOIN CatalogueService service ON service.id = market.serviceId
       INNER JOIN CatalogueCategory category ON category.id = service.categoryId
       WHERE market.stableKey = 'gold-main-market'
       LIMIT 1`,
    ),
  );
}

async function prepareGoldFixture() {
  const market = await goldMarket();
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'gold_engine_enabled'",
  );
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'global_pricing_enabled'",
  );
  await databaseRows(
    `UPDATE GoldMarket
     SET availabilityState = 'AVAILABLE', stockQuantityGp = 200000000,
       buyingCapacityGp = 200000000, secureServiceEnabled = 1,
       secureServicePricingMode = 'FIXED_MINOR_UNITS',
       secureServiceFixedMinorUnits = 199, secureServiceBps = 0,
       secureServiceCustomerBuys = 1, secureServiceCustomerSells = 1
     WHERE id = ?`,
    [market.id],
  );
  await databaseRows(
    `INSERT INTO GoldRateSet
      (id, marketId, status, version, publishedAt, internalNotes,
       needsClientReview, concurrencyVersion, createdAt, updatedAt)
     VALUES ('e2etask009rateset', ?, 'PUBLISHED', 9009, NOW(3), ?,
       0, 1, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE
       marketId = VALUES(marketId),
       status = VALUES(status),
       version = VALUES(version),
       publishedAt = NOW(3),
       updatedAt = NOW(3)`,
    [market.id, "Task 009 E2E published rates."],
  );
  for (const [id, direction, rateMinorUnitsPerMillion] of [
    ["e2etask009buyrate", "CUSTOMER_BUYS_GOLD", 25],
    ["e2etask009sellrate", "CUSTOMER_SELLS_GOLD", 18],
  ] as const) {
    await databaseRows(
      `INSERT INTO GoldRate
        (id, rateSetId, direction, rateMinorUnitsPerMillion,
         minimumQuantityGp, maximumQuantityGp, automaticReviewMaximumGp,
         effectiveStart, effectiveEnd, enabled, needsClientReview,
         concurrencyVersion, createdAt, updatedAt)
       VALUES (?, 'e2etask009rateset', ?, ?, 10000000, 500000000,
         100000000, '2026-07-24 00:00:00.000', NULL, 1, 0, 1, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         rateMinorUnitsPerMillion = VALUES(rateMinorUnitsPerMillion),
         minimumQuantityGp = VALUES(minimumQuantityGp),
         maximumQuantityGp = VALUES(maximumQuantityGp),
         automaticReviewMaximumGp = VALUES(automaticReviewMaximumGp),
         enabled = VALUES(enabled),
         updatedAt = NOW(3)`,
      [id, direction, rateMinorUnitsPerMillion],
    );
  }
  const snapshot = {
    schemaVersion: 1,
    market: {
      id: market.id,
      stableKey: "gold-main-market",
      slug: "gold-trading",
      serviceId: market.serviceId,
      serviceSlug: market.serviceSlug,
      categoryId: market.categoryId,
      categorySlug: market.categorySlug,
      publicName: "OSRS Gold Trading",
      currencyCode: "USD",
    },
    revision: {
      id: "e2etask009revision",
      revisionNumber: 9009,
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
  await databaseRows(
    `DELETE FROM GoldRateRevision
     WHERE id = 'e2etask009revision'
       OR (marketId = ? AND revisionNumber = 9009)`,
    [market.id],
  );
  await databaseRows(
    `INSERT INTO GoldRateRevision
      (id, marketId, rateSetId, revisionNumber, snapshotSchemaVersion,
       snapshot, publishedAt, createdAt)
     VALUES ('e2etask009revision', ?, 'e2etask009rateset', 9009, 1,
       ?, NOW(3), NOW(3))`,
    [market.id, JSON.stringify(snapshot)],
  );
  return market;
}

async function setGoldBalances({
  stockQuantityGp = 200_000_000,
  buyingCapacityGp = 200_000_000,
}: {
  stockQuantityGp?: number;
  buyingCapacityGp?: number;
}) {
  await databaseRows(
    `UPDATE GoldMarket
     SET stockQuantityGp = ?, buyingCapacityGp = ?
     WHERE stableKey = 'gold-main-market'`,
    [stockQuantityGp, buyingCapacityGp],
  );
}

async function runEstimate(page: Page, quantity: string, expectedText: string) {
  await page.getByLabel("Custom quantity in millions of GP").fill(quantity);
  await page.getByLabel("RuneScape name").fill("Valid Rsn");
  await page.getByRole("button", { name: "Estimate trade" }).click();
  await expect(page.getByText(expectedText).first()).toBeVisible({
    timeout: 30_000,
  });
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Task 009 E2E mutates shared deterministic gold fixture once.",
  );
  await prepareGoldFixture();
});

test("public gold page exposes a controlled review state when disabled", async ({
  page,
}) => {
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'gold_engine_enabled'",
  );
  await page.goto("/gold");
  await expect(page).toHaveURL(/\/services\/gold\/gold-trading$/);
  await expect(page.getByText("Review mode", { exact: true })).toBeVisible();
  await expect(page.getByText("Gold trading is in review mode.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Estimate trade" }),
  ).toHaveCount(0);
});

test("public buy and sell flows return server estimates without checkout", async ({
  page,
}) => {
  await page.goto("/services/gold/gold-trading");
  await expect(
    page.getByRole("heading", { name: "Gold trading" }).first(),
  ).toBeVisible();
  await runEstimate(page, "50", "$12.50");
  await expect(page.getByText("Gold sale subtotal")).toBeVisible();

  await page.getByRole("tab", { name: "Sell Gold" }).click();
  await runEstimate(page, "50", "$9.00");
  await expect(page.getByText("Gold purchase payout")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /checkout|pay|order/i }),
  ).toHaveCount(0);
});

test("presets, custom limits, manual review, unavailable states and secure service work", async ({
  page,
}) => {
  await page.goto("/services/gold/gold-trading");
  await page.getByRole("radio", { name: /50M/ }).first().check();
  await page.getByLabel("RuneScape name").fill("Valid Rsn");
  await page.getByRole("button", { name: "Estimate trade" }).click();
  await expect(page.getByText("$12.50", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/services/gold/gold-trading");
  await runEstimate(page, "1", "at least 10M GP");

  await page.goto("/services/gold/gold-trading");
  await runEstimate(page, "501", "outside the configured limit");

  await page.goto("/services/gold/gold-trading");
  await runEstimate(page, "150", "Manual review is required");

  await setGoldBalances({ stockQuantityGp: 20 });
  await page.goto("/services/gold/gold-trading");
  await runEstimate(page, "50", "above current public stock availability");

  await setGoldBalances({ buyingCapacityGp: 20 });
  await page.goto("/services/gold/gold-trading");
  await page.getByRole("tab", { name: "Sell Gold" }).click();
  await runEstimate(page, "50", "above current buying capacity");

  await setGoldBalances({});
  await page.goto("/services/gold/gold-trading");
  await page.getByLabel("Secure 100+ Combat Service").check();
  await runEstimate(page, "50", "$14.49");
});

test("gold API validates RSN without storing it in snapshots", async ({
  page,
}) => {
  const market = await goldMarket();
  const missingRsn = await page.request.post("/api/gold/estimate", {
    data: {
      serviceId: market.serviceId,
      marketId: market.id,
      direction: "CUSTOMER_BUYS_GOLD",
      quantity: "50m",
      secureServiceSelected: false,
    },
  });
  expect(missingRsn.status()).toBe(400);
  expect((await missingRsn.json()).message).toMatch(/RuneScape name/i);

  const valid = await page.request.post("/api/gold/estimate", {
    data: {
      serviceId: market.serviceId,
      marketId: market.id,
      direction: "CUSTOMER_BUYS_GOLD",
      quantity: "50m",
      secureServiceSelected: false,
      rsn: "Valid Rsn",
      rateMinorUnitsPerMillion: 1,
      estimatedTotalMinorUnits: 1,
    },
  });
  const body = await valid.json();
  expect(valid.status()).toBe(200);
  expect(body.estimate.estimatedTotalMinorUnits).toBe(1_250);
  expect(JSON.stringify(body.estimate.snapshot)).not.toMatch(/Valid Rsn|rsn/i);
});

test("admin gold overview, rate editor, inventory and history are protected", async ({
  page,
}) => {
  const market = await goldMarket();
  await page.goto("/admin/gold");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fgold/);

  await signInToGold(page);
  await expect(page.getByRole("link", { name: "Open" }).first()).toBeVisible();
  await page.goto(`/admin/gold/markets/${market.id}/rates`);
  await expect(
    page.getByRole("heading", { name: "Draft rates" }),
  ).toBeVisible();
  await expect(page.getByText("Buy Gold")).toBeVisible();
  await expect(page.getByText("Sell Gold")).toBeVisible();

  await page.goto(`/admin/gold/markets/${market.id}/inventory`);
  await expect(
    page.getByRole("heading", { name: "Inventory ledger" }),
  ).toBeVisible();
  await page.getByLabel("Quantity").fill("1m");
  await page.getByLabel("Reason").fill("E2E safe inventory adjustment");
  await page
    .getByLabel("Reference key")
    .fill(`task009-e2e-${Date.now().toString(36)}`);
  await page.getByRole("button", { name: "Record adjustment" }).click();
  await expect(page.getByText("Inventory adjustment recorded.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/gold/markets/${market.id}/history`);
  await expect(
    page.getByRole("heading", { name: "Published revisions" }),
  ).toBeVisible();
  await expect(page.getByText("#9009")).toBeVisible();
});

test("public gold engine fits required responsive widths", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto("/services/gold/gold-trading");
    await expect(page.getByRole("tab", { name: "Buy Gold" })).toBeVisible();
    await expect(
      page.getByLabel("Custom quantity in millions of GP"),
    ).toBeVisible();
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(
      sizes.clientWidth + 1,
    );
  }
});

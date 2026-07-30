import { expect, test, type Page } from "@playwright/test";
import argon2 from "argon2";
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

async function upsertProductPricingRevision() {
  const ruleSet = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM PricingRuleSet ORDER BY createdAt ASC LIMIT 1",
    ),
  );
  const snapshot = {
    schemaVersion: 1,
    ruleSetId: ruleSet.id,
    revisionId: "task012pricingrevision",
    revisionNumber: 12,
    currencyCode: "USD",
    publishedAt: "2026-07-30T15:00:00.000Z",
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
  await databaseRows(
    `INSERT INTO PricingRevision
      (id, ruleSetId, revisionNumber, snapshot, publishedAt, createdAt)
     VALUES ('task012pricingrevision', ?, 12, ?, '2026-07-30 15:00:00.000', NOW(3))
     ON DUPLICATE KEY UPDATE
       snapshot = VALUES(snapshot),
       publishedAt = VALUES(publishedAt)`,
    [ruleSet.id, JSON.stringify(snapshot)],
  );
}

async function publishManualReviewProduct() {
  const snapshot = {
    schemaVersion: 1,
    marketplace: {
      id: "productmarkettask012",
      stableKey: "product-main-marketplace",
      slug: "products",
      serviceId: "productsservicetask012",
      serviceSlug: "product-marketplace",
      categoryId: "productscategorytask012",
      categorySlug: "products",
      publicName: "OSRS Product Marketplace",
      currencyCode: "USD",
    },
    product: {
      id: "prodmanual012",
      stableKey: "product-manual-review-demo",
      slug: "manual-review-item-package",
      publicTitle: "Manual review item package",
      shortDescription:
        "Support-reviewed package that avoids misleading zero totals.",
      fullDescription:
        "This published E2E product validates the manual-review estimate state without creating a cart, order, payment or stock hold.",
      productType: "ITEM",
      currencyCode: "USD",
      publicBadgeText: "Manual review",
      isFeatured: false,
      category: {
        stableKey: "product-category-items",
        slug: "items",
        publicName: "Items",
        productType: "ITEM",
      },
    },
    revision: {
      id: "task012manualrevision",
      revisionNumber: 1,
      publishedAt: "2026-07-30T15:00:00.000Z",
    },
    variants: [
      {
        stableKey: "product-variant-manual-review",
        publicName: "Support-reviewed package",
        publicSku: "REVIEW",
        unitLabel: "package",
        priceMode: "MANUAL_REVIEW",
        baseUnitPriceCents: 0,
        minimumQuantity: "1",
        maximumQuantity: "1",
        quantityIncrement: "1",
        stockMode: "MANUAL_REVIEW",
        sortOrder: 10,
        enabled: true,
        priceTiers: [],
      },
    ],
    tags: [
      {
        stableKey: "product-tag-review",
        slug: "review",
        publicLabel: "Needs review",
      },
    ],
    images: [
      {
        stableKey: "product-manual-review-demo:cover",
        imageType: "COVER",
        assetPath: "/artwork/portal-hero-desktop.webp",
        altText: "Manual review item package safe product cover",
        caption: "Safe demo artwork, not game artwork or customer data.",
        sortOrder: 10,
      },
    ],
  };
  await databaseRows(
    `UPDATE Product
     SET publicationStatus = 'PUBLISHED',
       availabilityState = 'MANUAL_REVIEW_REQUIRED',
       publishedAt = '2026-07-30 15:00:00.000'
     WHERE stableKey = 'product-manual-review-demo'`,
  );
  await databaseRows(
    `UPDATE ProductVariant
     SET stockMode = 'MANUAL_REVIEW',
       availabilityState = 'MANUAL_REVIEW_REQUIRED',
       status = 'AVAILABLE',
       enabled = 1
     WHERE stableKey = 'product-variant-manual-review'`,
  );
  await databaseRows(
    `INSERT INTO ProductRevision
      (id, productId, revisionNumber, snapshotSchemaVersion, snapshot,
       publishedAt, createdAt)
     VALUES ('task012manualrevision', 'prodmanual012', 1, 1, ?,
       '2026-07-30 15:00:00.000', NOW(3))
     ON DUPLICATE KEY UPDATE
       snapshot = VALUES(snapshot),
       publishedAt = VALUES(publishedAt)`,
    [JSON.stringify(snapshot)],
  );
}

async function setBondStock(quantity: number) {
  await databaseRows(
    `UPDATE ProductVariant
     SET onHandQuantity = ?, availabilityState = 'AVAILABLE',
       status = 'AVAILABLE', enabled = 1, lowStockThreshold = 3,
       concurrencyVersion = concurrencyVersion + 1
     WHERE stableKey = 'product-variant-bond-unit'`,
    [quantity],
  );
}

async function prepareProductFixture() {
  const admin = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM User WHERE email = ? LIMIT 1",
      [process.env.ADMIN_SEED_EMAIL!.toLowerCase()],
    ),
  );
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'product_marketplace_enabled'",
  );
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'global_pricing_enabled'",
  );
  await databaseRows(
    `UPDATE CatalogueService
     SET availabilityState = 'AVAILABLE', publicationStatus = 'PUBLISHED'
     WHERE seededKey = 'product-marketplace'`,
  );
  await databaseRows(
    "UPDATE ProductMarketplace SET availabilityState = 'AVAILABLE' WHERE stableKey = 'product-main-marketplace'",
  );
  await databaseRows(
    "UPDATE ProductCategory SET enabled = 1 WHERE stableKey IN ('product-category-items', 'product-category-bonds', 'product-category-outfits')",
  );
  await databaseRows(
    `UPDATE Product
     SET publicationStatus = 'PUBLISHED', availabilityState = 'AVAILABLE',
       publishedAt = COALESCE(publishedAt, '2026-07-30 15:00:00.000')
     WHERE stableKey = 'product-osrs-bond-demo'`,
  );
  await setBondStock(20);
  await upsertProductPricingRevision();
  await publishManualReviewProduct();

  await databaseRows(
    "DELETE FROM ProductReservationEvent WHERE reservationId = 'task012e2ereservation'",
  );
  await databaseRows(
    "DELETE FROM ProductInventoryReservation WHERE id = 'task012e2ereservation'",
  );
  await databaseRows(
    "DELETE FROM ProductInventoryLedgerEntry WHERE id = 'task012e2eledger'",
  );
  await databaseRows(
    `INSERT INTO ProductInventoryLedgerEntry
      (id, variantId, entryType, quantity, resultingOnHandQuantity,
       reason, internalNote, actorId, referenceKey, createdAt)
     VALUES ('task012e2eledger', 'prodvarbondunit012', 'STOCK_IN',
       20, 20, 'E2E stock fixture', NULL, ?,
       'task012-e2e-ledger', NOW(3))`,
    [admin.id],
  );
  await databaseRows(
    `INSERT INTO ProductInventoryReservation
      (id, stableKey, variantId, quantity, status, expiresAt, releasedAt,
       safeInternalPurpose, actorId, idempotencyKey, futureExternalRef,
       concurrencyVersion, createdAt, updatedAt)
     VALUES ('task012e2ereservation', 'task012-e2e-reservation',
       'prodvarbondunit012', 2, 'ACTIVE',
       '2030-01-01 00:00:00.000', NULL,
       'E2E internal reservation fixture', ?,
       'task012-e2e-reservation-key', NULL, 1, NOW(3), NOW(3))`,
    [admin.id],
  );
  await databaseRows(
    `INSERT INTO ProductReservationEvent
      (id, reservationId, eventType, safeMetadata, actorId, createdAt)
     VALUES ('task012e2eevent', 'task012e2ereservation',
       'ACTIVE', ?, ?, NOW(3))`,
    [JSON.stringify({ e2e: true }), admin.id],
  );
}

async function ensureSupportAgent() {
  const password = "Task012-Support-Password-Only";
  const email = "task012-support@example.test";
  const passwordHash = await argon2.hash(password);
  const role = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM Role WHERE `key` = 'SUPPORT_AGENT' LIMIT 1",
    ),
  );
  await databaseRows(
    `INSERT INTO User
      (id, email, emailVerified, name, passwordHash, status, createdAt, updatedAt)
     VALUES ('task012supportuser', ?, NOW(3), 'Task 012 Support', ?, 'ACTIVE', NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE passwordHash = VALUES(passwordHash), status = 'ACTIVE'`,
    [email, passwordHash],
  );
  await databaseRows(
    `INSERT IGNORE INTO UserRole (userId, roleId, assignedAt)
     VALUES ('task012supportuser', ?, NOW(3))`,
    [role.id],
  );
  return { email, password };
}

async function signIn(page: Page, next = "/admin/products") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === next);
}

async function signInSupport(page: Page, next: string) {
  const support = await ensureSupportAgent();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill(support.email);
  await page.getByLabel("Password").fill(support.password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === next);
}

async function acceptNextDialog(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
}

async function expectNoCartOrderPaymentTables() {
  const rows = await databaseRows<{ value: number }>(
    `SELECT COUNT(*) AS value
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('Cart', 'CartItem', 'CheckoutSession', 'Order', 'OrderItem', 'Payment')`,
  );
  expect(rows[0]?.value ?? 0).toBe(0);
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Task 012 E2E mutates deterministic product marketplace fixtures once.",
  );
  await prepareProductFixture();
});

test("public marketplace exposes disabled state and rejects estimates safely", async ({
  page,
}) => {
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'product_marketplace_enabled'",
  );
  await page.goto("/products");
  await expect(page.getByText("Product review mode")).toBeVisible();
  await expect(page.getByText("Bond marketplace demo")).toHaveCount(0);

  const response = await page.request.post("/api/products/estimate", {
    data: {
      productSlug: "bond-marketplace-demo",
      variantStableKey: "product-variant-bond-unit",
      quantity: "1",
      estimatedTotalCents: 1,
    },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toMatch(/unavailable/i);
  await expectNoCartOrderPaymentTables();
});

test("search, filters, sorting, detail and estimates stay server-authoritative", async ({
  page,
}) => {
  await page.goto(
    "/products?type=BOND&category=bonds&q=bond&inStock=1&sort=price_asc",
  );
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(page.getByText("Bond marketplace demo").first()).toBeVisible();
  await expect(page.getByText("Rune essence stack demo")).toHaveCount(0);

  const listing = await page.request.get(
    "/api/products?type=BOND&category=bonds&q=bond&minPrice=800&maxPrice=900&inStock=1&featured=1&pageSize=2&sort=price_asc",
  );
  expect(listing.status()).toBe(200);
  const listingBody = await listing.json();
  expect(listingBody.data.total).toBeGreaterThan(0);
  expect(listingBody.data.products[0].slug).toBe("bond-marketplace-demo");
  expect(JSON.stringify(listingBody)).not.toMatch(
    /internalSku|internalReference|ledger|reservation|actor|reason/i,
  );

  const invalid = await page.request.get("/api/products?type=INVALID");
  expect((await invalid.json()).data.total).toBe(0);

  await page.goto("/products/bond-marketplace-demo");
  await expect(
    page.getByRole("heading", { name: "Bond marketplace demo" }),
  ).toBeVisible();
  await page.getByLabel("Quantity").fill("5");
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(page.getByText("Product handling")).toBeVisible();
  await expect(page.getByText("$42.95")).toBeVisible();

  const estimate = await page.request.post("/api/products/estimate", {
    data: {
      productSlug: "bond-marketplace-demo",
      variantStableKey: "product-variant-bond-unit",
      quantity: "5",
      unitPriceCents: 1,
      productSubtotalCents: 1,
      estimatedTotalCents: 1,
    },
  });
  const estimateBody = await estimate.json();
  expect(estimate.status()).toBe(200);
  expect(estimateBody.estimate.productSubtotalCents).toBe(4245);
  expect(estimateBody.estimate.estimatedTotalCents).toBe(4295);
  expect(estimateBody.estimate.estimateCreatesReservation).toBe(false);

  await setBondStock(3);
  const lowStock = await page.request.post("/api/products/estimate", {
    data: {
      productSlug: "bond-marketplace-demo",
      variantStableKey: "product-variant-bond-unit",
      quantity: "1",
    },
  });
  expect((await lowStock.json()).estimate.state).toBe("LOW_STOCK");

  await setBondStock(0);
  const outOfStock = await page.request.post("/api/products/estimate", {
    data: {
      productSlug: "bond-marketplace-demo",
      variantStableKey: "product-variant-bond-unit",
      quantity: "1",
    },
  });
  expect(outOfStock.status()).toBe(400);
  expect((await outOfStock.json()).message).toMatch(/out of stock/i);

  const beforeReservations = requiredRow(
    await databaseRows<{ value: number }>(
      "SELECT COUNT(*) AS value FROM ProductInventoryReservation",
    ),
  ).value;
  await page.request.post("/api/products/estimate", {
    data: {
      productSlug: "manual-review-item-package",
      variantStableKey: "product-variant-manual-review",
      quantity: "1",
    },
  });
  const afterReservations = requiredRow(
    await databaseRows<{ value: number }>(
      "SELECT COUNT(*) AS value FROM ProductInventoryReservation",
    ),
  ).value;
  expect(afterReservations).toBe(beforeReservations);
  await expectNoCartOrderPaymentTables();
});

test("manual-review product does not display a zero final total", async ({
  page,
}) => {
  const response = await page.request.post("/api/products/estimate", {
    data: {
      productSlug: "manual-review-item-package",
      variantStableKey: "product-variant-manual-review",
      quantity: "1",
    },
  });
  const body = await response.json();
  expect(response.status()).toBe(200);
  expect(body.estimate.state).toBe("MANUAL_REVIEW_REQUIRED");
  expect(body.estimate.estimatedTotalCents).toBeNull();
  expect(body.estimate.estimatedTotal).toBeNull();

  await page.goto("/products/manual-review-item-package");
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(page.getByText("Manual review required").last()).toBeVisible();
  await expect(page.getByText("$0.00")).toHaveCount(0);
});

test("mobile filter experience fits required responsive widths", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto("/products");
    await expect(
      page.getByRole("heading", { name: "OSRS Product Marketplace" }),
    ).toBeVisible();
    if (width < 1024) {
      await expect(page.getByText("Product filters")).toBeVisible();
    }
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(
      sizes.clientWidth + 1,
    );
  }
});

test("admin marketplace, editors, inventory and reservations work with permissions", async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Products Centre" }),
  ).toBeVisible();
  await page.goto("/admin/products/prodsourcebond012");
  await expect(
    page.getByRole("heading", { name: "Bond marketplace demo" }),
  ).toBeVisible();
  await page.goto("/admin/products/prodsourcebond012/variants");
  await expect(page.getByText("Bond quantity")).toBeVisible();
  await page.goto("/admin/products/prodsourcebond012/pricing");
  await expect(page.getByText("1 to 4")).toBeVisible();
  await page.goto("/admin/products/prodsourcebond012/media");
  await expect(page.getByText("safe product cover")).toBeVisible();

  await page.goto("/admin/products/prodsourcebond012/inventory");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Safe reason").fill("E2E stock adjustment");
  await page
    .getByLabel("Idempotency reference")
    .fill(`task012-e2e-adjust-${Date.now()}`);
  await acceptNextDialog(page);
  await page.getByRole("button", { name: "Adjust stock" }).click();
  await expect(page.getByText("Inventory adjustment appended.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/admin/products/prodsourcebond012/reservations");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Safe purpose").fill("E2E reservation");
  await page
    .getByLabel("Idempotency key")
    .fill(`task012-e2e-reserve-${Date.now()}`);
  await acceptNextDialog(page);
  await page.getByRole("button", { name: "Create reservation" }).click();
  await expect(page.getByText("Internal reservation created.")).toBeVisible({
    timeout: 30_000,
  });
  await acceptNextDialog(page);
  await page.getByRole("button", { name: "Release" }).first().click();
  await expect(page.getByText("Reservation released.")).toBeVisible({
    timeout: 30_000,
  });

  await databaseRows(
    `INSERT INTO ProductInventoryReservation
      (id, stableKey, variantId, quantity, status, expiresAt, releasedAt,
       safeInternalPurpose, actorId, idempotencyKey, futureExternalRef,
       concurrencyVersion, createdAt, updatedAt)
     VALUES ('task012e2eexpired', 'task012-e2e-expired',
       'prodvarbondunit012', 1, 'ACTIVE', '2026-01-01 00:00:00.000',
       NULL, 'E2E expired reservation', NULL,
       'task012-e2e-expired-key', NULL, 1, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE status = 'ACTIVE',
       expiresAt = VALUES(expiresAt),
       concurrencyVersion = 1`,
  );
  await page.goto("/admin/products/prodsourcebond012/reservations");
  await page.getByRole("button", { name: "Expire stale reservations" }).click();
  await expect(page.getByText("Expired reservations resolved.")).toBeVisible({
    timeout: 30_000,
  });

  await page.context().clearCookies();
  await signInSupport(page, "/admin/products/prodsourcebond012/inventory");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Safe reason").fill("Support should be denied");
  await acceptNextDialog(page);
  await page.getByRole("button", { name: "Adjust stock" }).click();
  await expect(page.getByText("Capability required.")).toBeVisible({
    timeout: 30_000,
  });
});

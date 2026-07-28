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

async function accountListing() {
  return requiredRow(
    await databaseRows<{
      id: string;
      marketplaceId: string;
      slug: string;
      concurrencyVersion: number;
    }>(
      `SELECT id, marketplaceId, slug, concurrencyVersion
       FROM AccountListing
       WHERE stableKey = 'account-main-pvm-ready'
       LIMIT 1`,
    ),
  );
}

async function prepareAccountFixture() {
  const listing = await accountListing();
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'account_marketplace_enabled'",
  );
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'global_pricing_enabled'",
  );
  await databaseRows(
    `UPDATE AccountMarketplace
     SET availabilityState = 'AVAILABLE'
     WHERE stableKey = 'account-main-marketplace'`,
  );
  await databaseRows(
    `DELETE FROM AccountListingHold
     WHERE listingId = ? AND reason LIKE 'E2E%'`,
    [listing.id],
  );
  await databaseRows(
    `UPDATE AccountListing
     SET availability = 'AVAILABLE',
       approvalStatus = 'APPROVED',
       publicationStatus = 'PUBLISHED',
       basePriceCents = 24999,
       needsClientReview = 0
     WHERE id = ?`,
    [listing.id],
  );
  return listing;
}

async function ensureSupportAgent() {
  const password = "Task010-Support-Password-Only";
  const email = "task010-support@example.test";
  const passwordHash = await argon2.hash(password);
  const role = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM Role WHERE `key` = 'SUPPORT_AGENT' LIMIT 1",
    ),
  );
  await databaseRows(
    `INSERT INTO User
      (id, email, emailVerified, name, passwordHash, status, createdAt, updatedAt)
     VALUES ('task010supportuser', ?, NOW(3), 'Task 010 Support', ?, 'ACTIVE', NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE passwordHash = VALUES(passwordHash), status = 'ACTIVE'`,
    [email, passwordHash],
  );
  await databaseRows(
    `INSERT IGNORE INTO UserRole (userId, roleId, assignedAt)
     VALUES ('task010supportuser', ?, NOW(3))`,
    [role.id],
  );
  return { email, password };
}

async function signIn(page: Page, next = "/admin/accounts") {
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

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Task 010 E2E mutates shared deterministic account fixture once.",
  );
  await prepareAccountFixture();
});

test("public account marketplace exposes a controlled state when disabled", async ({
  page,
}) => {
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'account_marketplace_enabled'",
  );
  await page.goto("/accounts");
  await expect(page.getByText("Marketplace review mode")).toBeVisible();
  await expect(page.getByRole("link", { name: /View details/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /checkout|pay|order|add to cart/i }),
  ).toHaveCount(0);
});

test("public browsing, filters, detail, gallery, stats, unlocks and estimate are customer-safe", async ({
  page,
}) => {
  await page.goto("/accounts");
  await expect(
    page.getByRole("heading", { name: "Account listings" }),
  ).toBeVisible();
  await expect(page.getByText("PvM ready main account").first()).toBeVisible();

  await page.getByLabel("Search").fill("PvM");
  await page.getByLabel("Game mode").selectOption("NORMAL");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/q=PvM/);
  await expect(page.getByText("PvM ready main account").first()).toBeVisible();

  await page.goto("/accounts?feature=pvm-ready&minPrice=10000&maxPrice=30000");
  await expect(page.getByText("PvM ready main account").first()).toBeVisible();

  await page.goto("/accounts/pvm-ready-main-account");
  await expect(
    page.getByRole("heading", { name: "PvM ready main account" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gallery" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stats" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unlocks" })).toBeVisible();
  await expect(page.getByText("Secure handover process")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /checkout|pay|order|add to cart/i }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/password|bank pin|recovery answer/i),
  ).toHaveCount(0);

  const estimate = await page.request.post("/api/accounts/estimate", {
    data: {
      listingSlug: "pvm-ready-main-account",
      basePriceCents: 1,
      estimatedTotalCents: 1,
    },
  });
  const body = await estimate.json();
  expect(estimate.status()).toBe(200);
  expect(body.estimate.basePriceCents).toBe(24_999);
  expect(JSON.stringify(body)).not.toMatch(/password|bankPin|recovery|login/i);
});

test("held and sold states are explicit and do not create orders", async ({
  page,
}) => {
  const listing = await accountListing();
  await databaseRows(
    "UPDATE AccountListing SET availability = 'HELD' WHERE id = ?",
    [listing.id],
  );
  await page.goto("/accounts/pvm-ready-main-account");
  await expect(page.getByText("Temporarily held").first()).toBeVisible();
  const heldEstimate = await page.request.post("/api/accounts/estimate", {
    data: { listingSlug: "pvm-ready-main-account" },
  });
  expect(heldEstimate.status()).toBe(400);
  const orderTables = await databaseRows<{ value: number }>(
    `SELECT COUNT(*) AS value
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('Order', 'OrderItem')`,
  );
  expect(orderTables[0]?.value ?? 0).toBe(0);

  await databaseRows(
    "UPDATE AccountListing SET availability = 'SOLD' WHERE id = ?",
    [listing.id],
  );
  await page.goto("/accounts?availability=SOLD");
  const soldCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "PvM ready main account" }),
  });
  await expect(soldCard.getByText("Sold", { exact: true })).toBeVisible();
  const soldEstimate = await page.request.post("/api/accounts/estimate", {
    data: { listingSlug: "pvm-ready-main-account" },
  });
  expect(soldEstimate.status()).toBe(400);
});

test("admin account centre supports editing, publication, holds, handover and history", async ({
  page,
}) => {
  const listing = await accountListing();
  await page.goto("/admin/accounts");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Faccounts/);
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Accounts Centre" }),
  ).toBeVisible();

  await page.goto(`/admin/accounts/listings/${listing.id}`);
  await expect(
    page.getByRole("heading", { name: "Listing editor" }),
  ).toBeVisible();
  await page.getByLabel("Sort order").fill("11");
  await page.getByRole("button", { name: "Save listing" }).click();
  await expect(page.getByText("Account listing saved.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/accounts/listings/${listing.id}/stats`);
  await page.getByLabel("Stat key").last().fill(`e2e-stat-${Date.now()}`);
  await page.getByLabel("Public label").last().fill("E2E stat");
  await page.getByLabel("Value").last().fill("1");
  await page.getByRole("button", { name: "Save stat" }).last().click();
  await expect(page.getByText("Account stat saved.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/accounts/listings/${listing.id}/unlocks`);
  await page.getByLabel("Unlock key").last().fill(`e2e-unlock-${Date.now()}`);
  await page.getByLabel("Public label").last().fill("E2E unlock");
  await page.getByRole("button", { name: "Save unlock" }).last().click();
  await expect(page.getByText("Account unlock saved.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/accounts/listings/${listing.id}/features`);
  await page.getByLabel("Feature key").last().fill(`e2e-feature-${Date.now()}`);
  await page.getByLabel("Public label").last().fill("E2E feature");
  await page.getByRole("button", { name: "Save feature" }).last().click();
  await expect(page.getByText("Account feature saved.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/accounts/listings/${listing.id}/media`);
  await page.getByLabel("Alt text").last().fill("E2E safe account image");
  await page.getByRole("button", { name: "Save image" }).last().click();
  await expect(page.getByText("Account image saved.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/accounts/listings/${listing.id}`);
  await acceptNextDialog(page);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Account listing approved.")).toBeVisible({
    timeout: 30_000,
  });
  await acceptNextDialog(page);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Account listing published.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/accounts/listings/${listing.id}/availability`);
  await page.getByLabel("Audit reason").fill("E2E availability update");
  await page.getByLabel("State").selectOption("AVAILABLE");
  await page.getByRole("button", { name: "Save availability" }).click();
  await expect(page.getByText("Availability updated.")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Safe internal reason").fill("E2E temporary hold");
  await page.getByRole("button", { name: "Create hold" }).click();
  await expect(page.getByText("Admin hold created.")).toBeVisible({
    timeout: 30_000,
  });
  await acceptNextDialog(page);
  await page.getByRole("button", { name: "Release hold" }).first().click();
  await expect(page.getByText("Admin hold released.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/accounts/listings/${listing.id}/handover`);
  await page.getByLabel("Ready for future handover").check();
  await page.getByLabel("Readiness").selectOption("READY_FOR_FUTURE_HANDOVER");
  await page.getByRole("button", { name: "Save handover readiness" }).click();
  await expect(page.getByText("Handover readiness saved.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/accounts/listings/${listing.id}/history`);
  await expect(
    page.getByRole("heading", { name: "Draft controls" }),
  ).toBeVisible();
  await expect(page.getByText("#").first()).toBeVisible();
});

test("admin create listing and permission denial paths are enforced", async ({
  page,
}) => {
  const slug = `e2e-account-${Date.now()}`;
  await signIn(page, "/admin/accounts/listings/new");
  await page.getByLabel("Public title").fill("E2E account listing");
  await page.getByLabel("Public slug").fill(slug);
  await page
    .getByLabel("Short description")
    .fill("E2E public-safe account listing draft.");
  await page
    .getByLabel("Full public description")
    .fill("E2E account listing without credentials or customer data.");
  await page.getByLabel("Base price in cents").fill("10000");
  await page.getByLabel("Internal reference code").fill("E2E-SAFE-REF");
  await page.getByRole("button", { name: "Create listing" }).click();
  await expect(page.getByText("Account listing created.")).toBeVisible({
    timeout: 30_000,
  });

  const listing = await accountListing();
  await page.context().clearCookies();
  await signInSupport(page, `/admin/accounts/listings/${listing.id}/handover`);
  await expect(
    page.getByRole("heading", { name: "PvM ready main account" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save handover readiness" }).click();
  await expect(page.getByText(/forbidden|403/i)).toBeVisible({
    timeout: 30_000,
  });
});

test("public account marketplace fits required responsive widths", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto("/accounts");
    await expect(
      page.getByRole("heading", { name: "Account listings" }),
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

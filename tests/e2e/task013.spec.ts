import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";
import mariadb from "mariadb";

const cartToken = "task013E2eCartToken123456789012345678901234";

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

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

function requiredRow<T>(rows: T[]) {
  const row = rows[0];
  if (!row) throw new Error("Expected a database row for Task 013 E2E setup.");
  return row;
}

function snapshot() {
  return JSON.stringify({
    schemaVersion: 1,
    itemKind: "PRODUCT_ESTIMATE",
    compatibilityGroup: "STANDARD_SERVICE",
    publicTitle: "Bond marketplace demo",
    publicDescription: "E2E checkout item",
    publicConfigurationSummary: "Bond marketplace demo x 1 bond",
    quantity: "1",
    currency: "USD",
    authoritativeLineItems: [
      { label: "Bond marketplace demo", amountCents: 999 },
    ],
    subtotalCents: 999,
    customerSafeGlobalPricingLines: [],
    finalEstimatedTotalCents: 999,
    sourceRevision: { id: null, revisionNumber: null },
    generatedAt: "2026-07-31T15:00:00.000Z",
    repricingRequired: false,
    reservationRequired: true,
  });
}

async function disableCheckout() {
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` IN ('cart_enabled', 'guest_checkout_enabled')",
  );
  await databaseRows(
    "UPDATE CheckoutSettings SET guestCheckoutEnabled = 0 WHERE stableKey = 'checkout-default-settings'",
  );
}

async function prepareCart() {
  const product = requiredRow(
    await databaseRows<{
      productStableKey: string;
      variantStableKey: string;
    }>(
      `SELECT product.stableKey AS productStableKey,
         variant.stableKey AS variantStableKey
       FROM ProductVariant variant
       INNER JOIN Product product ON product.id = variant.productId
       WHERE variant.stableKey = 'product-variant-bond-unit'
       LIMIT 1`,
    ),
  );
  await databaseRows("DELETE FROM CartItem WHERE id = 'task013e2ecartitem'");
  await databaseRows("DELETE FROM Cart WHERE id = 'task013e2ecart'");
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` IN ('cart_enabled', 'guest_checkout_enabled')",
  );
  await databaseRows(
    "UPDATE CheckoutSettings SET guestCheckoutEnabled = 1 WHERE stableKey = 'checkout-default-settings'",
  );
  await databaseRows(
    `INSERT INTO Cart
      (id, tokenHash, status, compatibilityGroup, currencyCode,
       subtotalCents, adjustmentTotalCents, finalTotalCents, itemCount,
       expiresAt, createdAt, updatedAt)
     VALUES ('task013e2ecart', ?, 'ACTIVE', 'STANDARD_SERVICE', 'USD',
       999, 0, 999, 1, DATE_ADD(NOW(3), INTERVAL 2 HOUR), NOW(3), NOW(3))`,
    [hash(cartToken)],
  );
  await databaseRows(
    `INSERT INTO CartItem
      (id, cartId, kind, compatibilityGroup, sourceReference, publicSourceSlug,
       quantity, currencyCode, customerSelections, customerSafeSnapshot,
       subtotalCents, adjustmentTotalCents, finalTotalCents, validationState,
       stockRecheckRequired, availabilityRecheckRequired, createdAt, updatedAt)
     VALUES ('task013e2ecartitem', 'task013e2ecart', 'PRODUCT_ESTIMATE',
       'STANDARD_SERVICE', ?, 'bond-marketplace-demo', 1, 'USD',
       JSON_OBJECT('e2e', true), ?, 999, 0, 999, 'RESERVATION_REQUIRED',
       1, 1, NOW(3), NOW(3))`,
    [`${product.productStableKey}:${product.variantStableKey}`, snapshot()],
  );
}

test.describe("Task 013 cart and guest checkout", () => {
  test("cart and checkout render the default disabled state", async ({
    page,
  }) => {
    await disableCheckout();

    await page.goto("/cart");
    await expect(page.getByText("Cart disabled")).toBeVisible();

    await page.goto("/checkout");
    await expect(page.getByText("Checkout review")).toBeVisible();
  });

  test("secure-cookie cart reaches guest checkout", async ({
    context,
    page,
  }) => {
    await prepareCart();
    await context.addCookies([
      {
        name: "osrs_guest_cart",
        value: cartToken,
        url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Cart" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bond marketplace demo" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Checkout" })).toBeVisible();

    await page.goto("/checkout");
    await expect(
      page.getByRole("heading", { name: "Guest checkout" }),
    ).toBeVisible();
    await expect(page.getByLabel("Display name")).toBeEnabled();
  });
});

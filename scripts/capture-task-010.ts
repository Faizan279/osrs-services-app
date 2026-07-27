import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";
import mariadb, { type Connection } from "mariadb";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-010");
const listingSlug = "pvm-ready-main-account";
const flagKeys = [
  "account_marketplace_enabled",
  "global_pricing_enabled",
] as const;

type FlagSnapshot = Map<string, boolean>;
type MarketplaceSnapshot = {
  id: string;
  availabilityState: string;
};
type ListingSnapshot = {
  id: string;
  availability: string;
  basePriceCents: number;
  needsClientReview: boolean;
};

async function connectDatabase() {
  if (
    !process.env.DATABASE_USER ||
    !process.env.DATABASE_NAME ||
    !process.env.DATABASE_HOST
  ) {
    throw new Error(
      "Database environment is required to enable Task 010 screenshots.",
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

async function snapshotMarketplace(connection: Connection) {
  const marketplace = (
    await queryRows<MarketplaceSnapshot>(
      connection,
      `SELECT id, availabilityState
       FROM AccountMarketplace
       WHERE stableKey = 'account-main-marketplace'
       LIMIT 1`,
    )
  )[0];
  if (!marketplace) throw new Error("Account marketplace is missing.");
  return marketplace;
}

async function snapshotListing(connection: Connection) {
  const listing = (
    await queryRows<ListingSnapshot>(
      connection,
      `SELECT id, availability, basePriceCents, needsClientReview
       FROM AccountListing
       WHERE stableKey = 'account-main-pvm-ready'
       LIMIT 1`,
    )
  )[0];
  if (!listing) throw new Error("Task 010 published account listing missing.");
  return {
    ...listing,
    needsClientReview: Boolean(listing.needsClientReview),
  };
}

async function restoreMarketplace(snapshot: MarketplaceSnapshot) {
  const connection = await connectDatabase();
  try {
    await connection.query(
      "UPDATE AccountMarketplace SET availabilityState = ? WHERE id = ?",
      [snapshot.availabilityState, snapshot.id],
    );
  } finally {
    await connection.end();
  }
}

async function restoreListing(snapshot: ListingSnapshot) {
  const connection = await connectDatabase();
  try {
    await connection.query(
      `UPDATE AccountListing
       SET availability = ?, basePriceCents = ?, needsClientReview = ?
       WHERE id = ?`,
      [
        snapshot.availability,
        snapshot.basePriceCents,
        snapshot.needsClientReview ? 1 : 0,
        snapshot.id,
      ],
    );
  } finally {
    await connection.end();
  }
}

async function prepareAccountRows(
  connection: Connection,
  marketplace: MarketplaceSnapshot,
  listing: ListingSnapshot,
) {
  await connection.query(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'account_marketplace_enabled'",
  );
  await connection.query(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'global_pricing_enabled'",
  );
  await connection.query(
    "UPDATE AccountMarketplace SET availabilityState = 'AVAILABLE' WHERE id = ?",
    [marketplace.id],
  );
  await connection.query(
    `UPDATE AccountListing
     SET availability = 'AVAILABLE', basePriceCents = 24999,
       approvalStatus = 'APPROVED', publicationStatus = 'PUBLISHED',
       needsClientReview = 0
     WHERE id = ?`,
    [listing.id],
  );
}

async function setListingAvailability(availability: string) {
  const connection = await connectDatabase();
  try {
    await connection.query(
      "UPDATE AccountListing SET availability = ? WHERE stableKey = 'account-main-pvm-ready'",
      [availability],
    );
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
    await page.goto(`${baseUrl}/admin/accounts`);
    await page.waitForURL((url) => url.pathname === "/admin/accounts");
    return;
  }

  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error("Admin seed credentials are required.");
  }
  await page.goto(`${baseUrl}/login?next=/admin/accounts`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/accounts");
}

async function screenshot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({
    path: path.join(outputDirectory, name),
    fullPage: true,
  });
}

async function capturePublicPages(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  const marketplace = await context.newPage();
  await setListingAvailability("AVAILABLE");
  await marketplace.goto(`${baseUrl}/accounts`);
  await marketplace
    .getByRole("heading", { name: "Account listings" })
    .waitFor();
  await screenshot(marketplace, "public-accounts-marketplace-1440.png");

  const filtered = await context.newPage();
  await filtered.goto(`${baseUrl}/accounts?mode=NORMAL&feature=pvm-ready`);
  await filtered.getByText("PvM ready main account").first().waitFor();
  await screenshot(filtered, "public-accounts-filtered-1440.png");

  const detail = await context.newPage();
  await detail.goto(`${baseUrl}/accounts/${listingSlug}`);
  await detail
    .getByRole("heading", { name: "PvM ready main account" })
    .waitFor();
  await screenshot(detail, "public-account-detail-1440.png");

  const gallery = await context.newPage();
  await gallery.goto(`${baseUrl}/accounts/${listingSlug}`);
  await gallery
    .getByRole("heading", { name: "Gallery" })
    .scrollIntoViewIfNeeded();
  await screenshot(gallery, "public-account-gallery-1440.png");

  await setListingAvailability("HELD");
  const held = await context.newPage();
  await held.goto(`${baseUrl}/accounts/${listingSlug}`);
  await held.getByText("Temporarily held").first().waitFor();
  await screenshot(held, "public-account-held-1440.png");
  await setListingAvailability("AVAILABLE");

  await context.close();
}

async function captureMobilePage(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/accounts`);
  await page.getByRole("heading", { name: "Account listings" }).waitFor();
  await screenshot(page, "public-accounts-mobile-390.png");
  await context.close();
}

async function captureAdminPages(browser: Browser, listingId: string) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signIn(page);
  await page.addStyleTag({
    content: ".screenshot-sensitive { visibility: hidden !important; }",
  });
  await screenshot(page, "admin-accounts-overview-1440.png");

  await page.goto(`${baseUrl}/admin/accounts/listings/${listingId}`);
  await page.getByRole("heading", { name: "Listing editor" }).waitFor();
  await screenshot(page, "admin-account-editor-1440.png");

  await page.goto(
    `${baseUrl}/admin/accounts/listings/${listingId}/availability`,
  );
  await page.getByRole("heading", { name: "Availability" }).waitFor();
  await screenshot(page, "admin-account-availability-1440.png");

  await page.goto(`${baseUrl}/admin/accounts/listings/${listingId}/handover`);
  await page
    .getByRole("heading", { name: "Secure-handover readiness" })
    .waitFor();
  await screenshot(page, "admin-account-handover-1440.png");
  await context.close();
}

async function main() {
  const connection = await connectDatabase();
  let flagSnapshot: FlagSnapshot | null = null;
  let marketplaceSnapshot: MarketplaceSnapshot | null = null;
  let listingSnapshot: ListingSnapshot | null = null;
  let browser: Browser | null = null;
  try {
    flagSnapshot = await snapshotFlags(connection);
    marketplaceSnapshot = await snapshotMarketplace(connection);
    listingSnapshot = await snapshotListing(connection);
    await prepareAccountRows(connection, marketplaceSnapshot, listingSnapshot);
    await mkdir(outputDirectory, { recursive: true });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    await captureAdminPages(browser, listingSnapshot.id);
    await capturePublicPages(browser);
    await captureMobilePage(browser);
  } finally {
    await browser?.close();
    await connection.end();
    if (listingSnapshot) await restoreListing(listingSnapshot);
    if (marketplaceSnapshot) await restoreMarketplace(marketplaceSnapshot);
    if (flagSnapshot) await restoreFlags(flagSnapshot);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

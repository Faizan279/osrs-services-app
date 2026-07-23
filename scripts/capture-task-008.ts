import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";
import mariadb, { type Connection } from "mariadb";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-008");
const skillingPath = "/services/power-levelling/skill-training-request";
const bossingPath = "/services/bossing-pvm/pvm-support";
const premiumPath = "/services/premium-services/fire-cape-premium-service";
const flagKeys = [
  "skilling_calculator_enabled",
  "bossing_calculator_enabled",
  "premium_configurator_enabled",
  "global_pricing_enabled",
] as const;

const screenshotRuleId = "task008draftrule";
const screenshotScopeId = "task008draftscope";
const screenshotRevisionId = "task008screenshotrev";
const screenshotRevisionNumber = 9008;
const screenshotLabel = "Screenshot global adjustment";

type FlagSnapshot = Map<string, boolean>;

async function connectDatabase() {
  if (
    !process.env.DATABASE_USER ||
    !process.env.DATABASE_NAME ||
    !process.env.DATABASE_HOST
  ) {
    throw new Error(
      "Database environment is required to enable Task 008 screenshots.",
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

async function enableFlagsForScreenshots(connection: Connection) {
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
  await connection.query(
    `UPDATE FeatureFlag SET enabled = 1 WHERE \`key\` IN (${placeholders})`,
    [...flagKeys],
  );
  return snapshot;
}

async function setGlobalPricingFlag(enabled: boolean) {
  const connection = await connectDatabase();
  try {
    await connection.query(
      "UPDATE FeatureFlag SET enabled = ? WHERE `key` = 'global_pricing_enabled'",
      [enabled ? 1 : 0],
    );
  } finally {
    await connection.end();
  }
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

async function preparePricingRows(connection: Connection) {
  const draft = (
    await queryRows<{ id: string; currencyCode: string }>(
      connection,
      `SELECT id, currencyCode
       FROM PricingRuleSet
       WHERE status = 'DRAFT'
       ORDER BY createdAt ASC
       LIMIT 1`,
    )
  )[0];
  if (!draft) throw new Error("Pricing draft rule set is missing.");

  await connection.query(
    `INSERT INTO PricingRule
      (id, ruleSetId, publicLabel, internalDescription, enabled, ruleType,
       amountCents, valueBps, priority, exclusiveGroupKey, effectiveStart,
       effectiveEnd, needsClientReview, version, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 1, 'FIXED_ADDITION',
       125, NULL, -10, NULL, NULL, NULL, 0, 1, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE
       ruleSetId = VALUES(ruleSetId),
       publicLabel = VALUES(publicLabel),
       internalDescription = VALUES(internalDescription),
       enabled = VALUES(enabled),
       amountCents = VALUES(amountCents),
       priority = VALUES(priority),
       needsClientReview = VALUES(needsClientReview),
       updatedAt = NOW(3)`,
    [
      screenshotRuleId,
      draft.id,
      screenshotLabel,
      "Temporary Task 008 screenshot draft rule.",
    ],
  );
  await connection.query(
    `INSERT INTO PricingRuleApplicability
      (id, ruleId, scope, engineType, categoryId, serviceId, createdAt)
     VALUES (?, ?, 'GLOBAL', NULL, NULL, NULL, NOW(3))
     ON DUPLICATE KEY UPDATE
       ruleId = VALUES(ruleId),
       scope = VALUES(scope),
       engineType = VALUES(engineType),
       categoryId = VALUES(categoryId),
       serviceId = VALUES(serviceId)`,
    [screenshotScopeId, screenshotRuleId],
  );

  const snapshot = {
    schemaVersion: 1,
    ruleSetId: draft.id,
    revisionId: screenshotRevisionId,
    revisionNumber: screenshotRevisionNumber,
    currencyCode: draft.currencyCode,
    publishedAt: new Date("2026-07-23T00:00:00.000Z").toISOString(),
    rules: [
      {
        id: "task008globalfixed",
        publicLabel: screenshotLabel,
        enabled: true,
        ruleType: "FIXED_ADDITION",
        amountCents: 125,
        valueBps: null,
        priority: -10,
        exclusiveGroupKey: null,
        effectiveStart: null,
        effectiveEnd: null,
        applicability: [
          {
            scope: "GLOBAL",
            engineType: null,
            categoryId: null,
            serviceId: null,
          },
        ],
      },
    ],
  };
  await connection.query(
    `DELETE FROM PricingRevision
     WHERE id = ? OR (ruleSetId = ? AND revisionNumber = ?)`,
    [screenshotRevisionId, draft.id, screenshotRevisionNumber],
  );
  await connection.query(
    `INSERT INTO PricingRevision
      (id, ruleSetId, revisionNumber, snapshot, publishedAt, createdAt)
     VALUES (?, ?, ?, ?, NOW(3), NOW(3))`,
    [
      screenshotRevisionId,
      draft.id,
      screenshotRevisionNumber,
      JSON.stringify(snapshot),
    ],
  );
}

async function removePricingRows() {
  const connection = await connectDatabase();
  try {
    await connection.query("DELETE FROM PricingRevision WHERE id = ?", [
      screenshotRevisionId,
    ]);
    await connection.query("DELETE FROM PricingRule WHERE id = ?", [
      screenshotRuleId,
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
    await page.goto(`${baseUrl}/admin/pricing`);
    await page.waitForURL((url) => url.pathname === "/admin/pricing");
    return;
  }

  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error("Admin seed credentials are required.");
  }
  await page.goto(`${baseUrl}/login?next=/admin/pricing`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/pricing");
}

async function screenshot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({
    path: path.join(outputDirectory, name),
    fullPage: true,
  });
}

async function runEstimate(page: Page) {
  await page.getByRole("button", { name: "Estimate total" }).click();
  await page.getByRole("heading", { name: /^\$/ }).waitFor();
  await page.getByText(screenshotLabel).waitFor();
  await settle(page);
}

async function capturePublicPages(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  const skilling = await context.newPage();
  await skilling.goto(`${baseUrl}${skillingPath}`);
  await runEstimate(skilling);
  await screenshot(skilling, "public-skilling-global-pricing-1440.png");

  const bossing = await context.newPage();
  await bossing.goto(`${baseUrl}${bossingPath}`);
  await runEstimate(bossing);
  await screenshot(bossing, "public-bossing-global-pricing-1440.png");

  const premium = await context.newPage();
  await premium.goto(`${baseUrl}${premiumPath}`);
  await premium.getByLabel("Supply support").check();
  await runEstimate(premium);
  await screenshot(premium, "public-premium-global-pricing-1440.png");

  await context.close();
}

async function captureAdminPages(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signIn(page);
  await page.addStyleTag({
    content: ".screenshot-sensitive { visibility: hidden !important; }",
  });
  await screenshot(page, "admin-pricing-overview-1440.png");

  await page.goto(`${baseUrl}/admin/pricing/rules/${screenshotRuleId}`);
  await screenshot(page, "admin-pricing-rule-editor-1440.png");

  await page.goto(`${baseUrl}/admin/pricing/preview?baseSubtotalCents=10000`);
  await page.getByText(screenshotLabel).waitFor();
  await screenshot(page, "admin-pricing-preview-1440.png");

  await page.goto(`${baseUrl}/admin/pricing/history`);
  await page.getByText(`#${screenshotRevisionNumber}`).waitFor();
  await screenshot(page, "admin-pricing-history-1440.png");
  await context.close();
}

async function captureMobilePages(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });

  const publicMobile = await context.newPage();
  await publicMobile.goto(`${baseUrl}${skillingPath}`);
  await runEstimate(publicMobile);
  await screenshot(publicMobile, "public-pricing-breakdown-mobile-390.png");

  const adminMobile = await context.newPage();
  await signIn(adminMobile);
  await screenshot(adminMobile, "admin-pricing-mobile-390.png");
  await context.close();
}

async function captureDisabledFlag(browser: Browser) {
  await setGlobalPricingFlag(false);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${skillingPath}`);
  await page.getByRole("button", { name: "Estimate total" }).click();
  await page.getByRole("heading", { name: "$5.00" }).waitFor();
  await screenshot(page, "public-pricing-flag-disabled-1440.png");
  await context.close();
  await setGlobalPricingFlag(true);
}

async function main() {
  const connection = await connectDatabase();
  let flagSnapshot: FlagSnapshot | null = null;
  let browser: Browser | null = null;
  try {
    flagSnapshot = await enableFlagsForScreenshots(connection);
    await preparePricingRows(connection);
    await mkdir(outputDirectory, { recursive: true });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    await captureAdminPages(browser);
    await capturePublicPages(browser);
    await captureMobilePages(browser);
    await captureDisabledFlag(browser);
  } finally {
    await browser?.close();
    await connection.end();
    if (flagSnapshot) await restoreFlags(flagSnapshot);
    await removePricingRows();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

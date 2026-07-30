import "dotenv/config";

import { createHash, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";
import mariadb, { type Connection } from "mariadb";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.join(process.cwd(), "artifacts", "task-011");
const flagKeys = [
  "custom_account_build_enabled",
  "global_pricing_enabled",
] as const;

type FlagSnapshot = Map<string, boolean>;
type CustomBuildFixture = {
  requestId: string;
  trackingUrl: string;
};

async function connectDatabase() {
  if (
    !process.env.DATABASE_USER ||
    !process.env.DATABASE_NAME ||
    !process.env.DATABASE_HOST
  ) {
    throw new Error(
      "Database environment is required to enable Task 011 screenshots.",
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

async function prepareCustomBuildRows(
  connection: Connection,
): Promise<CustomBuildFixture> {
  const rawTrackingToken = randomBytes(32).toString("base64url");
  const trackingHash = createHash("sha256")
    .update(rawTrackingToken)
    .digest("hex");
  const service = (
    await queryRows<{ id: string }>(
      connection,
      "SELECT id FROM CustomBuildService WHERE stableKey = 'custom-account-build-main' LIMIT 1",
    )
  )[0];
  const revision = (
    await queryRows<{ id: string }>(
      connection,
      "SELECT id FROM CustomBuildRevision ORDER BY revisionNumber DESC LIMIT 1",
    )
  )[0];
  const objective = (
    await queryRows<{ id: string; publicName: string }>(
      connection,
      "SELECT id, publicName FROM CustomBuildObjective WHERE stableKey = 'custom-build:quest:barrows-gloves' LIMIT 1",
    )
  )[0];
  const admin = (
    await queryRows<{ id: string }>(
      connection,
      "SELECT id FROM User WHERE email = ? LIMIT 1",
      [process.env.ADMIN_SEED_EMAIL?.toLowerCase()],
    )
  )[0];
  if (!service || !revision || !objective || !admin) {
    throw new Error("Task 011 screenshot prerequisites are missing.");
  }

  await connection.query(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'custom_account_build_enabled'",
  );
  await connection.query(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'global_pricing_enabled'",
  );
  await connection.query(
    "UPDATE CustomBuildService SET availabilityState = 'AVAILABLE' WHERE id = ?",
    [service.id],
  );

  await connection.query(
    "DELETE FROM CustomBuildQuoteDecision WHERE quoteId = 'task011screenshotquote'",
  );
  await connection.query(
    "DELETE FROM CustomBuildQuoteLine WHERE revisionId = 'task011screenshotrevision'",
  );
  await connection.query(
    "DELETE FROM CustomBuildQuoteRevision WHERE quoteId = 'task011screenshotquote'",
  );
  await connection.query(
    "DELETE FROM CustomBuildQuote WHERE id = 'task011screenshotquote'",
  );
  await connection.query(
    "DELETE FROM CustomBuildAttachment WHERE requestId = 'task011screenshotrequest'",
  );
  await connection.query(
    "DELETE FROM CustomBuildRequestObjective WHERE requestId = 'task011screenshotrequest'",
  );
  await connection.query(
    "DELETE FROM CustomBuildRequestSkill WHERE requestId = 'task011screenshotrequest'",
  );
  await connection.query(
    "DELETE FROM CustomBuildRequestStatusEvent WHERE requestId = 'task011screenshotrequest'",
  );
  await connection.query(
    "DELETE FROM CustomBuildRequest WHERE id = 'task011screenshotrequest'",
  );
  await connection.query(
    "DELETE FROM AuditLog WHERE id = 'task011screenshotaudit'",
  );

  const quoteSnapshot = JSON.stringify({
    schemaVersion: 1,
    quote: {
      publicQuoteNumber: "CQ-20300101-SHOT",
      revisionNumber: 1,
      currencyCode: "USD",
      expiresAt: "2030-01-01T00:00:00.000Z",
    },
    lines: [
      {
        publicDescription: "Custom account build scope",
        quantity: 1,
        unitAmountCents: 32100,
        lineTotalCents: 32100,
        lineType: "SERVICE",
        sortOrder: 10,
      },
    ],
    subtotalCents: 32100,
    adjustmentsCents: 0,
    finalTotalCents: 32100,
    estimatedDeliveryText: "7-10 days after approval",
    includedWorkSummary: "Staff-reviewed custom account build scope.",
    exclusions: "No checkout, order, payment or credential handover.",
    customerSafeTerms:
      "Quote acceptance records approval only and creates no payment.",
    createdAt: "2026-07-29T00:00:00.000Z",
  });

  await connection.query(
    `INSERT INTO CustomBuildRequest
      (id, publicRequestNumber, customBuildServiceId, publishedRevisionId,
       status, estimateState, estimateSnapshot, gameMode, displayName, email,
       discordUsername, rsn, customerNotes, contactConsentAt,
       contactConsentPolicyVersion, trackingTokenHash, idempotencyKeyHash,
       submittedAt, updatedAt, concurrencyVersion)
     VALUES ('task011screenshotrequest', 'CB-20300101-SHOT', ?, ?,
       'QUOTE_SENT', 'AUTOMATIC', ?, 'NORMAL', 'Screenshot Customer',
       'task011-screenshot@example.test', 'task011.screenshot', 'Task011',
       'Safe screenshot notes only.', NOW(3), 'custom-build-request-v1',
       ?, NULL, NOW(3), NOW(3), 3)`,
    [
      service.id,
      revision.id,
      JSON.stringify({
        schemaVersion: 1,
        estimateState: "AUTOMATIC",
        noOrderCreated: true,
        noPaymentCreated: true,
      }),
      trackingHash,
    ],
  );
  await connection.query(
    `INSERT INTO CustomBuildRequestSkill
      (id, requestId, skillKey, valueMode, currentLevel, targetLevel,
       currentXp, targetXp, freshStart, sortOrder)
     VALUES ('task011screenshotskill', 'task011screenshotrequest',
       'ATTACK', 'LEVEL', 1, 50, 0, 101333, 0, 10)`,
  );
  await connection.query(
    `INSERT INTO CustomBuildRequestObjective
      (id, requestId, objectiveId, objectiveStableKey, objectiveType,
       publicName, customerAlreadyCompleted, sortOrder)
     VALUES ('task011screenshotobjective', 'task011screenshotrequest',
       ?, 'custom-build:quest:barrows-gloves', 'QUEST', ?, 0, 10)`,
    [objective.id, objective.publicName],
  );
  await connection.query(
    `INSERT INTO CustomBuildRequestStatusEvent
      (id, requestId, previousStatus, newStatus, publicMessage, internalReason,
       actorId, safeMetadata, createdAt)
     VALUES ('task011screenshotstatus', 'task011screenshotrequest',
       'QUOTE_DRAFT', 'QUOTE_SENT', 'Your quote is ready to review.',
       NULL, ?, ?, NOW(3))`,
    [
      admin.id,
      JSON.stringify({ quoteId: "task011screenshotquote", revisionNumber: 1 }),
    ],
  );
  await connection.query(
    `INSERT INTO CustomBuildAttachment
      (id, stableKey, requestId, originalFilename, storageFilename, storageRoot,
       detectedMime, extension, sizeBytes, sha256, status, scanStatus,
       uploadedAt, concurrencyVersion)
     VALUES ('task011screenshotattachment', 'task011-screenshot-attachment',
       'task011screenshotrequest', 'safe-scope.png', 'safe-scope.png',
       '/tmp/osrs-services-task011-private', 'image/png', '.png', 8, ?,
       'QUARANTINED', 'NOT_SCANNED', NOW(3), 1)`,
    [createHash("sha256").update("metadata").digest("hex")],
  );
  await connection.query(
    `INSERT INTO CustomBuildQuote
      (id, publicQuoteNumber, requestId, currencyCode, status,
       currentRevisionNumber, issuedAt, expiresAt, customerMessage,
       privateInternalNote, createdAt, updatedAt, concurrencyVersion)
     VALUES ('task011screenshotquote', 'CQ-20300101-SHOT',
       'task011screenshotrequest', 'USD', 'SENT', 1, NOW(3),
       '2030-01-01 00:00:00.000', 'Your safe custom quote is ready.',
       'Internal screenshot note.', NOW(3), NOW(3), 1)`,
  );
  await connection.query(
    `INSERT INTO CustomBuildQuoteRevision
      (id, quoteId, revisionNumber, snapshotSchemaVersion, snapshot,
       subtotalCents, adjustmentsCents, finalTotalCents, estimatedDeliveryText,
       includedWorkSummary, exclusions, customerSafeTerms, createdById,
       createdAt, sentAt)
     VALUES ('task011screenshotrevision', 'task011screenshotquote', 1,
       1, ?, 32100, 0, 32100, '7-10 days after approval',
       'Staff-reviewed custom account build scope.',
       'No checkout, order, payment or credential handover.',
       'Quote acceptance records approval only and creates no payment.',
       ?, NOW(3), NOW(3))`,
    [quoteSnapshot, admin.id],
  );
  await connection.query(
    `INSERT INTO CustomBuildQuoteLine
      (id, revisionId, lineType, publicDescription, quantity, unitAmountCents,
       lineTotalCents, sortOrder)
     VALUES ('task011screenshotline', 'task011screenshotrevision', 'SERVICE',
       'Custom account build scope', 1, 32100, 32100, 10)`,
  );
  await connection.query(
    `INSERT INTO AuditLog
      (id, actorId, action, targetType, targetId, metadata, createdAt)
     VALUES ('task011screenshotaudit', ?, 'custom_build.quote.sent',
       'CustomBuildQuote', 'task011screenshotquote', ?, NOW(3))`,
    [
      admin.id,
      JSON.stringify({
        requestId: "task011screenshotrequest",
        revisionNumber: 1,
      }),
    ],
  );

  return {
    requestId: "task011screenshotrequest",
    trackingUrl: `/custom-account-build/track/${rawTrackingToken}`,
  };
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
      ".screenshot-sensitive { visibility: hidden !important; }",
      "input[name='displayName'], input[name='email'], input[name='discordUsername'], input[name='rsn'], textarea[name='customerNotes'] { color: transparent !important; caret-color: transparent !important; }",
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
    await page.goto(`${baseUrl}/admin/custom-builds`);
    await page.waitForURL((url) => url.pathname === "/admin/custom-builds");
    return;
  }

  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error("Admin seed credentials are required.");
  }
  await page.goto(`${baseUrl}/login?next=/admin/custom-builds`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/custom-builds");
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
  const page = await context.newPage();

  await page.goto(`${baseUrl}/custom-account-build`);
  await page.getByRole("heading", { name: "Custom Account Build" }).waitFor();
  await screenshot(page, "public-custom-build-1440.png");

  await page.getByLabel(/Barrows gloves quest line/i).check();
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await page.getByRole("heading", { name: "Automatic estimate" }).waitFor();
  await screenshot(page, "public-custom-build-estimate-1440.png");

  await page.getByLabel(/Hard achievement diary tier/i).check();
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await page.getByRole("heading", { name: "Partial estimate" }).waitFor();
  await screenshot(page, "public-custom-build-partial-review-1440.png");

  await page.getByLabel("Display name").fill("Screenshot Customer");
  await page
    .getByLabel("Email address")
    .fill("task011-screenshot@example.test");
  await page.getByLabel("Discord username").fill("task011.screenshot");
  await page.getByLabel("RSN or public character name").fill("Task011");
  await page
    .getByLabel("Private requirements notes")
    .fill("Safe screenshot scope notes only.");
  await page.locator('input[name="consentAccepted"]').check();
  await page.getByRole("button", { name: "Submit request" }).click();
  await page.getByRole("heading", { name: "Request received" }).waitFor();
  await screenshot(page, "public-custom-build-request-confirmation-1440.png");

  await context.close();
}

async function captureMobilePage(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/custom-account-build`);
  await page.getByRole("heading", { name: "Custom Account Build" }).waitFor();
  await screenshot(page, "public-custom-build-mobile-390.png");
  await context.close();
}

async function captureTrackingPage(
  browser: Browser,
  fixture: CustomBuildFixture,
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${fixture.trackingUrl}`);
  await page.getByText("CQ-20300101-SHOT").waitFor();
  await screenshot(page, "public-custom-build-tracking-1440.png");
  await context.close();
}

async function captureAdminPages(
  browser: Browser,
  fixture: CustomBuildFixture,
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signIn(page);
  await screenshot(page, "admin-custom-build-overview-1440.png");

  await page.goto(`${baseUrl}/admin/custom-builds/config`);
  await page.getByRole("heading", { name: "Custom Build Config" }).waitFor();
  await screenshot(page, "admin-custom-build-config-1440.png");

  await page.goto(
    `${baseUrl}/admin/custom-builds/requests/${fixture.requestId}`,
  );
  await page.getByRole("heading", { name: "Request Detail" }).waitFor();
  await screenshot(page, "admin-custom-build-request-review-1440.png");

  await page.goto(
    `${baseUrl}/admin/custom-builds/requests/${fixture.requestId}/quote`,
  );
  await page.getByRole("heading", { name: "Quote Editor" }).waitFor();
  await screenshot(page, "admin-custom-build-quote-editor-1440.png");

  await context.close();
}

async function main() {
  const connection = await connectDatabase();
  let flagSnapshot: FlagSnapshot | null = null;
  let browser: Browser | null = null;
  try {
    flagSnapshot = await snapshotFlags(connection);
    const fixture = await prepareCustomBuildRows(connection);
    await mkdir(outputDirectory, { recursive: true });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    await captureAdminPages(browser, fixture);
    await capturePublicPages(browser);
    await captureTrackingPage(browser, fixture);
    await captureMobilePage(browser);
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

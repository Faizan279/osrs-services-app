import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import argon2 from "argon2";
import mariadb from "mariadb";

type RequestResult = {
  created: boolean;
  requestId: string;
  publicRequestNumber: string;
  trackingUrl: string;
};

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

async function prepareCustomBuildFixture() {
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'custom_account_build_enabled'",
  );
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'global_pricing_enabled'",
  );
  await databaseRows(
    "UPDATE CustomBuildService SET availabilityState = 'AVAILABLE' WHERE stableKey = 'custom-account-build-main'",
  );
  await databaseRows(
    `UPDATE CatalogueService
     SET availabilityState = 'AVAILABLE', publicationStatus = 'PUBLISHED'
     WHERE seededKey = 'custom-account-build'`,
  );
}

async function ensureSupportAgent() {
  const password = "Task011-Support-Password-Only";
  const email = "task011-support@example.test";
  const passwordHash = await argon2.hash(password);
  const role = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM Role WHERE `key` = 'SUPPORT_AGENT' LIMIT 1",
    ),
  );
  await databaseRows(
    `INSERT INTO User
      (id, email, emailVerified, name, passwordHash, status, createdAt, updatedAt)
     VALUES ('task011supportuser', ?, NOW(3), 'Task 011 Support', ?, 'ACTIVE', NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE passwordHash = VALUES(passwordHash), status = 'ACTIVE'`,
    [email, passwordHash],
  );
  await databaseRows(
    `INSERT IGNORE INTO UserRole (userId, roleId, assignedAt)
     VALUES ('task011supportuser', ?, NOW(3))`,
    [role.id],
  );
  return { email, password };
}

async function signIn(page: Page, next = "/admin/custom-builds") {
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

function requestPayload(suffix: string) {
  return {
    serviceSlug: "custom-account-build",
    gameMode: "NORMAL",
    skills: [
      {
        skillKey: "ATTACK",
        valueMode: "LEVEL",
        currentLevel: 1,
        targetLevel: 50,
      },
    ],
    objectives: [
      {
        stableKey: "custom-build:quest:barrows-gloves",
        customerAlreadyCompleted: false,
      },
    ],
    displayName: "Task 011 E2E Customer",
    email: `task011-e2e-${suffix}@example.test`,
    discordUsername: "task011.e2e",
    rsn: "Task011",
    customerNotes: "Safe E2E scope notes only.",
    consentAccepted: true,
    idempotencyKey: `task011-e2e-${suffix}`,
  };
}

async function createRequestViaApi(request: APIRequestContext, suffix: string) {
  const response = await request.post("/api/custom-build/requests", {
    data: requestPayload(suffix),
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    ok: true;
    request: RequestResult;
  };
  expect(body.ok).toBe(true);
  return body.request;
}

async function requestByEmail(email: string) {
  return requiredRow(
    await databaseRows<{ id: string; publicRequestNumber: string }>(
      `SELECT id, publicRequestNumber
       FROM CustomBuildRequest
       WHERE email = ?
       ORDER BY submittedAt DESC
       LIMIT 1`,
      [email],
    ),
  );
}

async function createSentQuoteForRequest({
  requestId,
  expired = false,
}: {
  requestId: string;
  expired?: boolean;
}) {
  const suffix = Date.now().toString(36).slice(-8);
  const quoteId = `t011e2eq${suffix}`;
  const revisionId = `t011e2er${suffix}`;
  const lineId = `t011e2el${suffix}`;
  const admin = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM User WHERE email = ? LIMIT 1",
      [process.env.ADMIN_SEED_EMAIL!.toLowerCase()],
    ),
  );
  const expiresAt = expired
    ? "2026-01-01 00:00:00.000"
    : "2030-01-01 00:00:00.000";
  const snapshot = {
    schemaVersion: 1,
    quote: {
      publicQuoteNumber: `CQ-E2E-${suffix.toUpperCase()}`,
      revisionNumber: 1,
      currencyCode: "USD",
      expiresAt: expired
        ? "2026-01-01T00:00:00.000Z"
        : "2030-01-01T00:00:00.000Z",
    },
    lines: [
      {
        publicDescription: "E2E custom build scope",
        quantity: 1,
        unitAmountCents: 25000,
        lineTotalCents: 25000,
        lineType: "SERVICE",
        sortOrder: 10,
      },
    ],
    subtotalCents: 25000,
    adjustmentsCents: 0,
    finalTotalCents: 25000,
    estimatedDeliveryText: "7 days",
    includedWorkSummary: "E2E staff-reviewed custom build scope.",
    exclusions: "No checkout, order, payment or credential handover.",
    customerSafeTerms:
      "Quote acceptance records approval only and creates no payment.",
    createdAt: "2026-07-29T00:00:00.000Z",
  };
  await databaseRows(
    `INSERT INTO CustomBuildQuote
      (id, publicQuoteNumber, requestId, currencyCode, status,
       currentRevisionNumber, issuedAt, expiresAt, createdAt, updatedAt,
       concurrencyVersion)
     VALUES (?, ?, ?, 'USD', 'SENT', 1, NOW(3), ?, NOW(3), NOW(3), 1)`,
    [quoteId, snapshot.quote.publicQuoteNumber, requestId, expiresAt],
  );
  await databaseRows(
    `INSERT INTO CustomBuildQuoteRevision
      (id, quoteId, revisionNumber, snapshotSchemaVersion, snapshot,
       subtotalCents, adjustmentsCents, finalTotalCents, estimatedDeliveryText,
       includedWorkSummary, exclusions, customerSafeTerms, createdById,
       createdAt, sentAt)
     VALUES (?, ?, 1, 1, ?, 25000, 0, 25000, '7 days',
       'E2E staff-reviewed custom build scope.',
       'No checkout, order, payment or credential handover.',
       'Quote acceptance records approval only and creates no payment.',
       ?, NOW(3), NOW(3))`,
    [revisionId, quoteId, JSON.stringify(snapshot), admin.id],
  );
  await databaseRows(
    `INSERT INTO CustomBuildQuoteLine
      (id, revisionId, lineType, publicDescription, quantity, unitAmountCents,
       lineTotalCents, sortOrder)
     VALUES (?, ?, 'SERVICE', 'E2E custom build scope', 1, 25000, 25000, 10)`,
    [lineId, revisionId],
  );
  return { quoteId, revisionNumber: 1 };
}

async function expectNoPreviewOrderOrPaymentRows() {
  const orderRows = await databaseRows<{ value: number }>(
    `SELECT
       (SELECT COUNT(*) FROM \`Order\` WHERE id NOT LIKE 'task013%') +
       (SELECT COUNT(*) FROM OrderItem WHERE id NOT LIKE 'task013%') AS value`,
  );
  expect(orderRows[0]?.value ?? 0).toBe(0);

  const paymentTables = await databaseRows<{ value: number }>(
    `SELECT COUNT(*) AS value
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'Payment'`,
  );
  expect(paymentTables[0]?.value ?? 0).toBe(0);
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Task 011 E2E mutates deterministic custom-build fixtures once.",
  );
  await prepareCustomBuildFixture();
});

test("public custom-build page exposes a controlled disabled state", async ({
  page,
}) => {
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'custom_account_build_enabled'",
  );
  await page.goto("/custom-account-build");
  await expect(page.getByText("Request intake is paused")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit request" }),
  ).toHaveCount(0);

  const response = await page.request.post("/api/custom-build/estimate", {
    data: {
      serviceSlug: "custom-account-build",
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "ATTACK",
          valueMode: "LEVEL",
          currentLevel: 1,
          targetLevel: 50,
        },
      ],
      objectives: [],
      estimatedTotalCents: 1,
    },
  });
  const body = await response.json();
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(body.estimate.state).toBe("UNAVAILABLE");
});

test("estimate endpoint covers automatic, partial, manual and validation states", async ({
  page,
}) => {
  const automatic = await page.request.post("/api/custom-build/estimate", {
    data: {
      serviceSlug: "custom-account-build",
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "ATTACK",
          valueMode: "LEVEL",
          currentLevel: 1,
          targetLevel: 50,
          unitAmountCents: 1,
        },
      ],
      objectives: [
        {
          stableKey: "custom-build:quest:barrows-gloves",
          customerAlreadyCompleted: false,
        },
      ],
      estimatedTotalCents: 1,
    },
  });
  const automaticBody = await automatic.json();
  expect(automatic.status()).toBe(200);
  expect(automaticBody.estimate.state).toBe("AUTOMATIC");
  expect(automaticBody.estimate.estimatedTotalCents).not.toBe(1);
  expect(JSON.stringify(automaticBody)).not.toMatch(
    /email|discord|rsn|customerNotes|storageRoot/i,
  );

  const partial = await page.request.post("/api/custom-build/estimate", {
    data: {
      serviceSlug: "custom-account-build",
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "ATTACK",
          valueMode: "FRESH_ACCOUNT",
          targetLevel: 50,
        },
      ],
      objectives: [
        {
          stableKey: "custom-build:diary:hard-tier",
          customerAlreadyCompleted: false,
        },
      ],
    },
  });
  expect((await partial.json()).estimate.state).toBe("PARTIAL");

  const manual = await page.request.post("/api/custom-build/estimate", {
    data: {
      serviceSlug: "custom-account-build",
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "AGILITY",
          valueMode: "UNKNOWN_CURRENT",
          targetLevel: 70,
        },
      ],
      objectives: [],
    },
  });
  const manualBody = await manual.json();
  expect(manualBody.estimate.state).toBe("MANUAL_REVIEW_REQUIRED");
  expect(manualBody.estimate.estimatedTotalCents).toBeNull();

  const invalid = await page.request.post("/api/custom-build/estimate", {
    data: {
      serviceSlug: "custom-account-build",
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "ATTACK",
          valueMode: "LEVEL",
          currentLevel: 50,
          targetLevel: 49,
        },
      ],
      objectives: [],
    },
  });
  expect(invalid.status()).toBe(400);
  await expectNoPreviewOrderOrPaymentRows();
});

test("public request, private attachment, admin review and quote acceptance stay quote-only", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = `task011-e2e-ui-${Date.now()}@example.test`;

  await page.goto("/custom-account-build");
  await page.getByLabel(/Barrows gloves quest line/i).check();
  await page.getByRole("button", { name: "Calculate estimate" }).click();
  await expect(
    page.getByRole("heading", { name: "Automatic estimate" }),
  ).toBeVisible();
  await page.getByLabel("Display name").fill("Task 011 UI Customer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Discord username").fill("task011.ui");
  await page.getByLabel("RSN or public character name").fill("Task011");
  await page
    .getByLabel("Private requirements notes")
    .fill("Safe UI E2E notes only.");
  await page.locator('input[name="consentAccepted"]').check();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(
    page.getByRole("heading", { name: "Request received" }),
  ).toBeVisible({ timeout: 30_000 });
  const trackingHref = await page
    .getByRole("link", { name: "Open tracking page" })
    .getAttribute("href");
  expect(trackingHref).toBeTruthy();
  const token = trackingHref!.split("/").pop()!;
  expect(token.length).toBeGreaterThanOrEqual(40);

  const requestRecord = await requestByEmail(email);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const upload = await page.request.post(
    `/api/custom-build/requests/${requestRecord.id}/attachments`,
    {
      multipart: {
        token,
        file: {
          name: "safe-stats.png",
          mimeType: "image/png",
          buffer: png,
        },
      },
    },
  );
  const uploadBody = await upload.json();
  expect(upload.status()).toBe(200);
  expect(uploadBody.attachment.scanStatus).toBe("NOT_SCANNED");
  const rejectedUpload = await page.request.post(
    `/api/custom-build/requests/${requestRecord.id}/attachments`,
    {
      multipart: {
        token,
        file: {
          name: "unsafe.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from("<svg></svg>"),
        },
      },
    },
  );
  expect(rejectedUpload.status()).toBe(400);
  const anonymousDownload = await page.request.get(
    `/api/admin/custom-build/attachments/${uploadBody.attachment.id}`,
  );
  expect(anonymousDownload.status()).toBe(401);

  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Custom Builds Centre" }),
  ).toBeVisible();
  await page.goto("/admin/custom-builds/config");
  await expect(
    page.getByRole("heading", { name: "Custom Build Config" }),
  ).toBeVisible();
  await page.goto("/admin/custom-builds/rules");
  await expect(
    page.getByRole("heading", { name: "Skill And Objective Rules" }),
  ).toBeVisible();
  await page.goto("/admin/custom-builds/objectives");
  await expect(
    page.getByRole("heading", { name: "Build Objectives" }),
  ).toBeVisible();
  await page.goto("/admin/custom-builds/requests");
  await expect(page.getByText(requestRecord.publicRequestNumber)).toBeVisible();

  await page.goto(`/admin/custom-builds/requests/${requestRecord.id}`);
  await expect(
    page.getByRole("heading", { name: "Request Detail" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Request status updated.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(
    `/admin/custom-builds/requests/${requestRecord.id}/attachments`,
  );
  await expect(page.getByText("safe-stats.png")).toBeVisible();
  await page.getByLabel("Review status").selectOption("APPROVED");
  await page.getByRole("button", { name: "Save attachment review" }).click();
  await expect(page.getByText("Attachment review saved.")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(`/admin/custom-builds/requests/${requestRecord.id}/quote`);
  await expect(
    page.getByRole("heading", { name: "Quote Editor" }),
  ).toBeVisible();
  await page.getByLabel("Unit amount cents").fill("32100");
  await page.getByRole("button", { name: "Create revision" }).click();
  await expect(page.getByText("Quote revision created.")).toBeVisible({
    timeout: 30_000,
  });
  await acceptNextDialog(page);
  await page.getByRole("button", { name: "Send quote" }).click();
  await expect(page.getByText("Quote sent.")).toBeVisible({ timeout: 30_000 });

  await page.goto(trackingHref!);
  await expect(page.getByText(/CQ-/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /checkout|pay|order|add to cart/i }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Accept quote" }).click();
  await expect(page.getByText("Quote accepted.")).toBeVisible({
    timeout: 30_000,
  });
  await expectNoPreviewOrderOrPaymentRows();
});

test("quote decline, expiry and invalid tracking token remain safe", async ({
  page,
}) => {
  const declineRequest = await createRequestViaApi(
    page.request,
    `decline-${Date.now()}`,
  );
  const declineQuote = await createSentQuoteForRequest({
    requestId: declineRequest.requestId,
  });
  const declineToken = declineRequest.trackingUrl.split("/").pop()!;
  const declined = await page.request.post(
    `/api/custom-build/quotes/${declineQuote.quoteId}/decision`,
    {
      data: {
        token: declineToken,
        revisionNumber: declineQuote.revisionNumber,
        decision: "DECLINED",
      },
    },
  );
  const declinedBody = await declined.json();
  expect(declined.status()).toBe(200);
  expect(declinedBody.status).toBe("DECLINED");

  const expiredRequest = await createRequestViaApi(
    page.request,
    `expired-${Date.now()}`,
  );
  const expiredQuote = await createSentQuoteForRequest({
    requestId: expiredRequest.requestId,
    expired: true,
  });
  const expired = await page.request.post(
    `/api/custom-build/quotes/${expiredQuote.quoteId}/decision`,
    {
      data: {
        token: expiredRequest.trackingUrl.split("/").pop()!,
        revisionNumber: expiredQuote.revisionNumber,
        decision: "ACCEPTED",
      },
    },
  );
  expect(expired.status()).toBe(400);
  expect((await expired.json()).message).toMatch(/expired/i);

  const invalidTracking = await page.goto(
    "/custom-account-build/track/not-a-valid-token",
  );
  expect(invalidTracking?.status()).toBe(404);
});

test("support agent cannot publish or change quote pricing by default", async ({
  page,
}) => {
  const buildRequest = await createRequestViaApi(
    page.request,
    `support-denial-${Date.now()}`,
  );
  await page.context().clearCookies();
  await signInSupport(page, "/admin/custom-builds/revisions");
  await expect(page.getByText("Capability required.")).toBeVisible();
  await page.context().clearCookies();
  await signInSupport(
    page,
    `/admin/custom-builds/requests/${buildRequest.requestId}/quote`,
  );
  await expect(page.getByText("Capability required.")).toBeVisible();
});

test("public custom-build configurator fits required responsive widths", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto("/custom-account-build");
    await expect(
      page.getByRole("heading", { name: "Custom Account Build" }),
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

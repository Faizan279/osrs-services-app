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

async function signInToCatalogue(page: Page) {
  await page.goto("/login?next=/admin/catalogue/services");
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/catalogue/services");
  await expect(
    page.getByRole("heading", { name: "Services", exact: true }),
  ).toBeVisible();
}

const publicPremiumPath =
  "/services/premium-services/fire-cape-premium-service";

const fixture = {
  serviceId: "e2etask007svc",
  configId: "e2etask007cfg",
  packageId: "e2etask007pkg",
  optionId: "e2etask007opt",
  groupId: "e2etask007grp",
  requirementId: "e2etask007req",
  faqId: "e2etask007faq",
  serviceRequirementId: "e2etask007srq",
  seededKey: "e2e-task007-premium",
  slug: "e2e-task007-premium",
  livePackageName: "E2E Task 007 live package",
  stagedPackageName: "E2E Task 007 staged package",
};

test.beforeEach(async () => {
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` IN ('premium_configurator_enabled', 'bossing_calculator_enabled', 'skilling_calculator_enabled', 'catalogue_card_engine_enabled', 'rsn_eligibility_enabled')",
  );
});

test("public premium configurator renders and returns a server estimate", async ({
  page,
}) => {
  await page.goto(publicPremiumPath);
  await expect(
    page.getByRole("heading", { name: "Fire Cape premium service" }).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Package")).toBeVisible();
  await expect(page.getByLabel("Account game mode")).toBeVisible();
  await expect(page.getByLabel("Delivery speed")).toBeVisible();
  await expect(page.getByLabel("Check public stats using RSN")).toBeVisible();
  await expect(page.getByLabel("Enter stats manually")).toBeVisible();
  await expect(page.getByLabel("Continue without a stat check")).toBeVisible();
  await expect(page.getByText("Public stat requirements")).toBeVisible();
  await expect(page.getByText("Gear and unlock requirements")).toBeVisible();
  await expect(page.getByText("FAQ")).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);

  await page.getByLabel("Supply support").check();
  await page.getByRole("button", { name: "Estimate total" }).click();
  await expect(page.getByRole("heading", { name: /^\$/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("Estimated total", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Final price is confirmed before checkout."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Request quote" })).toHaveCount(
    2,
  );
  await expect(page.getByRole("button", { name: /add to cart/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /pay|place order|checkout/i }),
  ).toHaveCount(0);
});

test("public premium configurator falls back safely when disabled", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Mutates a global feature flag once.",
  );
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'premium_configurator_enabled'",
  );
  await page.goto(publicPremiumPath);
  await expect(
    page.getByRole("heading", { name: "Request a tailored quote" }),
  ).toBeVisible();
  await expect(page.getByLabel("Package")).toHaveCount(0);
  await expect(page.getByText("Premium configurator")).toHaveCount(0);
});

test("premium API returns friendly validation errors", async ({ page }) => {
  const service = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM CatalogueService WHERE seededKey = 'fire-cape-premium'",
    ),
  );
  const response = await page.request.post("/api/premium/estimate", {
    data: {
      serviceId: service.id,
      packageSlug: "missing-package",
      optionSelections: [],
      gameMode: "NORMAL",
      customerGearConfirmed: true,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
    },
  });
  const body = await response.json();

  expect(response.status()).toBe(400);
  expect(body.message).toMatch(/available premium package/i);
  expect(JSON.stringify(body)).not.toMatch(
    /Prisma|SQL|CatalogueService|stack/i,
  );
});

test("premium, bossing, skilling and catalogue-card engines remain public", async ({
  page,
}) => {
  await page.goto(publicPremiumPath);
  await expect(page.getByLabel("Package")).toBeVisible();

  await page.goto("/services/bossing-pvm/pvm-support");
  await expect(page.getByLabel("Boss")).toBeVisible();

  await page.goto("/services/power-levelling/skill-training-request");
  await expect(page.getByLabel("Skill")).toBeVisible();

  await page.goto("/services/quests/quest-progression");
  await expect(
    page.getByRole("heading", { name: "Quest progression" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Request a quote" }),
  ).toBeVisible();
});

test("premium configurator fits required responsive widths", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto(publicPremiumPath);
    await expect(page.getByLabel("Package")).toBeVisible();
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(
      sizes.clientWidth + 1,
    );
  }
});

test("admin premium package edits stay staged until republish", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Run the database mutation once.",
  );
  test.skip(
    !process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD,
    "Seed credentials are required.",
  );

  await createPremiumFixture();
  try {
    await signInToCatalogue(page);
    await page.goto(`/admin/catalogue/services/${fixture.serviceId}/premium`);
    await expect(
      page.getByRole("heading", { name: "E2E Task 007 premium" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Edit package" }).first().click();
    await expect(
      page.getByRole("heading", { name: fixture.livePackageName }),
    ).toBeVisible();
    await page.getByLabel("Package name").fill(fixture.stagedPackageName);
    await page.getByLabel("Base cents").fill("3600");
    await page.getByLabel("Minimum cents").fill("3600");
    const packageForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save package" }),
    });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/premium/packages/${fixture.packageId}`),
      { timeout: 30_000 },
    );
    await packageForm.evaluate((form: HTMLFormElement) => form.requestSubmit());
    await responsePromise;
    await expect
      .poll(async () => (await stageState()).stageCount, { timeout: 30_000 })
      .toBe(1);
    expect(await stageContains(fixture.stagedPackageName)).toBe(true);

    const liveAfterStage = requiredRow(
      await databaseRows<{ name: string; basePriceCents: number }>(
        "SELECT name, basePriceCents FROM PremiumPackage WHERE id = ?",
        [fixture.packageId],
      ),
    );
    expect(liveAfterStage).toEqual({
      name: fixture.livePackageName,
      basePriceCents: 2500,
    });

    await page.goto(`/services/premium-services/${fixture.slug}`);
    await expect(page.getByLabel("Package")).toContainText(
      fixture.livePackageName,
    );
    await expect(page.getByText(fixture.stagedPackageName)).toHaveCount(0);

    await page.goto(`/admin/catalogue/services/${fixture.serviceId}/preview`);
    await expect(
      page.getByRole("heading", {
        name: "Staged premium configurator configuration",
      }),
    ).toBeVisible();
    await expect(page.getByText(fixture.stagedPackageName)).toBeVisible();

    await page.goto(`/admin/catalogue/services/${fixture.serviceId}`);
    await expect(
      page.getByRole("button", { name: "Republish pending changes" }),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Republish pending changes" })
      .click({ noWaitAfter: true });
    await expect
      .poll(async () => {
        const row = requiredRow(
          await databaseRows<{ name: string }>(
            "SELECT name FROM PremiumPackage WHERE id = ?",
            [fixture.packageId],
          ),
        );
        return row.name;
      })
      .toBe(fixture.stagedPackageName);
    expect((await stageState()).stageCount).toBe(0);

    await page.goto(`/services/premium-services/${fixture.slug}`);
    await expect(page.getByLabel("Package")).toContainText(
      fixture.stagedPackageName,
    );
    await page.getByRole("button", { name: "Estimate total" }).click();
    await expect(page.getByRole("heading", { name: "$36.00" })).toBeVisible({
      timeout: 30_000,
    });

    const revision = requiredRow(
      await databaseRows<{
        revisionCount: number;
        snapshotContainsPackage: number;
      }>(
        `SELECT COUNT(*) AS revisionCount,
          SUM(JSON_SEARCH(snapshot, 'one', ?) IS NOT NULL) AS snapshotContainsPackage
         FROM CatalogueRevision WHERE serviceId = ?`,
        [fixture.stagedPackageName, fixture.serviceId],
      ),
    );
    expect(revision.revisionCount).toBe(1);
    expect(Number(revision.snapshotContainsPackage)).toBe(1);

    const audit = requiredRow(
      await databaseRows<{ count: number }>(
        `SELECT COUNT(*) AS count FROM AuditLog
         WHERE targetId = ? AND action = 'catalogue.premium.aggregate_republished'`,
        [fixture.serviceId],
      ),
    );
    expect(audit.count).toBe(1);
  } finally {
    await cleanupPremiumFixture();
  }
});

async function stageState() {
  return requiredRow(
    await databaseRows<{ stageCount: number }>(
      "SELECT COUNT(*) AS stageCount FROM CatalogueServiceStage WHERE serviceId = ?",
      [fixture.serviceId],
    ),
  );
}

async function stageContains(value: string) {
  const row = requiredRow(
    await databaseRows<{ present: number }>(
      `SELECT JSON_SEARCH(snapshot, 'one', ?) IS NOT NULL AS present
       FROM CatalogueServiceStage WHERE serviceId = ?`,
      [value, fixture.serviceId],
    ),
  );
  return row.present === 1;
}

async function cleanupPremiumFixture() {
  await databaseRows("DELETE FROM CatalogueRevision WHERE serviceId = ?", [
    fixture.serviceId,
  ]);
  await databaseRows("DELETE FROM CatalogueServiceStage WHERE serviceId = ?", [
    fixture.serviceId,
  ]);
  await databaseRows("DELETE FROM AuditLog WHERE targetId IN (?, ?, ?, ?)", [
    fixture.serviceId,
    fixture.configId,
    fixture.packageId,
    fixture.optionId,
  ]);
  await databaseRows("DELETE FROM CatalogueService WHERE id = ?", [
    fixture.serviceId,
  ]);
}

async function createPremiumFixture() {
  await cleanupPremiumFixture();
  const category = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM CatalogueCategory WHERE seededKey = 'premium-services'",
    ),
  );
  await databaseRows(
    `INSERT INTO CatalogueService
      (id, categoryId, name, slug, canonicalSlug, shortSummary, content,
       serviceType, engineType, publicationStatus, availabilityState,
       isFeatured, isQuoteOnly, displayOrder, seededKey, needsClientReview,
       version, createdAt, updatedAt)
     VALUES (?, ?, 'E2E Task 007 premium', ?, ?, ?, ?, 'SERVICE',
       'PREMIUM_SERVICE_CONFIGURATOR', 'PUBLISHED', 'AVAILABLE', 0, 1,
       997, ?, 1, 1, NOW(), NOW())`,
    [
      fixture.serviceId,
      category.id,
      fixture.slug,
      fixture.slug,
      "Disposable premium configurator service used only for Task 007 E2E validation.",
      "This disposable service verifies staged premium configurator publishing without touching seed catalogue records.",
      fixture.seededKey,
    ],
  );
  await databaseRows(
    "INSERT INTO CatalogueServiceGameMode (serviceId, gameMode) VALUES (?, 'NORMAL')",
    [fixture.serviceId],
  );
  await databaseRows(
    `INSERT INTO CatalogueRequirement
      (id, serviceId, title, description, type, isRequired, displayOrder,
       verificationMode, seededKey, createdAt, updatedAt)
     VALUES (?, ?, 'Premium context',
       'Confirm premium package details before review.', 'ACTIVITY', 1,
       10, 'CUSTOMER_CONFIRMED', ?, NOW(), NOW())`,
    [
      fixture.serviceRequirementId,
      fixture.serviceId,
      `${fixture.seededKey}:requirement`,
    ],
  );
  await databaseRows(
    `INSERT INTO PremiumServiceConfig
      (id, serviceId, normalModeMultiplierBps, ironmanMultiplierBps,
       hardcoreIronmanMultiplierBps, ultimateIronmanMultiplierBps,
       discordStreamEnabled, discordStreamPercentBps, rsnEligibilityEnabled,
       standardDeliveryEnabled, standardDeliveryLabel,
       standardDeliveryDescription, standardDeliveryEstimate,
       standardDeliveryMultiplierBps, standardDeliveryFixedFeeCents,
       priorityDeliveryEnabled, priorityDeliveryLabel,
       priorityDeliveryMultiplierBps, priorityDeliveryFixedFeeCents,
       expressDeliveryEnabled, expressDeliveryLabel,
       expressDeliveryMultiplierBps, expressDeliveryFixedFeeCents,
       needsClientReview, createdAt, updatedAt)
     VALUES (?, ?, 0, 1000, 2000, 3000, 1, 200, 1, 1, 'Standard',
       'Standard disposable validation queue.', 'Reviewed before confirmation',
       0, 0, 0, 'Priority', 1500, 0, 0, 'Express', 3000, 0, 1,
       NOW(), NOW())`,
    [fixture.configId, fixture.serviceId],
  );
  await databaseRows(
    `INSERT INTO PremiumPackage
      (id, serviceId, configId, slug, name, shortDescription, enabled,
       displayOrder, basePriceCents, minimumPriceCents, setupFeeCents,
       estimatedHours, difficultyTierLabel, requirementsSummary, gearNotes,
       unlockNotes, customerGearRequired, customerGearLabel,
       gearUnconfirmedAdjustmentCents, needsClientReview, seededKey,
       createdAt, updatedAt)
     VALUES (?, ?, ?, 'e2e-live-package', ?, ?,
       1, 10, 2500, 2500, 0, 1, 'Validation',
       'Public stats and customer-confirmed requirements are reviewed.',
       'Customer confirms gear without sharing secrets.',
       'Support verifies non-public unlocks.', 0, NULL, 0, 1, ?,
       NOW(), NOW())`,
    [
      fixture.packageId,
      fixture.serviceId,
      fixture.configId,
      fixture.livePackageName,
      "Disposable package used to verify staged premium configurator changes.",
      `${fixture.seededKey}:package`,
    ],
  );
  await databaseRows(
    `INSERT INTO PremiumRequirementGroup
      (id, serviceId, configId, packageId, title, description, displayOrder,
       needsClientReview, seededKey, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'Validation requirements',
       'Disposable requirements used for Task 007 E2E validation.',
       10, 1, ?, NOW(), NOW())`,
    [
      fixture.groupId,
      fixture.serviceId,
      fixture.configId,
      fixture.packageId,
      `${fixture.seededKey}:group`,
    ],
  );
  await databaseRows(
    `INSERT INTO PremiumRequirement
      (id, groupId, label, description, isRequired, displayOrder,
       verificationMode, metricKey, comparisonOperator, requiredValue,
       customerGuidance, needsClientReview, seededKey, createdAt, updatedAt)
     VALUES (?, ?, 'Ranged level',
       'Disposable public stat requirement for Task 007 validation.',
       1, 10, 'AUTOMATIC', 'skill.ranged.level', 'GREATER_THAN_OR_EQUAL', 70,
       'This public stat can be checked by RSN when enabled.', 1, ?,
       NOW(), NOW())`,
    [
      fixture.requirementId,
      fixture.groupId,
      `${fixture.seededKey}:requirement:stat`,
    ],
  );
  await databaseRows(
    `INSERT INTO PremiumFaq
      (id, serviceId, configId, packageId, question, answer, enabled,
       displayOrder, needsClientReview, seededKey, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'Do you need my password?',
       'No. This disposable validation fixture never asks for passwords.',
       1, 10, 1, ?, NOW(), NOW())`,
    [
      fixture.faqId,
      fixture.serviceId,
      fixture.configId,
      fixture.packageId,
      `${fixture.seededKey}:faq`,
    ],
  );
  await databaseRows(
    `INSERT INTO PremiumOption
      (id, serviceId, configId, packageId, slug, name, description, enabled,
       displayOrder, optionType, pricingMode, fixedPriceCents, percentBps,
       perUnitPriceCents, minimumQuantity, maximumQuantity, defaultQuantity,
       customerInputRequired, needsClientReview, seededKey, createdAt,
       updatedAt)
     VALUES (?, ?, ?, NULL, 'e2e-supply-support', 'E2E supply support',
       'Disposable option used to verify premium configurator estimates.',
       1, 10, 'SUPPLIES', 'FIXED_FEE', 500, 0, 0, 1, 1, 1, 0, 1, ?,
       NOW(), NOW())`,
    [
      fixture.optionId,
      fixture.serviceId,
      fixture.configId,
      `${fixture.seededKey}:option`,
    ],
  );
}

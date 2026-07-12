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

const publicBossingPath = "/services/bossing-pvm/pvm-support";

const fixture = {
  serviceId: "e2etask006svc",
  bossId: "e2etask006boss",
  methodId: "e2etask006method",
  ruleId: "e2etask006rule",
  requirementId: "e2etask006req",
  seededKey: "e2e-task006-bossing",
  slug: "e2e-task006-bossing",
  liveMethodName: "E2E Task 006 live method",
  stagedMethodName: "E2E Task 006 staged method",
};

test.beforeEach(async () => {
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` IN ('bossing_calculator_enabled', 'skilling_calculator_enabled', 'catalogue_card_engine_enabled')",
  );
});

test("public bossing calculator renders and returns a server estimate", async ({
  page,
}) => {
  await page.goto(publicBossingPath);
  await expect(
    page.getByRole("heading", { name: "PvM support" }).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Boss")).toBeVisible();
  await expect(page.getByLabel("Method or package")).toBeVisible();
  await expect(page.getByLabel("Delivery speed")).toBeVisible();
  await expect(page.getByText("Final price is confirmed")).toBeVisible();
  await page.getByRole("button", { name: "Estimate total" }).click();
  await expect(page.getByRole("heading", { name: /^\$/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Requested kills")).toBeVisible();
  await expect(page.getByRole("link", { name: "Request quote" })).toHaveCount(
    2,
  );
  await expect(page.getByRole("button", { name: /add to cart/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /pay|place order/i }),
  ).toHaveCount(0);
});

test("public bossing calculator falls back safely when disabled", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Mutates a global feature flag once.",
  );
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 0 WHERE `key` = 'bossing_calculator_enabled'",
  );
  await page.goto(publicBossingPath);
  await expect(
    page.getByRole("heading", { name: "Request a tailored quote" }),
  ).toBeVisible();
  await expect(page.getByLabel("Boss")).toHaveCount(0);
  await expect(page.getByText("Server-backed PvM calculator")).toHaveCount(0);
});

test("public bossing calculator shows friendly validation errors", async ({
  page,
}) => {
  await page.goto(publicBossingPath);
  await page.getByLabel("Current KC to target KC").check();
  await page.getByRole("spinbutton", { name: "Current KC" }).fill("25");
  await page.getByRole("spinbutton", { name: "Target KC" }).fill("25");
  await page.getByRole("button", { name: "Estimate total" }).click();
  await expect(page.locator("#bossing-calculator-status")).toHaveText(
    "Target KC must be greater than current KC.",
    { timeout: 30_000 },
  );
  await expect(
    page.getByText(/Prisma|SQL|CatalogueService|stack/i),
  ).toHaveCount(0);
});

test("bossing, skilling and catalogue-card engines remain selectable publicly", async ({
  page,
}) => {
  await page.goto(publicBossingPath);
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

test("bossing calculator fits required responsive widths", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto(publicBossingPath);
    await expect(page.getByLabel("Boss")).toBeVisible();
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(
      sizes.clientWidth + 1,
    );
  }
});

test("admin bossing method edits stay staged until republish", async ({
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

  await createBossingFixture();
  try {
    await signInToCatalogue(page);
    await page.goto(`/admin/catalogue/services/${fixture.serviceId}/bossing`);
    await expect(
      page.getByRole("heading", { name: "E2E Task 006 bossing" }),
    ).toBeVisible();
    await page
      .getByRole("row", { name: new RegExp(fixture.liveMethodName) })
      .getByRole("link", { name: "Edit" })
      .click();
    await expect(
      page.getByRole("heading", { name: fixture.liveMethodName }),
    ).toBeVisible();
    await page.getByLabel("Method name").fill(fixture.stagedMethodName);
    await page.getByLabel("Cents per kill").fill("450");
    await page.getByRole("button", { name: "Save method" }).click({
      noWaitAfter: true,
    });
    await expect.poll(async () => (await stageState()).stageCount).toBe(1);
    expect(await stageContains(fixture.stagedMethodName)).toBe(true);

    const liveAfterStage = requiredRow(
      await databaseRows<{ name: string; basePriceCentsPerKill: number }>(
        "SELECT name, basePriceCentsPerKill FROM BossingMethod WHERE id = ?",
        [fixture.methodId],
      ),
    );
    expect(liveAfterStage).toEqual({
      name: fixture.liveMethodName,
      basePriceCentsPerKill: 300,
    });

    await page.goto(`/services/bossing-pvm/${fixture.slug}`);
    await expect(page.getByLabel("Method or package")).toContainText(
      fixture.liveMethodName,
    );
    await expect(page.getByText(fixture.stagedMethodName)).toHaveCount(0);

    await page.goto(`/admin/catalogue/services/${fixture.serviceId}/preview`);
    await expect(
      page.getByRole("heading", {
        name: "Staged PvM calculator configuration",
      }),
    ).toBeVisible();
    await expect(page.getByText(fixture.stagedMethodName)).toBeVisible();

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
            "SELECT name FROM BossingMethod WHERE id = ?",
            [fixture.methodId],
          ),
        );
        return row.name;
      })
      .toBe(fixture.stagedMethodName);
    expect((await stageState()).stageCount).toBe(0);

    await page.goto(`/services/bossing-pvm/${fixture.slug}`);
    await expect(page.getByLabel("Method or package")).toContainText(
      fixture.stagedMethodName,
    );
    await page.getByRole("button", { name: "Estimate total" }).click();
    await expect(page.getByRole("heading", { name: "$112.50" })).toBeVisible({
      timeout: 30_000,
    });

    const revision = requiredRow(
      await databaseRows<{
        revisionCount: number;
        snapshotContainsMethod: number;
      }>(
        `SELECT COUNT(*) AS revisionCount,
          SUM(JSON_SEARCH(snapshot, 'one', ?) IS NOT NULL) AS snapshotContainsMethod
         FROM CatalogueRevision WHERE serviceId = ?`,
        [fixture.stagedMethodName, fixture.serviceId],
      ),
    );
    expect(revision.revisionCount).toBe(1);
    expect(Number(revision.snapshotContainsMethod)).toBe(1);

    const audit = requiredRow(
      await databaseRows<{ count: number }>(
        `SELECT COUNT(*) AS count FROM AuditLog
         WHERE targetId = ? AND action = 'catalogue.bossing.aggregate_republished'`,
        [fixture.serviceId],
      ),
    );
    expect(audit.count).toBe(1);
  } finally {
    await cleanupBossingFixture();
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

async function cleanupBossingFixture() {
  await databaseRows("DELETE FROM CatalogueRevision WHERE serviceId = ?", [
    fixture.serviceId,
  ]);
  await databaseRows("DELETE FROM CatalogueServiceStage WHERE serviceId = ?", [
    fixture.serviceId,
  ]);
  await databaseRows("DELETE FROM AuditLog WHERE targetId IN (?, ?, ?, ?)", [
    fixture.serviceId,
    fixture.bossId,
    fixture.methodId,
    fixture.ruleId,
  ]);
  await databaseRows("DELETE FROM CatalogueService WHERE id = ?", [
    fixture.serviceId,
  ]);
}

async function createBossingFixture() {
  await cleanupBossingFixture();
  const category = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM CatalogueCategory WHERE seededKey = 'bossing-pvm'",
    ),
  );
  await databaseRows(
    `INSERT INTO CatalogueService
      (id, categoryId, name, slug, canonicalSlug, shortSummary, content,
       serviceType, engineType, publicationStatus, availabilityState,
       isFeatured, isQuoteOnly, displayOrder, seededKey, needsClientReview,
       version, createdAt, updatedAt)
     VALUES (?, ?, 'E2E Task 006 bossing', ?, ?, ?, ?, 'SERVICE',
       'BOSSING_ENGINE', 'PUBLISHED', 'AVAILABLE', 0, 1, 996, ?, 1, 1,
       NOW(), NOW())`,
    [
      fixture.serviceId,
      category.id,
      fixture.slug,
      fixture.slug,
      "Disposable bossing calculator service used only for Task 006 E2E validation.",
      "This disposable service verifies staged bossing calculator publishing without touching seed catalogue records.",
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
     VALUES (?, ?, 'Bossing requirements',
       'Confirm bossing stats and gear before review.', 'ACTIVITY', 1,
       10, 'CUSTOMER_CONFIRMED', ?, NOW(), NOW())`,
    [
      fixture.requirementId,
      fixture.serviceId,
      `${fixture.seededKey}:requirement`,
    ],
  );
  await databaseRows(
    `INSERT INTO BossingCalculatorRule
      (id, serviceId, normalModeMultiplierBps, ironmanMultiplierBps,
       hardcoreIronmanMultiplierBps, ultimateIronmanMultiplierBps,
       discordStreamEnabled, discordStreamPercentBps, standardDeliveryEnabled,
       standardDeliveryLabel, standardDeliveryDescription,
       standardDeliveryEstimate, standardDeliveryMultiplierBps,
       standardDeliveryFixedFeeCents, priorityDeliveryEnabled,
       priorityDeliveryLabel, priorityDeliveryMultiplierBps,
       priorityDeliveryFixedFeeCents, expressDeliveryEnabled,
       expressDeliveryLabel, expressDeliveryMultiplierBps,
       expressDeliveryFixedFeeCents, needsClientReview, createdAt, updatedAt)
     VALUES (?, ?, 0, 1000, 2000, 3000, 1, 200, 1, 'Standard',
       'Standard disposable validation queue.', 'Reviewed before confirmation',
       0, 0, 0, 'Priority', 1500, 0, 0, 'Express', 3000, 0, 1, NOW(), NOW())`,
    [fixture.ruleId, fixture.serviceId],
  );
  await databaseRows(
    `INSERT INTO BossingBossConfig
      (id, serviceId, bossKey, name, enabled, displayOrder, groupLabel,
       iconKey, description, needsClientReview, seededKey, createdAt, updatedAt)
     VALUES (?, ?, 'e2e-boss', 'E2E validation boss', 1, 10,
       'Validation', 'crosshair',
       'Disposable boss used to verify staged bossing calculator changes.',
       1, ?, NOW(), NOW())`,
    [fixture.bossId, fixture.serviceId, `${fixture.seededKey}:boss`],
  );
  await databaseRows(
    `INSERT INTO BossingMethod
      (id, serviceId, bossId, name, slug, shortDescription, enabled,
       displayOrder, priceMode, minimumKillCount, maximumKillCount,
       basePriceCentsPerKill, fixedPackagePriceCents, minimumPriceCents,
       setupFeeCents, difficultyTierLabel, expectedRequirementsSummary,
       gearNotes, supplyNotes, suppliesEnabled, suppliesFeeCents,
       customerGearRequired, customerGearLabel, gearAdjustmentCents,
       estimatedKillsPerHour, needsClientReview, seededKey, createdAt,
       updatedAt)
     VALUES (?, ?, ?, ?, 'e2e-live-route',
       'Disposable method used to verify staged bossing calculator changes.',
       1, 10, 'PER_KILL', 1, 500, 300, 0, 500, 0, 'Validation',
       'Public stats and gear are checked in review.', 'Bring suitable gear.',
       'Supplies are confirmed before checkout.', 0, 0, 0,
       'Customer gear confirmed', 0, 50, 1, ?, NOW(), NOW())`,
    [
      fixture.methodId,
      fixture.serviceId,
      fixture.bossId,
      fixture.liveMethodName,
      `${fixture.seededKey}:method`,
    ],
  );
}

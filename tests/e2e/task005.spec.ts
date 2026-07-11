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

const publicSkillingPath = "/services/power-levelling/skill-training-request";

const fixture = {
  serviceId: "e2etask005svc",
  skillId: "e2etask005skill",
  methodId: "e2etask005method",
  ruleId: "e2etask005rule",
  requirementId: "e2etask005req",
  seededKey: "e2e-task005-skilling",
  slug: "e2e-task005-skilling",
  liveMethodName: "E2E Task 005 live method",
  stagedMethodName: "E2E Task 005 staged method",
};

test.beforeEach(async () => {
  await databaseRows(
    "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'skilling_calculator_enabled'",
  );
});

test("public skilling calculator renders and returns a server estimate", async ({
  page,
}) => {
  await page.goto(publicSkillingPath);
  await expect(
    page.getByRole("heading", { name: "Skill training request" }).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Skill")).toBeVisible();
  await expect(page.getByLabel("Training method")).toBeVisible();
  await expect(page.getByText("Final price is confirmed")).toBeVisible();
  await page.getByRole("button", { name: "Estimate total" }).click();
  await expect(page.getByRole("heading", { name: "$5.00" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("XP required")).toBeVisible();
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

test("public skilling calculator shows friendly validation errors", async ({
  page,
}) => {
  await page.goto(publicSkillingPath);
  await page.getByLabel("Current level").fill("50");
  await page.getByLabel("Target level").fill("50");
  await page.getByRole("button", { name: "Estimate total" }).click();
  await expect(page.locator("#skilling-calculator-status")).toHaveText(
    "Target level must be higher than current level.",
    { timeout: 30_000 },
  );
  await expect(
    page.getByText(/Prisma|SQL|CatalogueService|stack/i),
  ).toHaveCount(0);
});

test("skilling calculator fits required responsive widths", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto(publicSkillingPath);
    await expect(page.getByLabel("Skill")).toBeVisible();
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(
      sizes.clientWidth + 1,
    );
  }
});

test("admin skilling method edits stay staged until republish", async ({
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

  await createSkillingFixture();
  try {
    await signInToCatalogue(page);
    await page.goto(`/admin/catalogue/services/${fixture.serviceId}/skilling`);
    await expect(
      page.getByRole("heading", { name: "E2E Task 005 skilling" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(
      page.getByRole("heading", { name: fixture.liveMethodName }),
    ).toBeVisible();
    await page.getByLabel("Method name").fill(fixture.stagedMethodName);
    await page.getByLabel("Cents per 1m XP").fill("9000");
    await page.getByRole("button", { name: "Save method" }).click({
      noWaitAfter: true,
    });
    await expect.poll(async () => (await stageState()).stageCount).toBe(1);
    expect(await stageContains(fixture.stagedMethodName)).toBe(true);

    const liveAfterStage = requiredRow(
      await databaseRows<{
        name: string;
        basePriceCentsPerMillionXp: number;
      }>(
        "SELECT name, basePriceCentsPerMillionXp FROM SkillingTrainingMethod WHERE id = ?",
        [fixture.methodId],
      ),
    );
    expect(liveAfterStage).toEqual({
      name: fixture.liveMethodName,
      basePriceCentsPerMillionXp: 1200,
    });

    await page.goto(`/services/power-levelling/${fixture.slug}`);
    await expect(page.getByLabel("Training method")).toContainText(
      fixture.liveMethodName,
    );
    await expect(page.getByText(fixture.stagedMethodName)).toHaveCount(0);

    await page.goto(`/admin/catalogue/services/${fixture.serviceId}/preview`);
    await expect(
      page.getByRole("heading", {
        name: "Staged calculator configuration",
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
            "SELECT name FROM SkillingTrainingMethod WHERE id = ?",
            [fixture.methodId],
          ),
        );
        return row.name;
      })
      .toBe(fixture.stagedMethodName);
    expect((await stageState()).stageCount).toBe(0);

    await page.goto(`/services/power-levelling/${fixture.slug}`);
    await expect(page.getByLabel("Training method")).toContainText(
      fixture.stagedMethodName,
    );
    await page.getByRole("button", { name: "Estimate total" }).click();
    await expect(page.getByRole("heading", { name: "$9.12" })).toBeVisible({
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
         WHERE targetId = ? AND action = 'catalogue.skilling.aggregate_republished'`,
        [fixture.serviceId],
      ),
    );
    expect(audit.count).toBe(1);
  } finally {
    await cleanupSkillingFixture();
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

async function cleanupSkillingFixture() {
  await databaseRows("DELETE FROM CatalogueRevision WHERE serviceId = ?", [
    fixture.serviceId,
  ]);
  await databaseRows("DELETE FROM CatalogueServiceStage WHERE serviceId = ?", [
    fixture.serviceId,
  ]);
  await databaseRows("DELETE FROM AuditLog WHERE targetId IN (?, ?, ?, ?)", [
    fixture.serviceId,
    fixture.skillId,
    fixture.methodId,
    fixture.ruleId,
  ]);
  await databaseRows("DELETE FROM CatalogueService WHERE id = ?", [
    fixture.serviceId,
  ]);
}

async function createSkillingFixture() {
  await cleanupSkillingFixture();
  const category = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM CatalogueCategory WHERE seededKey = 'power-levelling'",
    ),
  );
  await databaseRows(
    `INSERT INTO CatalogueService
      (id, categoryId, name, slug, canonicalSlug, shortSummary, content,
       serviceType, engineType, publicationStatus, availabilityState,
       isFeatured, isQuoteOnly, displayOrder, seededKey, needsClientReview,
       version, createdAt, updatedAt)
     VALUES (?, ?, 'E2E Task 005 skilling', ?, ?, ?, ?, 'SERVICE',
       'SKILLING_CALCULATOR', 'PUBLISHED', 'AVAILABLE', 0, 1, 995, ?, 1, 1,
       NOW(), NOW())`,
    [
      fixture.serviceId,
      category.id,
      fixture.slug,
      fixture.slug,
      "Disposable skilling calculator service used only for Task 005 E2E validation.",
      "This disposable service verifies staged skilling calculator publishing without touching seed catalogue records.",
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
     VALUES (?, ?, 'Current and target progress',
       'Provide the current and target level or XP for review.', 'SKILL', 1,
       10, 'CUSTOMER_CONFIRMED', ?, NOW(), NOW())`,
    [
      fixture.requirementId,
      fixture.serviceId,
      `${fixture.seededKey}:requirement`,
    ],
  );
  await databaseRows(
    `INSERT INTO SkillingCalculatorRule
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
    `INSERT INTO SkillingSkillConfig
      (id, serviceId, skillKey, name, enabled, displayOrder, iconKey,
       seededKey, createdAt, updatedAt)
     VALUES (?, ?, 'COOKING', 'Cooking', 1, 10, 'flame', ?, NOW(), NOW())`,
    [fixture.skillId, fixture.serviceId, `${fixture.seededKey}:cooking`],
  );
  await databaseRows(
    `INSERT INTO SkillingTrainingMethod
      (id, serviceId, skillConfigId, name, slug, shortDescription, enabled,
       displayOrder, minimumLevel, maximumLevel, xpPerHour,
       basePriceCentsPerMillionXp, minimumPriceCents, fixedFeeCents,
       suppliesEnabled, suppliesFeeCents, notes, needsClientReview, seededKey,
       createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'e2e-live-route',
       'Disposable method used to verify staged skilling calculator changes.',
       1, 10, 1, 99, 100000, 1200, 500, 0, 0, 0,
       'Needs client review. E2E validation fixture only.', 1, ?, NOW(), NOW())`,
    [
      fixture.methodId,
      fixture.serviceId,
      fixture.skillId,
      fixture.liveMethodName,
      `${fixture.seededKey}:method`,
    ],
  );
}

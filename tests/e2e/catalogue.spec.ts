import { expect, test } from "@playwright/test";
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

async function stageState(serviceId: string) {
  return requiredRow(
    await databaseRows<{
      count: number;
      requirementCount: number | null;
      mediaCount: number | null;
      shortSummary: string | null;
    }>(
      `SELECT COUNT(*) AS count,
        MAX(JSON_LENGTH(snapshot, '$.requirements')) AS requirementCount,
        MAX(JSON_LENGTH(snapshot, '$.mediaReferences')) AS mediaCount,
        MAX(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.service.shortSummary'))) AS shortSummary
       FROM CatalogueServiceStage WHERE serviceId = ?`,
      [serviceId],
    ),
  );
}

async function signInToCatalogue(page: import("@playwright/test").Page) {
  await page.goto("/login?next=/admin/catalogue/services");
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin\/catalogue\/services$/);
  await expect(
    page.getByRole("heading", { name: "Services", exact: true }),
  ).toBeVisible();
}

test("public catalogue supports search and category filtering", async ({
  page,
}) => {
  test.slow();
  await page.goto("/services");
  await expect(
    page.getByRole("heading", {
      name: "Find a service path for your next milestone.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Skill training request" }),
  ).toBeVisible();
  await expect(page.getByText("Quote only", { exact: true })).toHaveCount(4);
  await expect(page.getByText("Published", { exact: true })).toHaveCount(0);
  await page.getByLabel("Search catalogue").fill("quest");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/services\?q=quest/);
  await expect(
    page.getByRole("heading", { name: "Quest progression" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "PvM support" })).toHaveCount(
    0,
  );
  await page.goto("/services?category=quests");
  await expect(
    page.getByRole("heading", { name: "Quest progression" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "Diary progression" }),
  ).toHaveCount(0);
});

test("category and service detail routes expose public catalogue content", async ({
  page,
}) => {
  await page.goto("/services/quests");
  await expect(
    page.getByRole("heading", { name: "Quests", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Published", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "View Quest progression" }).click();
  await expect(page).toHaveURL(/\/services\/quests\/quest-progression$/);
  await expect(
    page.getByRole("heading", { name: "Quest progression", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Requirements" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Request a tailored quote" }),
  ).toBeVisible();
  await expect(page.getByText("Quote only", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Published", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Internal notes/i)).toHaveCount(0);
});

test("anonymous catalogue administration redirects to sign in", async ({
  page,
}) => {
  await page.goto("/admin/catalogue");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
});

test("catalogue pages avoid horizontal overflow", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto("/services");
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(
      sizes.clientWidth,
    );
  }
});

test("seeded Super Admin can open the catalogue editor", async ({ page }) => {
  test.slow();
  test.skip(
    !process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD,
    "Seed credentials are required.",
  );
  await page.goto("/login?next=/admin/catalogue");
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin\/catalogue$/);
  await expect(
    page.getByRole("heading", { name: "Catalogue", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "New service" }).click();
  await expect(
    page.getByRole("heading", { name: "New service" }),
  ).toBeVisible();
  await page.goto("/admin/catalogue/services");
  await page.getByLabel("Availability").selectOption("AVAILABLE");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("4 matching services")).toBeVisible();
  await page.getByLabel("Availability").selectOption("UNAVAILABLE");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("0 matching services")).toBeVisible();
});

test("published edits, children and media stay staged until atomic republish", async ({
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
  const service = requiredRow(
    await databaseRows<{
      id: string;
      shortSummary: string;
    }>("SELECT id, shortSummary FROM CatalogueService WHERE seededKey = ?", [
      "skill-training-request",
    ]),
  );
  const { revisions: revisionsBefore } = requiredRow(
    await databaseRows<{ revisions: number }>(
      "SELECT COUNT(*) AS revisions FROM CatalogueRevision WHERE serviceId = ?",
      [service.id],
    ),
  );
  const stagedSummary =
    "Pending staged summary for atomic publication workflow verification.";
  const stagedRequirement = "Pending publication workflow requirement";
  const stagedMediaPath = "/validation/pending-primary.webp";

  await signInToCatalogue(page);
  await page.goto(`/admin/catalogue/services/${service.id}`);
  await page.waitForLoadState("networkidle");
  await page.locator('textarea[name="shortSummary"]').fill(stagedSummary);
  await page
    .locator('input[name="gameModes"][value="ULTIMATE_IRONMAN"]')
    .uncheck();
  await page
    .getByRole("button", { name: "Save unpublished changes" })
    .click({ noWaitAfter: true });
  await expect.poll(async () => (await stageState(service.id)).count).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Pending unpublished changes" }),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/services/power-levelling/skill-training-request");
  await expect(
    page.getByText(service.shortSummary, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(stagedSummary, { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Ultimate Ironman", { exact: true }),
  ).toBeVisible();

  await page.goto(`/admin/catalogue/services/${service.id}/preview`);
  await expect(page.getByText(stagedSummary, { exact: true })).toBeVisible();
  await expect(page.getByText("Ultimate Ironman", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Back to editor" }).click();

  const requirementForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Add requirement" }),
  });
  await requirementForm
    .getByLabel("Title", { exact: true })
    .fill(stagedRequirement);
  await requirementForm
    .getByLabel("Description", { exact: true })
    .fill("A staged requirement that must remain private before republish.");
  await requirementForm
    .getByRole("button", { name: "Add requirement" })
    .click({ noWaitAfter: true });
  await expect
    .poll(async () => (await stageState(service.id)).requirementCount)
    .toBe(2);
  await page.reload();

  const mediaForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Add media reference" }),
  });
  await mediaForm
    .getByLabel("Asset path or URL", { exact: true })
    .fill(stagedMediaPath);
  await mediaForm
    .getByLabel("Alt text", { exact: true })
    .fill("Pending primary workflow artwork");
  await mediaForm.getByLabel("Primary media", { exact: true }).check();
  await mediaForm
    .getByRole("button", { name: "Add media reference" })
    .click({ noWaitAfter: true });
  await expect
    .poll(async () => (await stageState(service.id)).mediaCount)
    .toBe(1);
  await page.reload();

  const [privateState] = await databaseRows<{
    shortSummary: string;
    requirementCount: number;
    mediaCount: number;
    ultimateCount: number;
    stageCount: number;
  }>(
    `SELECT s.shortSummary,
      (SELECT COUNT(*) FROM CatalogueRequirement r WHERE r.serviceId = s.id AND r.title = ?) AS requirementCount,
      (SELECT COUNT(*) FROM CatalogueMediaReference m WHERE m.serviceId = s.id AND m.assetPath = ?) AS mediaCount,
      (SELECT COUNT(*) FROM CatalogueServiceGameMode g WHERE g.serviceId = s.id AND g.gameMode = 'ULTIMATE_IRONMAN') AS ultimateCount,
      (SELECT COUNT(*) FROM CatalogueServiceStage st WHERE st.serviceId = s.id) AS stageCount
     FROM CatalogueService s WHERE s.id = ?`,
    [stagedRequirement, stagedMediaPath, service.id],
  );
  expect(privateState).toEqual(
    expect.objectContaining({
      shortSummary: service.shortSummary,
      requirementCount: 0,
      mediaCount: 0,
      ultimateCount: 1,
      stageCount: 1,
    }),
  );

  await page.goto(`/admin/catalogue/services/${service.id}/preview`);
  await expect(
    page.getByText(stagedRequirement, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Pending primary workflow artwork", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to editor" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Republish pending changes" })
    .click({ noWaitAfter: true });
  await expect
    .poll(async () => {
      const [row] = await databaseRows<{ shortSummary: string }>(
        "SELECT shortSummary FROM CatalogueService WHERE id = ?",
        [service.id],
      );
      return row?.shortSummary;
    })
    .toBe(stagedSummary);

  const [publishedState] = await databaseRows<{
    shortSummary: string;
    primaryMediaPath: string;
    requirementCount: number;
    mediaCount: number;
    ultimateCount: number;
    stageCount: number;
    revisionCount: number;
  }>(
    `SELECT s.shortSummary, s.primaryMediaPath,
      (SELECT COUNT(*) FROM CatalogueRequirement r WHERE r.serviceId = s.id AND r.title = ?) AS requirementCount,
      (SELECT COUNT(*) FROM CatalogueMediaReference m WHERE m.serviceId = s.id AND m.assetPath = ? AND m.isPrimary = 1) AS mediaCount,
      (SELECT COUNT(*) FROM CatalogueServiceGameMode g WHERE g.serviceId = s.id AND g.gameMode = 'ULTIMATE_IRONMAN') AS ultimateCount,
      (SELECT COUNT(*) FROM CatalogueServiceStage st WHERE st.serviceId = s.id) AS stageCount,
      (SELECT COUNT(*) FROM CatalogueRevision rv WHERE rv.serviceId = s.id) AS revisionCount
     FROM CatalogueService s WHERE s.id = ?`,
    [stagedRequirement, stagedMediaPath, service.id],
  );
  expect(publishedState).toEqual(
    expect.objectContaining({
      shortSummary: stagedSummary,
      primaryMediaPath: stagedMediaPath,
      requirementCount: 1,
      mediaCount: 1,
      ultimateCount: 0,
      stageCount: 0,
      revisionCount: revisionsBefore + 1,
    }),
  );

  await page.goto("/services/power-levelling/skill-training-request");
  await expect(page.getByText(stagedSummary, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: stagedRequirement }),
  ).toBeVisible();
  await expect(page.getByText("Ultimate Ironman", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp("pending-primary\\.webp$"),
  );
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    "Pending primary workflow artwork",
  );

  await page.goto(`/admin/catalogue/services/${service.id}`);
  await page
    .locator('textarea[name="shortSummary"]')
    .fill(service.shortSummary);
  await page
    .locator('input[name="gameModes"][value="ULTIMATE_IRONMAN"]')
    .check();
  await page
    .getByRole("button", { name: "Save unpublished changes" })
    .click({ noWaitAfter: true });
  await expect
    .poll(async () => (await stageState(service.id)).shortSummary)
    .toBe(service.shortSummary);
  await page.reload();
  const stagedRequirementRow = page
    .getByRole("listitem")
    .filter({ hasText: stagedRequirement });
  page.once("dialog", (dialog) => dialog.accept());
  await stagedRequirementRow
    .getByRole("button", { name: "Remove" })
    .click({ noWaitAfter: true });
  await expect
    .poll(async () => (await stageState(service.id)).requirementCount)
    .toBe(1);
  await page.reload();
  const stagedMediaRow = page
    .getByRole("listitem")
    .filter({ hasText: stagedMediaPath });
  page.once("dialog", (dialog) => dialog.accept());
  await stagedMediaRow
    .getByRole("button", { name: "Remove" })
    .click({ noWaitAfter: true });
  await expect
    .poll(async () => (await stageState(service.id)).mediaCount)
    .toBe(0);
  await page.reload();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Republish pending changes" })
    .click({ noWaitAfter: true });
  await expect.poll(async () => (await stageState(service.id)).count).toBe(0);
  await page.goto(`/admin/catalogue/services/${service.id}`);

  const [restored] = await databaseRows<{
    shortSummary: string;
    primaryMediaPath: string | null;
    requirementCount: number;
    mediaCount: number;
    ultimateCount: number;
    stageCount: number;
  }>(
    `SELECT s.shortSummary, s.primaryMediaPath,
      (SELECT COUNT(*) FROM CatalogueRequirement r WHERE r.serviceId = s.id AND r.title = ?) AS requirementCount,
      (SELECT COUNT(*) FROM CatalogueMediaReference m WHERE m.serviceId = s.id AND m.assetPath = ?) AS mediaCount,
      (SELECT COUNT(*) FROM CatalogueServiceGameMode g WHERE g.serviceId = s.id AND g.gameMode = 'ULTIMATE_IRONMAN') AS ultimateCount,
      (SELECT COUNT(*) FROM CatalogueServiceStage st WHERE st.serviceId = s.id) AS stageCount
     FROM CatalogueService s WHERE s.id = ?`,
    [stagedRequirement, stagedMediaPath, service.id],
  );
  expect(restored).toEqual(
    expect.objectContaining({
      shortSummary: service.shortSummary,
      primaryMediaPath: null,
      requirementCount: 0,
      mediaCount: 0,
      ultimateCount: 1,
      stageCount: 0,
    }),
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Archive" })
    .click({ noWaitAfter: true });
  await expect
    .poll(async () => {
      const [row] = await databaseRows<{ publicationStatus: string }>(
        "SELECT publicationStatus FROM CatalogueService WHERE id = ?",
        [service.id],
      );
      return row?.publicationStatus;
    })
    .toBe("ARCHIVED");
  await page.goto(`/admin/catalogue/services/${service.id}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Republish archived service" })
    .click({ noWaitAfter: true });
  await expect
    .poll(async () => {
      const [row] = await databaseRows<{ event: string }>(
        "SELECT event FROM CatalogueRevision WHERE serviceId = ? ORDER BY revisionNumber DESC LIMIT 1",
        [service.id],
      );
      return row?.event;
    })
    .toBe("REPUBLISHED");
  const events = await databaseRows<{ event: string; summary: string }>(
    "SELECT event, summary FROM CatalogueRevision WHERE serviceId = ? ORDER BY revisionNumber DESC LIMIT 2",
    [service.id],
  );
  expect(events[0]).toEqual(
    expect.objectContaining({
      event: "REPUBLISHED",
      summary: "Published service content updated.",
    }),
  );
  expect(events[1]?.event).toBe("ARCHIVED");
});

test("failed republish preserves public content and discard restores the editor", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Run the database mutation once.",
  );
  test.skip(
    !process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD,
    "Seed credentials are required.",
  );
  const service = requiredRow(
    await databaseRows<{
      id: string;
      shortSummary: string;
    }>("SELECT id, shortSummary FROM CatalogueService WHERE seededKey = ?", [
      "quest-progression",
    ]),
  );
  const { revisions: revisionsBefore } = requiredRow(
    await databaseRows<{ revisions: number }>(
      "SELECT COUNT(*) AS revisions FROM CatalogueRevision WHERE serviceId = ?",
      [service.id],
    ),
  );
  const pendingSummary =
    "Pending quest summary used to verify failed publication rollback.";

  await signInToCatalogue(page);
  await page.goto(`/admin/catalogue/services/${service.id}`);
  await page.waitForLoadState("networkidle");
  await page.locator('textarea[name="shortSummary"]').fill(pendingSummary);
  await page
    .getByRole("button", { name: "Save unpublished changes" })
    .click({ noWaitAfter: true });
  await expect.poll(async () => (await stageState(service.id)).count).toBe(1);
  await page.reload();
  await databaseRows(
    `UPDATE CatalogueServiceStage
     SET snapshot = JSON_SET(
       snapshot,
       '$.service.publishAt', '2026-07-05T00:00:00.000Z',
       '$.service.unpublishAt', '2026-07-04T00:00:00.000Z'
     )
     WHERE serviceId = ?`,
    [service.id],
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Republish pending changes" })
    .click({ noWaitAfter: true });
  await expect(
    page.getByText("The publication schedule is invalid."),
  ).toBeVisible({ timeout: 30_000 });
  const [failedState] = await databaseRows<{
    shortSummary: string;
    stageCount: number;
    revisionCount: number;
  }>(
    `SELECT s.shortSummary,
      (SELECT COUNT(*) FROM CatalogueServiceStage st WHERE st.serviceId = s.id) AS stageCount,
      (SELECT COUNT(*) FROM CatalogueRevision rv WHERE rv.serviceId = s.id) AS revisionCount
     FROM CatalogueService s WHERE s.id = ?`,
    [service.id],
  );
  expect(failedState).toEqual(
    expect.objectContaining({
      shortSummary: service.shortSummary,
      stageCount: 1,
      revisionCount: revisionsBefore,
    }),
  );
  await page.goto("/services/quests/quest-progression");
  await expect(
    page.getByText(service.shortSummary, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(pendingSummary, { exact: true })).toHaveCount(0);

  await page.goto(`/admin/catalogue/services/${service.id}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Discard pending changes" })
    .click({ noWaitAfter: true });
  await expect.poll(async () => (await stageState(service.id)).count).toBe(0);
  await page.reload();
  await expect(page.locator('textarea[name="shortSummary"]')).toHaveValue(
    service.shortSummary,
  );
  const { stageCount } = requiredRow(
    await databaseRows<{ stageCount: number }>(
      "SELECT COUNT(*) AS stageCount FROM CatalogueServiceStage WHERE serviceId = ?",
      [service.id],
    ),
  );
  expect(stageCount).toBe(0);
});

import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function stageState(serviceId: string) {
  return requiredRow(
    await databaseRows<{
      count: number;
      requirementCount: number | null;
      mediaCount: number | null;
      shortSummary: string | null;
      version: number | null;
    }>(
      `SELECT COUNT(*) AS count,
        MAX(JSON_LENGTH(snapshot, '$.requirements')) AS requirementCount,
        MAX(JSON_LENGTH(snapshot, '$.mediaReferences')) AS mediaCount,
        MAX(JSON_UNQUOTE(JSON_EXTRACT(snapshot, '$.service.shortSummary'))) AS shortSummary,
        MAX(version) AS version
       FROM CatalogueServiceStage WHERE serviceId = ?`,
      [serviceId],
    ),
  );
}

async function stageContains(serviceId: string, value: string) {
  const { present } = requiredRow(
    await databaseRows<{ present: number }>(
      `SELECT JSON_SEARCH(snapshot, 'one', ?) IS NOT NULL AS present
       FROM CatalogueServiceStage WHERE serviceId = ?`,
      [value, serviceId],
    ),
  );
  return present === 1;
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

async function submitFormAndWaitForPost(
  page: Page,
  form: Locator,
  path: string,
) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes(path),
    { timeout: 30_000 },
  );
  await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
  await responsePromise;
}

async function setFormFieldValue(field: Locator, value: string) {
  await field.evaluate((element, nextValue) => {
    if (!(
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    )) {
      throw new Error("Expected an input or textarea field.");
    }
    element.value = nextValue;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await expect(field).toHaveValue(value);
}

const graphCycleSeedKeys = [
  "e2e-task004-graph-a",
  "e2e-task004-graph-b",
] as const;

async function cleanupRecommendationGraphCycleFixture() {
  const services = await databaseRows<{ id: string }>(
    `SELECT id FROM CatalogueService WHERE seededKey IN (?, ?)`,
    [...graphCycleSeedKeys],
  );
  const ids = services.map(({ id }) => id);
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(", ");
  await databaseRows(
    `DELETE FROM CatalogueRequirement WHERE serviceId IN (${placeholders})`,
    ids,
  );
  await databaseRows(
    `DELETE FROM CatalogueServiceStage WHERE serviceId IN (${placeholders})`,
    ids,
  );
  await databaseRows(
    `DELETE FROM CatalogueRevision WHERE serviceId IN (${placeholders})`,
    ids,
  );
  await databaseRows(
    `DELETE FROM CatalogueServiceGameMode WHERE serviceId IN (${placeholders})`,
    ids,
  );
  await databaseRows(
    `DELETE FROM AuditLog WHERE targetId IN (${placeholders})`,
    ids,
  );
  await databaseRows(
    `DELETE FROM CatalogueService WHERE id IN (${placeholders})`,
    ids,
  );
}

function recommendationGraphSnapshot({
  categoryId,
  idPrefix,
  name,
  recommendedServiceId,
  shortSummary,
  slug,
}: {
  categoryId: string;
  idPrefix: string;
  name: string;
  recommendedServiceId: string;
  shortSummary: string;
  slug: string;
}) {
  return {
    schemaVersion: 2,
    service: {
      categoryId,
      name,
      slug,
      canonicalSlug: slug,
      shortSummary,
      content:
        "Temporary catalogue content used only for the recommendation graph publication guard.",
      serviceType: "SERVICE",
      engineType: "CATALOGUE_CARD",
      availabilityState: "AVAILABLE",
      isFeatured: false,
      isQuoteOnly: true,
      displayOrder: 999,
      internalNotes: null,
      publicPreparationNotes: null,
      seoTitle: null,
      seoDescription: null,
      publishAt: null,
      unpublishAt: null,
      needsClientReview: true,
    },
    gameModes: ["NORMAL"],
    requirements: [
      {
        id: `${idPrefix}req`,
        title: "Linked prerequisite",
        description:
          "Temporary prerequisite used to verify recommendation graph cycle protection.",
        type: "ACCOUNT",
        isRequired: true,
        displayOrder: 10,
        verificationMode: "CUSTOMER_CONFIRMED",
        customerGuidance: null,
        metricKey: null,
        comparisonOperator: null,
        requiredValue: null,
        recommendedServiceId,
        seededKey: null,
      },
    ],
    mediaReferences: [],
    offerings: [],
  };
}

async function createRecommendationGraphCycleFixture() {
  await cleanupRecommendationGraphCycleFixture();
  const category = requiredRow(
    await databaseRows<{ id: string }>(
      "SELECT id FROM CatalogueCategory WHERE isActive = 1 ORDER BY displayOrder, name LIMIT 1",
    ),
  );
  const services = [
    {
      id: "e2egrapha",
      seededKey: graphCycleSeedKeys[0],
      name: "E2E graph service A",
      slug: "e2e-graph-service-a",
      shortSummary:
        "Temporary published graph service A before reciprocal staging.",
    },
    {
      id: "e2egraphb",
      seededKey: graphCycleSeedKeys[1],
      name: "E2E graph service B",
      slug: "e2e-graph-service-b",
      shortSummary:
        "Temporary published graph service B before reciprocal staging.",
    },
  ];
  for (const service of services) {
    await databaseRows(
      `INSERT INTO CatalogueService
        (id, categoryId, name, slug, canonicalSlug, shortSummary, content,
         serviceType, engineType, publicationStatus, availabilityState,
         isFeatured, isQuoteOnly, displayOrder, seededKey, needsClientReview,
         version, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'SERVICE', 'CATALOGUE_CARD', 'PUBLISHED',
        'AVAILABLE', 0, 1, 999, ?, 1, 1, NOW(), NOW())`,
      [
        service.id,
        category.id,
        service.name,
        service.slug,
        service.slug,
        service.shortSummary,
        "Temporary catalogue content used only for recommendation graph cycle E2E validation.",
        service.seededKey,
      ],
    );
    await databaseRows(
      "INSERT INTO CatalogueServiceGameMode (serviceId, gameMode) VALUES (?, 'NORMAL')",
      [service.id],
    );
  }
  const serviceA = services[0]!;
  const serviceB = services[1]!;
  await databaseRows(
    `INSERT INTO CatalogueServiceStage
      (id, serviceId, snapshot, baseVersion, version, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, 1, NOW(), NOW()), (?, ?, ?, 1, 1, NOW(), NOW())`,
    [
      "e2egraphstagea",
      serviceA.id,
      JSON.stringify(
        recommendationGraphSnapshot({
          categoryId: category.id,
          idPrefix: "e2egrapha",
          name: serviceA.name,
          slug: serviceA.slug,
          shortSummary:
            "Temporary pending graph service A with service B as a prerequisite.",
          recommendedServiceId: serviceB.id,
        }),
      ),
      "e2egraphstageb",
      serviceB.id,
      JSON.stringify(
        recommendationGraphSnapshot({
          categoryId: category.id,
          idPrefix: "e2egraphb",
          name: serviceB.name,
          slug: serviceB.slug,
          shortSummary:
            "Temporary pending graph service B with service A as a prerequisite.",
          recommendedServiceId: serviceA.id,
        }),
      ),
    ],
  );
  return { serviceA, serviceB };
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
  await expect(page.getByText("Quote only", { exact: true })).toHaveCount(11);
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
  const newServiceLink = page.getByRole("link", { name: "New service" });
  await expect(newServiceLink).toHaveAttribute(
    "href",
    "/admin/catalogue/services/new",
  );
  await newServiceLink.click();
  await expect(page).toHaveURL(/\/admin\/catalogue\/services\/new$/, {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "New service" })).toBeVisible({
    timeout: 30_000,
  });
  await page.goto("/admin/catalogue/services");
  const filtersForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Apply filters" }),
  });
  await page.getByLabel("Availability").selectOption("AVAILABLE");
  await filtersForm.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.getByText("11 matching services")).toBeVisible();
  await page.getByLabel("Availability").selectOption("UNAVAILABLE");
  await filtersForm.evaluate((form: HTMLFormElement) => form.requestSubmit());
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
  await expect(
    page.getByRole("link", { name: "Back to editor" }),
  ).toHaveAttribute("href", `/admin/catalogue/services/${service.id}`);
  await page.goto(`/admin/catalogue/services/${service.id}`);
  await expect(page).toHaveURL(
    new RegExp(`/admin/catalogue/services/${service.id}$`),
  );

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
  await expect(
    page.getByRole("link", { name: "Back to editor" }),
  ).toHaveAttribute("href", `/admin/catalogue/services/${service.id}`);
  await page.goto(`/admin/catalogue/services/${service.id}`);
  await expect(page).toHaveURL(
    new RegExp(`/admin/catalogue/services/${service.id}$`),
  );
  await expect(
    page.getByRole("button", { name: "Republish pending changes" }),
  ).toBeVisible({ timeout: 30_000 });
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
  const summaryField = page.locator('textarea[name="shortSummary"]');
  await setFormFieldValue(summaryField, service.shortSummary);
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

test("stale stage mutations, discard and republish preserve the newest snapshot", async ({
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
      version: number;
    }>(
      "SELECT id, shortSummary, version FROM CatalogueService WHERE seededKey = ?",
      ["pvm-support"],
    ),
  );
  const { revisions: revisionsBefore } = requiredRow(
    await databaseRows<{ revisions: number }>(
      "SELECT COUNT(*) AS revisions FROM CatalogueRevision WHERE serviceId = ?",
      [service.id],
    ),
  );
  const editorPath = `/admin/catalogue/services/${service.id}`;
  const conflictMessage =
    "Pending changes were updated by another user. Reload before continuing.";
  const acceptedRequirement = "Accepted concurrency requirement";
  const staleRequirement = "Stale concurrency requirement";
  const acceptedMediaPath = "/validation/concurrency-accepted.webp";
  const staleMediaPath = "/validation/concurrency-stale.webp";
  const initialPendingSummary =
    "Initial pending summary for optimistic concurrency verification.";
  const newestPendingSummary =
    "Newest pending summary that stale actions must preserve safely.";
  let currentVersion = service.version;

  await signInToCatalogue(page);
  await page.goto(editorPath);
  await page.waitForLoadState("networkidle");
  await page
    .locator('textarea[name="shortSummary"]')
    .fill(initialPendingSummary);
  const serviceForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Save unpublished changes" }),
  });
  await submitFormAndWaitForPost(page, serviceForm, editorPath);
  currentVersion += 1;
  await expect
    .poll(async () => (await stageState(service.id)).version, {
      timeout: 30_000,
    })
    .toBe(currentVersion);
  const initialStage = await stageState(service.id);
  const initialRequirementCount = initialStage.requirementCount ?? 0;
  const initialMediaCount = initialStage.mediaCount ?? 0;

  async function openStaleEditor() {
    await page.goto(editorPath);
    await page.waitForLoadState("networkidle");
    const stalePage = await page.context().newPage();
    await stalePage.goto(editorPath);
    await stalePage.waitForLoadState("networkidle");
    // Server-action hydration can finish just after network idle in production.
    await stalePage.waitForTimeout(500);
    return stalePage;
  }

  async function submitAndExpectSafeConflict(
    stalePage: import("@playwright/test").Page,
    submit: () => Promise<void>,
  ) {
    const responsePromise = stalePage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(editorPath),
      { timeout: 30_000 },
    );
    await submit();
    const response = await responsePromise;
    const decodedHeaders = Object.values(response.headers())
      .map((value) => {
        try {
          return decodeURIComponent(value).replaceAll("+", " ");
        } catch {
          return value;
        }
      })
      .join(" ");
    let responseBody = "";
    try {
      responseBody = await response.text();
    } catch {
      // Redirect responses expose the safe message in their Location header.
    }
    const safeResponse = `${decodedHeaders} ${responseBody}`;
    expect(safeResponse).toContain(conflictMessage);
    expect(safeResponse).not.toMatch(/CatalogueServiceStage|SQL|Prisma|stack/i);
  }

  let stalePage = await openStaleEditor();
  const acceptedRequirementForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Add requirement" }),
  });
  await acceptedRequirementForm
    .getByLabel("Title", { exact: true })
    .fill(acceptedRequirement);
  await acceptedRequirementForm
    .getByLabel("Description", { exact: true })
    .fill("An accepted requirement used to verify stage version conflicts.");
  await submitFormAndWaitForPost(page, acceptedRequirementForm, editorPath);
  currentVersion += 1;
  await expect
    .poll(async () => (await stageState(service.id)).version, {
      timeout: 30_000,
    })
    .toBe(currentVersion);

  const staleRequirementForm = stalePage.locator("form").filter({
    has: stalePage.getByRole("button", { name: "Add requirement" }),
  });
  await staleRequirementForm
    .getByLabel("Title", { exact: true })
    .fill(staleRequirement);
  await staleRequirementForm
    .getByLabel("Description", { exact: true })
    .fill("This stale requirement must never replace the newest snapshot.");
  await submitAndExpectSafeConflict(stalePage, () =>
    staleRequirementForm.evaluate((form: HTMLFormElement) =>
      form.requestSubmit(),
    ),
  );
  expect((await stageState(service.id)).version).toBe(currentVersion);
  expect((await stageState(service.id)).requirementCount).toBe(
    initialRequirementCount + 1,
  );
  expect(await stageContains(service.id, staleRequirement)).toBe(false);
  await stalePage.close();

  stalePage = await openStaleEditor();
  await page
    .locator('textarea[name="shortSummary"]')
    .fill("A newer service edit protects the accepted requirement.");
  await submitFormAndWaitForPost(page, serviceForm, editorPath);
  currentVersion += 1;
  await expect
    .poll(async () => (await stageState(service.id)).version, {
      timeout: 30_000,
    })
    .toBe(currentVersion);
  const staleRequirementRow = stalePage
    .getByRole("listitem")
    .filter({ hasText: acceptedRequirement });
  stalePage.once("dialog", (dialog) => dialog.accept());
  await submitAndExpectSafeConflict(stalePage, () =>
    staleRequirementRow
      .getByRole("button", { name: "Remove" })
      .click({ noWaitAfter: true }),
  );
  expect((await stageState(service.id)).version).toBe(currentVersion);
  expect(await stageContains(service.id, acceptedRequirement)).toBe(true);
  await stalePage.close();

  stalePage = await openStaleEditor();
  const acceptedMediaForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Add media reference" }),
  });
  await acceptedMediaForm
    .getByLabel("Asset path or URL", { exact: true })
    .fill(acceptedMediaPath);
  await acceptedMediaForm
    .getByLabel("Alt text", { exact: true })
    .fill("Accepted concurrency artwork");
  await submitFormAndWaitForPost(page, acceptedMediaForm, editorPath);
  currentVersion += 1;
  await expect
    .poll(async () => (await stageState(service.id)).version, {
      timeout: 30_000,
    })
    .toBe(currentVersion);

  const staleMediaForm = stalePage.locator("form").filter({
    has: stalePage.getByRole("button", { name: "Add media reference" }),
  });
  await staleMediaForm
    .getByLabel("Asset path or URL", { exact: true })
    .fill(staleMediaPath);
  await staleMediaForm
    .getByLabel("Alt text", { exact: true })
    .fill("Stale concurrency artwork");
  await submitAndExpectSafeConflict(stalePage, () =>
    staleMediaForm.evaluate((form: HTMLFormElement) => form.requestSubmit()),
  );
  expect((await stageState(service.id)).version).toBe(currentVersion);
  expect((await stageState(service.id)).mediaCount).toBe(initialMediaCount + 1);
  expect(await stageContains(service.id, staleMediaPath)).toBe(false);
  await stalePage.close();

  stalePage = await openStaleEditor();
  await page
    .locator('textarea[name="shortSummary"]')
    .fill("A newer service edit protects the accepted media reference.");
  await submitFormAndWaitForPost(page, serviceForm, editorPath);
  currentVersion += 1;
  await expect
    .poll(async () => (await stageState(service.id)).version, {
      timeout: 30_000,
    })
    .toBe(currentVersion);
  const staleMediaRow = stalePage
    .getByRole("listitem")
    .filter({ hasText: acceptedMediaPath });
  stalePage.once("dialog", (dialog) => dialog.accept());
  await submitAndExpectSafeConflict(stalePage, () =>
    staleMediaRow
      .getByRole("button", { name: "Remove" })
      .click({ noWaitAfter: true }),
  );
  expect((await stageState(service.id)).version).toBe(currentVersion);
  expect(await stageContains(service.id, acceptedMediaPath)).toBe(true);
  await stalePage.close();

  stalePage = await openStaleEditor();
  await page
    .locator('textarea[name="shortSummary"]')
    .fill("A newer service edit protects the stage from stale discard.");
  await submitFormAndWaitForPost(page, serviceForm, editorPath);
  currentVersion += 1;
  await expect
    .poll(async () => (await stageState(service.id)).version, {
      timeout: 30_000,
    })
    .toBe(currentVersion);
  stalePage.once("dialog", (dialog) => dialog.accept());
  await submitAndExpectSafeConflict(stalePage, () =>
    stalePage
      .getByRole("button", { name: "Discard pending changes" })
      .click({ noWaitAfter: true }),
  );
  expect((await stageState(service.id)).version).toBe(currentVersion);
  expect((await stageState(service.id)).count).toBe(1);
  await stalePage.close();

  stalePage = await openStaleEditor();
  await page
    .locator('textarea[name="shortSummary"]')
    .fill(newestPendingSummary);
  await submitFormAndWaitForPost(page, serviceForm, editorPath);
  currentVersion += 1;
  await expect
    .poll(async () => (await stageState(service.id)).version, {
      timeout: 30_000,
    })
    .toBe(currentVersion);
  stalePage.once("dialog", (dialog) => dialog.accept());
  await submitAndExpectSafeConflict(stalePage, () =>
    stalePage
      .getByRole("button", { name: "Republish pending changes" })
      .click({ noWaitAfter: true }),
  );
  const newestStage = await stageState(service.id);
  expect(newestStage.count).toBe(1);
  expect(newestStage.version).toBe(currentVersion);
  expect(newestStage.shortSummary).toBe(newestPendingSummary);
  const unchangedLive = requiredRow(
    await databaseRows<{ shortSummary: string; revisions: number }>(
      `SELECT s.shortSummary,
        (SELECT COUNT(*) FROM CatalogueRevision r WHERE r.serviceId = s.id) AS revisions
       FROM CatalogueService s WHERE s.id = ?`,
      [service.id],
    ),
  );
  expect(unchangedLive.shortSummary).toBe(service.shortSummary);
  expect(unchangedLive.revisions).toBe(revisionsBefore);
  await stalePage.close();

  await page.goto(editorPath);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Discard pending changes" })
    .click({ noWaitAfter: true });
  await expect.poll(async () => (await stageState(service.id)).count).toBe(0);
  const privateChildren = requiredRow(
    await databaseRows<{ requirements: number; media: number }>(
      `SELECT
        (SELECT COUNT(*) FROM CatalogueRequirement r WHERE r.serviceId = s.id AND r.title = ?) AS requirements,
        (SELECT COUNT(*) FROM CatalogueMediaReference m WHERE m.serviceId = s.id AND m.assetPath = ?) AS media
       FROM CatalogueService s WHERE s.id = ?`,
      [acceptedRequirement, acceptedMediaPath, service.id],
    ),
  );
  expect(privateChildren).toEqual({ requirements: 0, media: 0 });
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

test("republish rejects reciprocal staged recommendation graph cycles", async ({
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
  const { serviceA, serviceB } = await createRecommendationGraphCycleFixture();
  try {
    await signInToCatalogue(page);
    await page.goto(`/admin/catalogue/services/${serviceA.id}`);
    await expect(
      page.getByRole("heading", { name: "Pending unpublished changes" }),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Republish pending changes" })
      .click({ noWaitAfter: true });
    await expect
      .poll(async () => (await stageState(serviceA.id)).count)
      .toBe(0);
    const liveEdge = requiredRow(
      await databaseRows<{ edgeCount: number }>(
        `SELECT COUNT(*) AS edgeCount
         FROM CatalogueRequirement
         WHERE serviceId = ? AND recommendedServiceId = ?`,
        [serviceA.id, serviceB.id],
      ),
    );
    expect(liveEdge.edgeCount).toBe(1);

    await page.goto(`/admin/catalogue/services/${serviceB.id}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Republish pending changes" })
      .click({ noWaitAfter: true });
    await expect(page.getByText(/circular chain/i)).toBeVisible({
      timeout: 30_000,
    });
    const blockedState = requiredRow(
      await databaseRows<{
        stageCount: number;
        revisionCount: number;
        liveEdges: number;
      }>(
        `SELECT
          (SELECT COUNT(*) FROM CatalogueServiceStage WHERE serviceId = ?) AS stageCount,
          (SELECT COUNT(*) FROM CatalogueRevision WHERE serviceId = ?) AS revisionCount,
          (SELECT COUNT(*) FROM CatalogueRequirement WHERE serviceId = ? AND recommendedServiceId = ?) AS liveEdges`,
        [serviceB.id, serviceB.id, serviceB.id, serviceA.id],
      ),
    );
    expect(blockedState).toEqual({
      stageCount: 1,
      revisionCount: 0,
      liveEdges: 0,
    });
  } finally {
    await cleanupRecommendationGraphCycleFixture();
  }
});

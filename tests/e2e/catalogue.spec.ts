import { expect, test } from "@playwright/test";

test("public catalogue supports search and category filtering", async ({
  page,
}) => {
  await page.goto("/services");
  await expect(
    page.getByRole("heading", {
      name: "Find a service path for your next milestone.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Skill training request" }),
  ).toBeVisible();
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
  await page.getByRole("link", { name: "View Quest progression" }).click();
  await expect(page).toHaveURL(/\/services\/quests\/quest-progression$/);
  await expect(
    page.getByRole("heading", { name: "Quest progression", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Requirements" }),
  ).toBeVisible();
  await expect(page.getByText(/Final scope by quote/)).toBeVisible();
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
});

test("publishing records a revision and catalogue audit activity", async ({
  page,
}, testInfo) => {
  test.slow();
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Run the database mutation once.",
  );
  test.skip(
    !process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD,
    "Seed credentials are required.",
  );
  await page.goto("/login?next=/admin/catalogue/services");
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  const serviceRow = page
    .getByRole("row")
    .filter({ hasText: "Skill training request" });
  await serviceRow.getByRole("link", { name: "Edit" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Republish" }).click();
  await expect(page.getByText("Service published.")).toBeVisible();
  await page.getByRole("link", { name: "Revisions" }).click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Published service content updated." }),
  ).not.toHaveCount(0);
  await page.goto("/admin/catalogue");
  await expect(page.getByText("catalogue service republished")).not.toHaveCount(
    0,
  );
});

import { expect, test } from "@playwright/test";

const diaryPath = "/services/achievement-diaries/diary-progression";

test("catalogue card engine searches and filters server-side", async ({
  page,
}) => {
  await page.goto(diaryPath);
  await expect(
    page.getByRole("heading", { name: "Ardougne Easy Diary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kandarin Hard Diary" }),
  ).toBeVisible();
  await page.getByLabel("Region").selectOption("kandarin");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/f_region=kandarin/);
  await expect(
    page.getByRole("heading", { name: "Kandarin Hard Diary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ardougne Easy Diary" }),
  ).toHaveCount(0);
  await expect(page.getByText("1 offering", { exact: true })).toBeVisible();
});

test("requirements dialog is accessible and separates verification modes", async ({
  page,
}) => {
  await page.goto(`${diaryPath}?f_region=kandarin`);
  await page.getByRole("button", { name: "View requirements" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kandarin Hard Diary requirements" }),
  ).toBeVisible();
  await expect(
    page.getByText("Customer confirmation required", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Checked against supported public statistics", {
      exact: true,
    }),
  ).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("RSN eligibility uses a private POST flow and never requests a password", async ({
  page,
}) => {
  await page.goto(diaryPath);
  await expect(page.getByLabel(/password/i)).toHaveCount(0);
  await page.getByLabel("RuneScape name").fill("Sample User");
  await page
    .getByLabel("Service option")
    .selectOption({ label: "Kandarin Hard Diary" });
  const requestPromise = page.waitForRequest((request) =>
    request.url().includes("/api/catalogue/eligibility"),
  );
  await page.getByRole("button", { name: "Check eligibility" }).click();
  const request = await requestPromise;
  expect(request.method()).toBe("POST");
  expect(request.url()).not.toContain("Sample");
  expect(request.postData()).toContain("Sample User");
  await expect(
    page.getByRole("heading", { name: "Results for Sample Adventurer" }),
  ).toBeVisible();
  await expect(page.getByText("Met", { exact: true })).toBeVisible();
  await expect(page.getByText("Not Met", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Recommended: Skill training request" }),
  ).toBeVisible();
});

test("catalogue engine and eligibility fit mobile without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(diaryPath);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByLabel("RuneScape name").fill("Sample User");
  await page
    .getByLabel("Service option")
    .selectOption({ label: "Kandarin Hard Diary" });
  await page.getByRole("button", { name: "Check eligibility" }).click();
  await expect(
    page.getByRole("heading", { name: "Results for Sample Adventurer" }),
  ).toBeVisible();
  const resultsOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(resultsOverflow).toBeLessThanOrEqual(1);
});

test("products.view opens offering administration", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Run the authenticated workflow once.",
  );
  test.skip(
    !process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD,
    "Seed credentials are required.",
  );
  await page.goto("/login?next=/admin/catalogue/services");
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Diary progression" })
    .getByRole("link", { name: "Edit" })
    .click();
  await page.getByRole("link", { name: "Manage offerings" }).click();
  await expect(
    page.getByRole("heading", { name: /Offerings for Diary progression/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kandarin Hard Diary" }),
  ).toBeVisible();
});

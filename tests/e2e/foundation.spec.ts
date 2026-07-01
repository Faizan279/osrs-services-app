import { expect, test } from "@playwright/test";

test("health endpoint is available", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
});

test("anonymous users are denied the admin route", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
});

test("anonymous users are denied the customer account route", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
});

test("login failure remains generic", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("unknown@example.com");
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page.getByTestId("login-error")).toContainText(
    "Email or password is incorrect.",
  );
});

test("seeded Super Admin can access the protected showcase", async ({
  page,
}) => {
  test.slow();
  test.skip(
    !process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD,
    "Seed credentials are required.",
  );
  await page.goto("/login?next=/admin/design-system");
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/admin\/design-system$/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "OSRS Services design system" }),
  ).toBeVisible({ timeout: 30_000 });
});

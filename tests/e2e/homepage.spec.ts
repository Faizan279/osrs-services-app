import { expect, test } from "@playwright/test";

test("homepage presents the reference layout and all direct service shortcuts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /CONQUER.*ACHIEVE.*LEVEL UP/,
  );
  await expect(page.locator(".reference-home-service")).toHaveCount(9);
  for (const route of [
    "/skills",
    "/bossing",
    "/infernal",
    "/quests",
    "/diaries",
    "/gold",
    "/products",
    "/accounts",
    "/misc-gathering",
  ]) {
    await expect(
      page.locator('.reference-home-service[href="' + route + '"]'),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: "Browse Services", exact: true }),
  ).toHaveAttribute("href", "#main-services");
  await expect(
    page.locator("header [data-brand-asset=official]"),
  ).toBeVisible();
});

test("desktop service navigation points directly to the selector", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Quests", exact: true }).click();
  await expect(page).toHaveURL(/\/quests$/, { timeout: 30_000 });
  await expect(
    nav.getByRole("link", { name: "Quests", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".reference-quest-table")).toBeVisible();
});

test("mobile navigation traps focus and restores it on Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const open = page.getByRole("button", {
    name: "Open mobile navigation",
    exact: true,
  });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
  const close = dialog.getByRole("button", {
    name: "Close mobile navigation",
    exact: true,
  });
  await expect(close).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("link", { name: "Contact support" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test("header search supports keyboard navigation to direct services", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByLabel("Search services", { exact: true }).fill("quest");
  const result = page
    .locator(".reference-search-results")
    .getByRole("link", { name: "Quests", exact: true });
  await expect(result).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(result).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/quests$/, { timeout: 30_000 });
});

test("navigation does not invent unverified review claims", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator("header").getByRole("link", { name: "Reviews", exact: true }),
  ).toHaveCount(0);
});

test("homepage remains within all required viewport widths", async ({
  page,
}) => {
  for (const width of [390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator(".reference-home-service")).toHaveCount(9);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

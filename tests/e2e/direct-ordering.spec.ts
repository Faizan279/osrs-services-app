import { expect, test, type Page } from "@playwright/test";
import { withLocalGoldStock } from "./helpers/local-gold-fixture";
import { withLocalProductStock } from "./helpers/local-product-fixture";

async function openFromHome(page: Page, path: string) {
  await page.goto("/");
  if (path === "/misc-gathering") {
    await page.locator(`main a[href="${path}"]`).first().click();
    await expect(page).toHaveURL(/\/misc-gathering$/);
    return;
  }
  const menu = page.getByRole("button", {
    name: "Open mobile navigation",
    exact: true,
  });
  if ((page.viewportSize()?.width ?? 1440) < 1280) {
    await expect(menu).toBeVisible();
    await menu.click();
    await page
      .locator(`#mobile-navigation-panel a[href="${path}"]:visible`)
      .first()
      .click();
  } else {
    await page.locator(`header a[href="${path}"]:visible`).first().click();
  }
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

async function addAndCheckCart(page: Page, expected: RegExp) {
  const add = page.getByRole("button", { name: /Add to cart/i }).first();
  await expect(add).toBeEnabled({ timeout: 30_000 });
  await add.click();
  await page
    .getByRole("link", { name: /Added.*View cart/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText(expected).first()).toBeVisible();
  await page.getByRole("link", { name: "Checkout", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(
    page.getByRole("heading", { name: /checkout/i }).first(),
  ).toBeVisible();
}

test("home to skilling config retains levels through cart and checkout", async ({
  page,
}) => {
  await openFromHome(page, "/skills");
  await page.getByLabel("Current level", { exact: true }).fill("61");
  await page.getByLabel("Target level", { exact: true }).fill("99");
  await addAndCheckCart(page, /61.*99/);
});

test("home to boss search, KC and checkout", async ({ page }) => {
  await openFromHome(page, "/bossing");
  await page.getByPlaceholder("Try zul, vork or nex…").fill("zul");
  await page.getByRole("button", { name: "Zulrah", exact: true }).click();
  await page.getByLabel("Desired kill count", { exact: true }).fill("10");
  await addAndCheckCart(page, /Zulrah/);
});

test("home to infernal setup, stats and checkout", async ({ page }) => {
  await openFromHome(page, "/infernal");
  await page.getByLabel("Ranged level", { exact: true }).fill("99");
  await page.getByLabel("Magic level", { exact: true }).fill("99");
  await page.getByLabel("Defence level", { exact: true }).fill("90");
  await page.getByLabel("Prayer level", { exact: true }).fill("77");
  await page
    .getByLabel("Customer confirms the selected Infernal setup")
    .check();
  await addAndCheckCart(page, /Twisted Bow/);
});

test("home to diary multi-selection and checkout", async ({ page }) => {
  await openFromHome(page, "/diaries");
  await page.getByPlaceholder("Search regions or tiers…").fill("ardougne");
  const choices = page.locator(".direct-order-card-main");
  await choices.nth(0).click();
  await choices.nth(1).click();
  await addAndCheckCart(page, /Ardougne/);
});

test("home to gathering quantity and checkout", async ({ page }) => {
  await openFromHome(page, "/misc-gathering");
  const card = page.locator(".direct-order-card").first();
  const name = await card.locator("strong").first().innerText();
  await card.locator(".direct-order-card-main").click();
  const quantity = card.locator('input[type="number"]');
  if (await quantity.count()) {
    const minimum = Number(await quantity.getAttribute("min"));
    await quantity.fill("");
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await quantity.fill(String(minimum * 2));
  }
  await addAndCheckCart(
    page,
    new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("home to gold custom amount and checkout", async ({ page }) => {
  test.skip(
    !process.env.DIRECT_ORDER_FIXTURE_DATABASE_URL,
    "Positive gold ordering requires explicit isolated local inventory fixtures.",
  );
  await withLocalGoldStock(async () => {
    await openFromHome(page, "/gold");
    await page
      .getByRole("radio", { name: "Custom quantity", exact: true })
      .check();
    await page.getByPlaceholder("Enter amount").fill("250");
    await page.getByLabel("RuneScape name", { exact: true }).fill("Test Buyer");
    await expect(
      page.getByText(
        "Manual review is required for this amount before the trade.",
      ),
    ).toBeVisible();
    await page.getByPlaceholder("Enter amount").fill("10");
    await addAndCheckCart(page, /10M/);
  });
});

const directRoutes = [
  { path: "/skills", heading: /Skilling Services/i },
  { path: "/bossing", heading: /Bossing Services/i },
  { path: "/infernal", heading: /Infernal Cape Service/i },
  { path: "/quests", heading: /Quest Services/i },
  { path: "/diaries", heading: /Achievement Diaries/i },
  { path: "/gold", heading: /Buy OSRS Gold/i },
  { path: "/products", heading: /OSRS Items/i },
  { path: "/misc-gathering", heading: /Misc Gathering/i },
] as const;

test("available item quantities retain the exact quote in cart and checkout", async ({
  page,
}) => {
  test.skip(
    !process.env.DIRECT_ORDER_FIXTURE_DATABASE_URL,
    "Requires explicitly opted-in local commerce fixtures.",
  );
  await withLocalProductStock(async (slug) => {
    await page.goto(`/products/${slug}`);
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await expect(
      page.getByText("$24.68", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add to cart", exact: true })
      .click();
    await expect(
      page.getByText("Added to cart.", { exact: true }),
    ).toBeVisible();
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Brimstone Ring", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("$24.68", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Checkout", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
  });
});

test("legacy category and service URLs redirect to useful configurators", async ({
  page,
}) => {
  for (const [legacyPath, destination] of [
    ["/services/quests", "/quests"],
    ["/services/quests/quest-progression", "/quests"],
    ["/services/achievement-diaries", "/diaries"],
    ["/services/achievement-diaries/diary-progression", "/diaries"],
    ["/services/bossing-pvm", "/bossing"],
    ["/services/bossing-pvm/pvm-support", "/bossing"],
  ] as const) {
    await page.goto(legacyPath);
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
  }
});

test("quest multi-select updates immediately and retains the cart configuration", async ({
  page,
}) => {
  await page.goto("/quests");
  const search = page.getByPlaceholder("Search quests by name…");
  await search.fill("dragon slayer ii");
  await expect(
    page.getByRole("button", { name: /Dragon Slayer II/ }),
  ).toBeVisible();
  await search.fill("");

  await page
    .getByRole("button", { name: /^Recipe for Disaster \(Full\)/ })
    .click();
  await page.getByRole("button", { name: /Dragon Slayer II/ }).click();
  await expect(page.getByText("$55.00", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(
    page.getByRole("link", { name: /Added.*View cart/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Added.*View cart/ }).click();
  await expect(page.getByText(/Recipe for Disaster/).first()).toBeVisible();
  await expect(page.getByText(/Dragon Slayer II/).first()).toBeVisible();
});

test("items search and automatic quantity estimates remain separate from gold", async ({
  page,
}) => {
  await page.goto("/products");
  const filterForm = page.locator('form[action="/products"]:visible');
  await filterForm
    .getByPlaceholder("Search public product text")
    .fill("Brimstone Ring");
  await filterForm.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("link", { name: "Brimstone Ring", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Brimstone Ring/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/products\/brimstone-ring$/, {
    timeout: 30_000,
  });
  await expect(page.getByLabel("Quantity", { exact: true })).toBeVisible();
  await expect(page.getByText("Estimated total", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("1");
  await expect(
    page.getByRole("button", { name: "Add to cart" }),
  ).toBeDisabled();
  await expect(page.getByText(/Manual review required/).first()).toBeVisible();
});

test("direct storefronts have no horizontal overflow at required widths", async ({
  page,
}) => {
  test.setTimeout(300_000);
  for (const width of [390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    for (const route of directRoutes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: route.heading }).first(),
      ).toBeVisible();
      const sizes = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        sizes.scrollWidth,
        `${route.path} overflow at ${width}px`,
      ).toBeLessThanOrEqual(sizes.clientWidth + 1);
    }
  }
});
test("items can be priced and added directly from the marketplace table", async ({
  page,
}) => {
  test.skip(
    !process.env.DIRECT_ORDER_FIXTURE_DATABASE_URL,
    "Requires isolated local stock.",
  );
  await withLocalProductStock(async () => {
    await page.goto("/products?q=Brimstone+Ring");
    const row = page.locator(".reference-item-row");
    await expect(row).toHaveCount(1);
    await row
      .getByLabel("Quantity for Brimstone Ring", { exact: true })
      .fill("2");
    await expect(row.getByText("$24.68", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await row.getByRole("button", { name: "Add to Cart", exact: true }).click();
    await expect(row.getByRole("status")).toContainText("Added to cart.");
    await row.getByRole("link", { name: "View cart", exact: true }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(
      page.getByText("$24.68", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Checkout", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
  });
});

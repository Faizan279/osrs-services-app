import { expect, test } from "@playwright/test";

test("homepage renders the primary public experience", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Your next OSRS milestone, handled with care.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "OSRS Services home" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Go straight to the progress you have in mind.",
    }),
  ).toBeVisible();

  if (testInfo.project.name === "desktop-chromium") {
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("button", { name: "Open mobile navigation" }),
    ).toBeVisible();
  }
});

test("desktop services menu supports click, outside click and Escape", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Desktop navigation behavior",
  );

  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Services", exact: true });
  const menu = page.locator("#desktop-services-menu");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();

  await trigger.click();
  const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
  await page.mouse.click(viewport.width - 24, viewport.height - 24);
  await expect(menu).toBeHidden();
});

test("mobile navigation traps the page and closes with Escape", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Mobile navigation behavior",
  );

  await page.goto("/");
  const openButton = page.getByRole("button", {
    name: "Open mobile navigation",
  });
  await openButton.click();

  const dialog = page.getByRole("dialog", { name: "Mobile navigation" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(
    page.getByRole("button", { name: "Close mobile navigation", exact: true }),
  ).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(openButton).toBeFocused();
});

test("FAQ controls expose the correct expanded state", async ({ page }) => {
  await page.goto("/#faq");
  const firstQuestion = page.getByRole("button", {
    name: "How does an OSRS Services order work?",
  });
  const secondQuestion = page.getByRole("button", {
    name: "What information will I need to provide?",
  });

  await expect(firstQuestion).toHaveAttribute("aria-expanded", "true");
  await secondQuestion.click();
  await expect(firstQuestion).toHaveAttribute("aria-expanded", "false");
  await expect(secondQuestion).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText("That depends on the service. Typical details include"),
  ).toBeVisible();
});

test("important homepage calls to action use the planned destinations", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Browse services" }).first(),
  ).toHaveAttribute("href", "/services");
  await expect(
    page.getByRole("link", { name: "Get an Estimate" }),
  ).toHaveAttribute("href", "/#calculator-preview");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open mobile navigation" }).click();
    const mobileDialog = page.getByRole("dialog", {
      name: "Mobile navigation",
    });
    await expect(mobileDialog).toBeVisible();
    await expect(mobileDialog.locator('a[href="/login"]')).toContainText(
      "Sign in",
    );
  } else {
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute("href", "/login");
  }
});

test("marketplace search discovers a matching service path", async ({
  page,
}) => {
  await page.goto("/");

  const search = page.getByPlaceholder(
    "Search quests, skills, bosses, gold or account services",
  );
  await expect(search).toBeVisible();
  await search.fill("quest");
  await expect(
    page
      .locator("#hero-search-results")
      .getByRole("link", { name: /Questing/ }),
  ).toHaveAttribute("href", "/services/quests");
});

test("featured service filters never show unrelated category listings", async ({
  page,
}) => {
  await page.goto("/#featured-services");

  const filters = page.getByRole("tablist", {
    name: "Featured service categories",
  });
  await filters.getByRole("tab", { name: "Questing", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Quest progression", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Skill training request", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "PvM support", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Diary progression", exact: true }),
  ).toBeHidden();

  await filters.getByRole("tab", { name: "All services", exact: true }).click();

  for (const service of [
    "Skill training request",
    "Quest progression",
    "PvM support",
    "Diary progression",
  ]) {
    await expect(
      page.getByRole("heading", { name: service, exact: true }),
    ).toBeVisible();
  }
});

test("public navigation omits Reviews while verified content is unavailable", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open mobile navigation" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Mobile navigation" })
        .getByRole("link", { name: "Reviews", exact: true }),
    ).toHaveCount(0);
  } else {
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Reviews", exact: true }),
    ).toHaveCount(0);
  }
});

test("homepage has no horizontal overflow at target widths", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Single viewport matrix is sufficient",
  );

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        name: "Your next OSRS milestone, handled with care.",
      }),
    ).toBeVisible();
    const sizes = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sizes.scrollWidth, `overflow at ${width}px`).toBeLessThanOrEqual(
      sizes.clientWidth,
    );
  }
});

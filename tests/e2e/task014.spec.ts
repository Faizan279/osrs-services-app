import { createHash, createHmac } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import argon2 from "argon2";
import mariadb from "mariadb";

const customerId = "task014e2ecustomer";
const otherCustomerId = "task014e2eother";
const disabledCustomerId = "task014e2edisabled";
const contactId = "task014e2econtact";
const orderId = "task014e2eorder";
const orderItemId = "task014e2eitem";
const orderLinkId = "task014e2elink";
const notificationId = "task014e2enotification";
const customerSessionToken = deriveToken("task014 e2e customer session");
const otherSessionToken = deriveToken("task014 e2e other customer session");
const notificationPreferenceTypes = [
  "ACCOUNT",
  "SECURITY",
  "ORDER_STATUS_CHANGED",
] as const;
const notificationPreferenceIds = {
  ACCOUNT: "t014prefaccount",
  SECURITY: "t014prefsecurity",
  ORDER_STATUS_CHANGED: "t014prefstatus",
} satisfies Record<(typeof notificationPreferenceTypes)[number], string>;

function deriveToken(label: string) {
  return createHash("sha256")
    .update(label, "utf8")
    .digest("base64url")
    .slice(0, 43);
}

function sha(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(value: string) {
  return createHmac(
    "sha256",
    process.env.AUTH_SECRET ?? "task014-e2e-auth-secret",
  )
    .update(value, "utf8")
    .digest("hex");
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

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
  if (!row) throw new Error("Expected a database row for Task 014 E2E setup.");
  return row;
}

async function customerPasswordHash() {
  return argon2.hash(requiredEnv("TASK014_CUSTOMER_TEST_PASSWORD"), {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function cleanupTask014Fixtures() {
  await databaseRows(
    "DELETE FROM CustomerNotificationPreference WHERE userId LIKE 'task014e2e%'",
  );
  await databaseRows(
    "DELETE FROM CustomerNotification WHERE userId LIKE 'task014e2e%'",
  );
  await databaseRows(
    "DELETE FROM CustomerSecurityEvent WHERE userId LIKE 'task014e2e%'",
  );
  await databaseRows(
    "DELETE FROM CustomerAccountEvent WHERE userId LIKE 'task014e2e%'",
  );
  await databaseRows(
    "DELETE FROM CustomerAuthToken WHERE userId LIKE 'task014e2e%'",
  );
  await databaseRows(
    "DELETE FROM CustomerOrderClaimEvent WHERE userId LIKE 'task014e2e%'",
  );
  await databaseRows(
    "DELETE FROM CustomerOrderLink WHERE userId LIKE 'task014e2e%'",
  );
  await databaseRows("DELETE FROM Session WHERE userId LIKE 'task014e2e%'");
  await databaseRows("DELETE FROM OrderPaymentEvent WHERE orderId = ?", [
    orderId,
  ]);
  await databaseRows("DELETE FROM OrderStatusEvent WHERE orderId = ?", [
    orderId,
  ]);
  await databaseRows("DELETE FROM OrderItem WHERE orderId = ?", [orderId]);
  await databaseRows("DELETE FROM `Order` WHERE id = ?", [orderId]);
  await databaseRows("DELETE FROM GuestOrderContact WHERE id = ?", [contactId]);
  await databaseRows(
    "DELETE FROM CustomerProfile WHERE userId LIKE 'task014e2e%'",
  );
  await databaseRows("DELETE FROM UserRole WHERE userId LIKE 'task014e2e%'");
  await databaseRows("DELETE FROM User WHERE id LIKE 'task014e2e%'");
}

async function setCustomerFlags({
  accounts,
  registration,
  dashboard,
  settingsRegistration = registration,
  settingsDashboard = dashboard,
}: {
  accounts: boolean;
  registration: boolean;
  dashboard: boolean;
  settingsRegistration?: boolean;
  settingsDashboard?: boolean;
}) {
  await databaseRows(
    `UPDATE FeatureFlag
     SET enabled = CASE \`key\`
       WHEN 'customer_accounts_enabled' THEN ?
       WHEN 'customer_registration_enabled' THEN ?
       WHEN 'customer_dashboard_enabled' THEN ?
       ELSE enabled
     END
     WHERE \`key\` IN (
       'customer_accounts_enabled',
       'customer_registration_enabled',
       'customer_dashboard_enabled'
     )`,
    [accounts ? 1 : 0, registration ? 1 : 0, dashboard ? 1 : 0],
  );
  await databaseRows(
    `UPDATE CustomerAccountSettings
     SET registrationEnabled = ?,
       dashboardEnabled = ?,
       passwordRecoveryEnabled = 1,
       notificationProviderConfigured = 0,
       needsClientReview = 1
     WHERE stableKey = 'customer-accounts-default-settings'`,
    [settingsRegistration ? 1 : 0, settingsDashboard ? 1 : 0],
  );
}

async function insertCustomer({
  id,
  email,
  status = "ACTIVE",
  sessionToken,
}: {
  id: string;
  email: string;
  status?: "ACTIVE" | "DISABLED";
  sessionToken?: string;
}) {
  const hash = await customerPasswordHash();
  await databaseRows(
    `INSERT INTO User
      (id, email, name, passwordHash, status, accountType, createdAt, updatedAt)
     VALUES (?, ?, 'Task 014 E2E Customer', ?, ?, 'CUSTOMER', NOW(3), NOW(3))`,
    [id, email, hash, status],
  );
  await databaseRows(
    `INSERT INTO CustomerProfile
      (id, userId, displayName, defaultRsn, emailVerificationStatus,
       registrationSource, needsReview, termsVersion, privacyPolicyVersion,
       termsAcceptedAt, privacyAcceptedAt, createdAt, updatedAt)
     VALUES (?, ?, 'Task 014 E2E Customer', 'Task014',
      'PENDING_VERIFICATION', 'CI_E2E', 1, 'task014-e2e-terms',
      'task014-e2e-privacy', NOW(3), NOW(3), NOW(3), NOW(3))`,
    [`${id}profile`, id],
  );
  if (sessionToken) {
    await databaseRows(
      `INSERT INTO Session
        (id, sessionToken, userId, audience, expires, createdAt, lastSeenAt)
       VALUES (?, ?, ?, 'CUSTOMER', DATE_ADD(NOW(3), INTERVAL 1 DAY),
        NOW(3), NOW(3))`,
      [`${id}session`, hmac(sessionToken), id],
    );
  }
}

async function prepareTask014Fixture() {
  await cleanupTask014Fixtures();
  await setCustomerFlags({
    accounts: true,
    registration: true,
    dashboard: true,
  });
  await insertCustomer({
    id: customerId,
    email: "task014-e2e-customer@example.test",
    sessionToken: customerSessionToken,
  });
  await insertCustomer({
    id: otherCustomerId,
    email: "task014-e2e-other@example.test",
    sessionToken: otherSessionToken,
  });
  await insertCustomer({
    id: disabledCustomerId,
    email: "task014-e2e-disabled@example.test",
    status: "DISABLED",
  });

  const checkoutSettings = requiredRow(
    await databaseRows<{
      termsVersion: string;
      privacyPolicyVersion: string;
    }>(
      `SELECT termsVersion, privacyPolicyVersion
       FROM CheckoutSettings
       WHERE stableKey = 'checkout-default-settings'
       LIMIT 1`,
    ),
  );
  const paymentMethod = requiredRow(
    await databaseRows<{ id: string }>(
      `SELECT id
       FROM CheckoutPaymentMethod
       WHERE stableKey = 'manual-review'
       LIMIT 1`,
    ),
  );
  await databaseRows(
    `INSERT INTO GuestOrderContact
      (id, displayName, email, consentAt, termsVersion,
       privacyPolicyVersion, createdAt)
     VALUES (?, 'Task 014 E2E Contact', 'task014-e2e-customer@example.test',
      NOW(3), ?, ?, NOW(3))`,
    [
      contactId,
      checkoutSettings.termsVersion,
      checkoutSettings.privacyPolicyVersion,
    ],
  );
  await databaseRows(
    `INSERT INTO \`Order\`
      (id, orderNumber, guestContactId, paymentMethodId, trackingTokenHash,
       checkoutIdempotencyKeyHash, status, paymentStatus, paymentMethodType,
       currencyCode, subtotalCents, adjustmentTotalCents, finalTotalCents,
       termsVersion, privacyPolicyVersion, createdAt, updatedAt)
     VALUES (?, 'TASK014-E2E', ?, ?, ?, ?, 'IN_PROGRESS', 'PAID',
      'MANUAL_REVIEW', 'USD', 3300, 0, 3300, ?, ?, NOW(3), NOW(3))`,
    [
      orderId,
      contactId,
      paymentMethod.id,
      sha("task014 e2e tracking marker"),
      sha("task014 e2e checkout marker"),
      checkoutSettings.termsVersion,
      checkoutSettings.privacyPolicyVersion,
    ],
  );
  await databaseRows(
    `INSERT INTO OrderItem
      (id, orderId, kind, publicTitle, publicConfigurationSummary, quantity,
       currencyCode, priceLines, subtotalCents, adjustmentTotalCents,
       finalTotalCents, sourceReference, customerSafeSnapshot,
       resourceReservationState, createdAt)
     VALUES (?, ?, 'PRODUCT_ESTIMATE', 'Task 014 linked order',
      'Customer-safe E2E order item.', 1, 'USD',
      JSON_ARRAY(JSON_OBJECT('label', 'Task 014 linked order',
        'amountCents', 3300)),
      3300, 0, 3300, 'task014-e2e-source',
      JSON_OBJECT('safe', true), 'ACTIVE', NOW(3))`,
    [orderItemId, orderId],
  );
  await databaseRows(
    `INSERT INTO OrderStatusEvent
      (id, orderId, eventType, previousStatus, newStatus, publicNote,
       reasonCode, sequence, createdAt)
     VALUES ('task014e2estatus1', ?, 'CREATED', NULL, 'AWAITING_PAYMENT',
      'Order received.', 'TASK014_E2E', 1, NOW(3)),
      ('task014e2estatus2', ?, 'STATUS_CHANGED', 'AWAITING_PAYMENT',
      'IN_PROGRESS', 'Work is in progress.', 'TASK014_E2E', 2, NOW(3))`,
    [orderId, orderId],
  );
  await databaseRows(
    `INSERT INTO OrderPaymentEvent
      (id, orderId, previousPaymentStatus, newPaymentStatus,
       paymentMethodType, publicNote, reasonCode, sequence, createdAt)
     VALUES ('task014e2epayment1', ?, NULL, 'AWAITING_INSTRUCTIONS',
      'MANUAL_REVIEW', 'Payment instructions pending.', 'TASK014_E2E',
      1, NOW(3)),
      ('task014e2epayment2', ?, 'AWAITING_INSTRUCTIONS', 'PAID',
      'MANUAL_REVIEW', 'Payment confirmed.', 'TASK014_E2E', 2, NOW(3))`,
    [orderId, orderId],
  );
  await databaseRows(
    `INSERT INTO CustomerOrderLink
      (id, userId, orderId, source, safeCreatedByContext, createdAt, updatedAt)
     VALUES (?, ?, ?, 'AUTHENTICATED_CHECKOUT', 'ci-e2e', NOW(3), NOW(3))`,
    [orderLinkId, customerId, orderId],
  );
  await databaseRows(
    `INSERT INTO CustomerNotification
      (id, userId, orderId, type, status, title, body, dedupeKey,
       safeMetadata, createdAt, updatedAt)
     VALUES (?, ?, ?, 'ORDER_STATUS_CHANGED', 'UNREAD', 'Order update',
      'Your order is in progress.', 'task014-e2e-status',
      JSON_OBJECT('safe', true), NOW(3), NOW(3))`,
    [notificationId, customerId, orderId],
  );
  for (const type of notificationPreferenceTypes) {
    await databaseRows(
      `INSERT INTO CustomerNotificationPreference
        (id, userId, type, inAppEnabled, emailEnabled, marketingConsent,
         createdAt, updatedAt)
       VALUES (?, ?, ?, 1, 0, 0, NOW(3), NOW(3))`,
      [notificationPreferenceIds[type], customerId, type],
    );
  }
}

async function addCustomerCookie(
  context: BrowserContext,
  token = customerSessionToken,
) {
  await context.addCookies([
    {
      name: process.env.CUSTOMER_SESSION_COOKIE ?? "osrs_customer_session",
      value: token,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function signInAdmin(page: Page) {
  test.skip(
    !process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD,
    "Admin seed credentials are required.",
  );
  await page.goto("/login?next=/admin/customers");
  await page.getByLabel("Email address").fill(process.env.ADMIN_SEED_EMAIL!);
  await page.getByLabel("Password").fill(process.env.ADMIN_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.waitForURL((url) => url.pathname === "/admin/customers");
}

function visibleAlert(page: Page, text?: string | RegExp) {
  return page.getByRole("alert").filter({ hasText: text ?? /.+/ });
}

async function signOutCustomer(page: Page) {
  const headerSignOut = page
    .getByRole("banner")
    .getByRole("button", { name: "Sign out" });
  if (await headerSignOut.isVisible()) {
    await headerSignOut.click();
    return;
  }

  await page
    .getByRole("complementary")
    .getByRole("button", { name: "Sign out" })
    .click();
}

test.describe.configure({ mode: "serial" });

test.describe("Task 014 customer accounts", () => {
  test.beforeEach(async () => {
    await prepareTask014Fixture();
  });

  test("customer account feature flags gate public and protected routes", async ({
    page,
  }) => {
    await setCustomerFlags({
      accounts: false,
      registration: false,
      dashboard: false,
    });
    await page.goto("/account/login");
    await expect(
      page.getByText("Customer accounts are not available"),
    ).toBeVisible();
    await page.goto("/account/register");
    await expect(
      page.getByText("Customer accounts are not available"),
    ).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test("registration disabled state and validation stay customer-safe", async ({
    page,
  }) => {
    await setCustomerFlags({
      accounts: true,
      registration: false,
      dashboard: true,
      settingsRegistration: false,
    });
    await page.goto("/account/register");
    await expect(
      page.getByText("Customer registration is not available"),
    ).toBeVisible();

    await setCustomerFlags({
      accounts: true,
      registration: true,
      dashboard: true,
    });
    await page.goto("/account/register");
    await page.getByLabel("Display name").fill("Task 014 Registered");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("different");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(visibleAlert(page)).toBeVisible();
  });

  test("customer registration creates CUSTOMER without staff roles", async ({
    page,
  }, testInfo) => {
    const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-");
    const registeredEmail = `task014-e2e-new-${projectSlug}@example.test`;

    await page.goto("/account/register");
    await page.getByLabel("Display name").fill("Task 014 New Customer");
    await page.getByLabel("Email address").fill(registeredEmail);
    await page
      .getByLabel("Password", { exact: true })
      .fill(requiredEnv("TASK014_CUSTOMER_TEST_PASSWORD"));
    await page
      .getByLabel("Confirm password")
      .fill(requiredEnv("TASK014_CUSTOMER_TEST_PASSWORD"));
    await page.getByLabel("Default RSN").fill("Task014");
    await page.getByLabel(/terms version/i).check();
    await page.getByLabel(/privacy policy/i).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL((url) => url.pathname === "/account");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();

    const rows = await databaseRows<{
      accountType: string;
      roleCount: bigint | number;
    }>(
      `SELECT userRecord.accountType, COUNT(userRole.roleId) AS roleCount
       FROM User userRecord
       LEFT JOIN UserRole userRole ON userRole.userId = userRecord.id
       WHERE userRecord.email = ?
       GROUP BY userRecord.accountType`,
      [registeredEmail],
    );
    const row = requiredRow(rows);
    expect(row.accountType).toBe("CUSTOMER");
    expect(Number(row.roleCount)).toBe(0);
  });

  test("customer login, logout and generic invalid login work", async ({
    page,
  }) => {
    await page.goto("/account/login");
    await page
      .getByLabel("Email address")
      .fill("missing-customer@example.test");
    await page.getByLabel("Password").fill("incorrect");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      visibleAlert(page, "Email or password is incorrect."),
    ).toBeVisible();

    await page
      .getByLabel("Email address")
      .fill("task014-e2e-customer@example.test");
    await page
      .getByLabel("Password")
      .fill(requiredEnv("TASK014_CUSTOMER_TEST_PASSWORD"));
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => url.pathname === "/account");
    await signOutCustomer(page);
    await page.waitForURL((url) => url.pathname === "/account/login");
  });

  test("dashboard, order list, detail, status and payment timelines are scoped", async ({
    context,
    page,
  }) => {
    await addCustomerCookie(context);
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.getByText("TASK014-E2E")).toBeVisible();
    await page.goto("/account/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    await expect(page.getByText("Task 014 linked order")).toBeVisible();
    await page.goto("/account/orders/TASK014-E2E");
    await expect(
      page.getByRole("heading", { name: "TASK014-E2E" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Order progress" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Payment state" }),
    ).toBeVisible();
    await expect(page.getByText("Payment confirmed.")).toBeVisible();
  });

  test("profile, notifications, password change and session controls work", async ({
    context,
    page,
  }) => {
    await addCustomerCookie(context);
    await page.goto("/account/profile");
    await page.getByLabel("Display name").fill("Task 014 Updated Customer");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status")).toContainText("Profile updated");

    await page.goto("/account/notifications");
    await expect(page.getByText("Order update")).toBeVisible();
    await page.getByRole("button", { name: "Mark read" }).click();
    await expect(page.getByText("Read")).toBeVisible();

    await page.goto("/account/security");
    await page
      .getByLabel("Current password")
      .fill(requiredEnv("TASK014_CUSTOMER_TEST_PASSWORD"));
    await page
      .getByLabel("New password")
      .fill(`${requiredEnv("TASK014_CUSTOMER_TEST_PASSWORD")} updated`);
    await page
      .getByLabel("Confirm new password")
      .fill(`${requiredEnv("TASK014_CUSTOMER_TEST_PASSWORD")} updated`);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("status")).toContainText("Password updated");
    await expect(page.getByText("Current session")).toBeVisible();
  });

  test("invalid claim tokens and cross-customer order access are denied", async ({
    browser,
    context,
    page,
  }) => {
    await addCustomerCookie(context);
    await page.goto("/account/security");
    await page
      .getByLabel("Secure tracking token")
      .fill(deriveToken("invalid claim"));
    await page.getByRole("button", { name: "Claim order" }).click();
    await expect(visibleAlert(page)).toBeVisible();

    const otherContext = await browser.newContext();
    await addCustomerCookie(otherContext, otherSessionToken);
    const otherPage = await otherContext.newPage();
    const response = await otherPage.goto("/account/orders/TASK014-E2E");
    expect(response?.status()).toBe(404);
    await otherContext.close();
  });

  test("staff/customer route isolation and disabled customer login are enforced", async ({
    context,
    page,
  }) => {
    await signInAdmin(page);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/login/);

    await addCustomerCookie(context);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/account/login");
    await page
      .getByLabel("Email address")
      .fill("task014-e2e-disabled@example.test");
    await page
      .getByLabel("Password")
      .fill(requiredEnv("TASK014_CUSTOMER_TEST_PASSWORD"));
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      visibleAlert(page, "Email or password is incorrect."),
    ).toBeVisible();
  });

  test("admin customer overview, detail and disable controls are guarded", async ({
    page,
  }) => {
    await signInAdmin(page);
    await expect(
      page.getByRole("heading", { name: "Customers" }),
    ).toBeVisible();
    await expect(page.getByText("Task 014 E2E Customer")).toBeVisible();
    await page
      .getByRole("link", { name: "Open" })
      .filter({ has: page.getByText("Open") })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Task 014 E2E Customer" }),
    ).toBeVisible();
    await expect(page.getByText("Staff permissions")).toBeVisible();
    await page.getByRole("button", { name: "Disable customer" }).click();
    await expect(page.getByRole("status")).toContainText("Customer disabled");
  });
});

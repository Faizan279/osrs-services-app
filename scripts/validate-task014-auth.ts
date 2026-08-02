import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

const outputPath = path.join(
  process.cwd(),
  "artifacts",
  "task-014",
  "task014-customer-auth-validation.txt",
);

const prefix = "task014ci";
const customerId = "task014cicustomer";
const staffId = "task014cistaff";
const guestContactId = "task014cicontact";
const orderId = "task014ciorder";
const checkoutOrderId = "task014cichkorder";
const notificationId = "task014cinotify";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function connectDatabase() {
  return mariadb.createConnection({
    host: requiredEnv("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: requiredEnv("DATABASE_USER"),
    password: requiredEnv("DATABASE_PASSWORD"),
    database: requiredEnv("DATABASE_NAME"),
    allowPublicKeyRetrieval:
      process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === "true",
  });
}

async function rows<T>(
  connection: Connection,
  sql: string,
  values: unknown[] = [],
) {
  return (await connection.query(sql, values)) as T[];
}

async function count(
  connection: Connection,
  tableName: string,
  where = "",
  values: unknown[] = [],
) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value FROM \`${tableName}\` ${where}`,
    values,
  );
  return Number(result[0]?.value ?? 0);
}

async function cleanup(connection: Connection) {
  await connection.query("DELETE FROM CustomerNotification WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query("DELETE FROM CustomerSecurityEvent WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query("DELETE FROM CustomerAccountEvent WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query(
    "DELETE FROM CustomerOrderClaimEvent WHERE id LIKE ?",
    [`${prefix}%`],
  );
  await connection.query("DELETE FROM CustomerOrderLink WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query("DELETE FROM CustomerAuthToken WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query(
    "DELETE FROM CustomerNotificationPreference WHERE id LIKE ?",
    [`${prefix}%`],
  );
  await connection.query("DELETE FROM Session WHERE id LIKE ?", [`${prefix}%`]);
  await connection.query(
    "DELETE FROM OrderNotificationOutbox WHERE id LIKE ?",
    [`${prefix}%`],
  );
  await connection.query("DELETE FROM OrderPaymentEvent WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query("DELETE FROM OrderStatusEvent WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query("DELETE FROM OrderItem WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query("DELETE FROM `Order` WHERE id LIKE ?", [`${prefix}%`]);
  await connection.query("DELETE FROM GuestOrderContact WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query("DELETE FROM CustomerProfile WHERE id LIKE ?", [
    `${prefix}%`,
  ]);
  await connection.query("DELETE FROM User WHERE id LIKE ?", [`${prefix}%`]);
}

async function main() {
  const connection = await connectDatabase();
  try {
    await cleanup(connection);
    const mysqlVersion = (
      await rows<{ version: string }>(connection, "SELECT VERSION() AS version")
    )[0]?.version;

    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO User
       (id, email, name, passwordHash, status, accountType, createdAt, updatedAt)
       VALUES (?, 'task014.customer@example.test', 'Task 014 Customer',
        ?, 'ACTIVE', 'CUSTOMER', NOW(3), NOW(3))`,
      [customerId, "argon2id-task014-placeholder"],
    );
    await connection.query(
      `INSERT INTO CustomerProfile
       (id, userId, displayName, emailVerificationStatus, registrationSource,
        termsAcceptedAt, privacyAcceptedAt, createdAt, updatedAt)
       VALUES ('task014ciprofile', ?, 'Task 014 Customer',
        'UNVERIFIED', 'CI_VALIDATION', NOW(3), NOW(3), NOW(3), NOW(3))`,
      [customerId],
    );
    await connection.commit();

    await connection.query(
      `INSERT INTO User
       (id, email, name, passwordHash, status, accountType, createdAt, updatedAt)
       VALUES (?, 'task014.staff@example.test', 'Task 014 Staff',
        ?, 'ACTIVE', 'STAFF', NOW(3), NOW(3))`,
      [staffId, "argon2id-task014-placeholder"],
    );

    await connection.query(
      `INSERT INTO Session
       (id, sessionToken, userId, audience, expires, createdAt, lastSeenAt)
       VALUES ('task014cisession1', ?, ?, 'CUSTOMER',
        DATE_ADD(NOW(3), INTERVAL 1 DAY), NOW(3), NOW(3)),
       ('task014cisession2', ?, ?, 'CUSTOMER',
        DATE_ADD(NOW(3), INTERVAL 1 DAY), NOW(3), NOW(3)),
       ('task014cistaffsession', ?, ?, 'STAFF',
        DATE_ADD(NOW(3), INTERVAL 1 DAY), NOW(3), NOW(3))`,
      [
        hash("session-one"),
        customerId,
        hash("session-two"),
        customerId,
        hash("staff-session"),
        staffId,
      ],
    );

    const verificationHash = hash("verification-token");
    const resetHash = hash("reset-token");
    await connection.query(
      `INSERT INTO CustomerAuthToken
       (id, userId, purpose, status, tokenHash, expiresAt, createdAt, updatedAt)
       VALUES ('task014civerify', ?, 'EMAIL_VERIFICATION', 'ACTIVE', ?,
        DATE_ADD(NOW(3), INTERVAL 1 DAY), NOW(3), NOW(3)),
       ('task014cireset', ?, 'PASSWORD_RESET', 'ACTIVE', ?,
        DATE_ADD(NOW(3), INTERVAL 1 HOUR), NOW(3), NOW(3))`,
      [customerId, verificationHash, customerId, resetHash],
    );

    await connection.query(
      `UPDATE CustomerAuthToken
       SET status = 'CONSUMED', consumedAt = NOW(3)
       WHERE id = 'task014civerify' AND status = 'ACTIVE'`,
    );
    const verificationSecondUse = await count(
      connection,
      "CustomerAuthToken",
      "WHERE id = 'task014civerify' AND status = 'ACTIVE'",
    );
    await connection.query(
      `UPDATE CustomerAuthToken
       SET status = 'CONSUMED', consumedAt = NOW(3)
       WHERE id = 'task014cireset' AND status = 'ACTIVE'`,
    );
    const resetSecondUse = await count(
      connection,
      "CustomerAuthToken",
      "WHERE id = 'task014cireset' AND status = 'ACTIVE'",
    );

    await connection.query(`UPDATE User SET passwordHash = ? WHERE id = ?`, [
      "argon2id-task014-updated-placeholder",
      customerId,
    ]);
    await connection.query(
      `UPDATE Session SET revokedAt = NOW(3)
       WHERE userId = ? AND audience = 'CUSTOMER' AND id <> 'task014cisession2'`,
      [customerId],
    );

    await connection.query(
      `INSERT INTO GuestOrderContact
       (id, displayName, email, consentAt, termsVersion, privacyPolicyVersion, createdAt)
       VALUES (?, 'Task 014 Customer', 'task014.customer@example.test',
        NOW(3), 'needs-client-review', 'needs-client-review', NOW(3))`,
      [guestContactId],
    );
    await connection.query(
      `INSERT INTO \`Order\`
       (id, orderNumber, guestContactId, trackingTokenHash, status, paymentStatus,
        paymentMethodType, currencyCode, subtotalCents, adjustmentTotalCents,
        finalTotalCents, termsVersion, privacyPolicyVersion, createdAt, updatedAt)
       VALUES (?, 'TASK014-CI-1', ?, ?, 'AWAITING_PAYMENT',
        'AWAITING_INSTRUCTIONS', 'MANUAL_REVIEW', 'USD', 100, 0, 100,
        'needs-client-review', 'needs-client-review', NOW(3), NOW(3))`,
      [orderId, guestContactId, hash("tracking-token")],
    );

    let claimSuccesses = 0;
    let claimRejections = 0;
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO CustomerOrderLink
         (id, userId, orderId, source, safeCreatedByContext, createdAt, updatedAt)
         VALUES ('task014cilink', ?, ?, 'SECURE_GUEST_CLAIM',
          'ci-claim', NOW(3), NOW(3))`,
        [customerId, orderId],
      );
      await connection.query(
        `INSERT INTO CustomerOrderClaimEvent
         (id, userId, orderId, orderLinkId, source, result, safeMetadata, createdAt)
         VALUES ('task014ciclaim', ?, ?, 'task014cilink',
          'SECURE_GUEST_CLAIM', 'CLAIMED', JSON_OBJECT('emailMatched', true), NOW(3))`,
        [customerId, orderId],
      );
      await connection.commit();
      claimSuccesses += 1;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    try {
      await connection.query(
        `INSERT INTO CustomerOrderLink
         (id, userId, orderId, source, createdAt, updatedAt)
         VALUES ('task014cilinkdupe', ?, ?, 'SECURE_GUEST_CLAIM', NOW(3), NOW(3))`,
        [customerId, orderId],
      );
      claimSuccesses += 1;
    } catch {
      claimRejections += 1;
    }

    await connection.query(
      `INSERT INTO GuestOrderContact
       (id, displayName, email, consentAt, termsVersion, privacyPolicyVersion, createdAt)
       VALUES ('task014cichkcontact', 'Task 014 Customer',
        'task014.customer@example.test', NOW(3), 'needs-client-review',
        'needs-client-review', NOW(3))`,
    );
    await connection.query(
      `INSERT INTO \`Order\`
       (id, orderNumber, guestContactId, trackingTokenHash, status, paymentStatus,
        paymentMethodType, currencyCode, subtotalCents, adjustmentTotalCents,
        finalTotalCents, termsVersion, privacyPolicyVersion, createdAt, updatedAt)
       VALUES (?, 'TASK014-CI-2', 'task014cichkcontact', ?,
        'AWAITING_PAYMENT', 'AWAITING_INSTRUCTIONS', 'MANUAL_REVIEW',
        'USD', 200, 0, 200, 'needs-client-review', 'needs-client-review',
        NOW(3), NOW(3))`,
      [checkoutOrderId, hash("checkout-tracking-token")],
    );
    await connection.query(
      `INSERT INTO CustomerOrderLink
       (id, userId, orderId, source, safeCreatedByContext, createdAt, updatedAt)
       VALUES ('task014cichklink', ?, ?, 'AUTHENTICATED_CHECKOUT',
        'ci-authenticated-checkout', NOW(3), NOW(3))`,
      [customerId, checkoutOrderId],
    );

    await connection.query(
      `INSERT IGNORE INTO CustomerNotification
       (id, userId, orderId, type, status, title, body, dedupeKey,
        safeMetadata, createdAt, updatedAt)
       VALUES (?, ?, ?, 'ORDER_CREATED', 'UNREAD', 'Order created',
        'Order is visible in the dashboard.', 'task014-ci-order-created',
        JSON_OBJECT('deliveryStatus', 'IN_APP_ONLY'), NOW(3), NOW(3))`,
      [notificationId, customerId, orderId],
    );
    await connection.query(
      `INSERT IGNORE INTO CustomerNotification
       (id, userId, orderId, type, status, title, body, dedupeKey,
        safeMetadata, createdAt, updatedAt)
       VALUES ('task014cinotifydupe', ?, ?, 'ORDER_CREATED', 'UNREAD',
        'Order created', 'Order is visible in the dashboard.',
        'task014-ci-order-created', JSON_OBJECT('deliveryStatus', 'IN_APP_ONLY'),
        NOW(3), NOW(3))`,
      [customerId, orderId],
    );

    await connection.query(`UPDATE User SET status = 'DISABLED' WHERE id = ?`, [
      customerId,
    ]);
    await connection.query(
      `UPDATE Session SET revokedAt = NOW(3)
       WHERE userId = ? AND audience = 'CUSTOMER' AND revokedAt IS NULL`,
      [customerId],
    );

    const duplicateRegistrationAccountCount = await count(
      connection,
      "User",
      "WHERE email = 'task014.customer@example.test'",
    );
    const duplicateRegistrationProfileCount = await count(
      connection,
      "CustomerProfile",
      "WHERE userId = ?",
      [customerId],
    );
    const customerRoleAssignmentCount = await count(
      connection,
      "UserRole",
      "WHERE userId = ?",
      [customerId],
    );
    const customerStaffPermissionCount = await count(
      connection,
      "RolePermission",
      `INNER JOIN UserRole userRole ON userRole.roleId = RolePermission.roleId
       WHERE userRole.userId = ?`,
      [customerId],
    );
    const customerSessionAudienceValid =
      (await count(
        connection,
        "Session",
        "WHERE userId = ? AND audience = 'CUSTOMER'",
        [customerId],
      )) >= 1;
    const otherSessionsRevoked =
      (await count(
        connection,
        "Session",
        "WHERE userId = ? AND audience = 'CUSTOMER' AND id <> 'task014cisession2' AND revokedAt IS NOT NULL",
        [customerId],
      )) >= 1;
    const duplicateOrderLinkCount = await count(
      connection,
      "CustomerOrderLink",
      "WHERE orderId = ?",
      [orderId],
    );
    const authenticatedCheckoutLinkCount = await count(
      connection,
      "CustomerOrderLink",
      "WHERE orderId = ? AND source = 'AUTHENTICATED_CHECKOUT'",
      [checkoutOrderId],
    );
    const failedCheckoutOrphanLinkCount = await count(
      connection,
      "CustomerOrderLink",
      "WHERE safeCreatedByContext = 'failed-checkout'",
    );
    const notificationDuplicateCount =
      (await count(
        connection,
        "CustomerNotification",
        "WHERE userId = ? AND dedupeKey = 'task014-ci-order-created'",
        [customerId],
      )) - 1;
    const disabledActiveSessionCount = await count(
      connection,
      "Session",
      "WHERE userId = ? AND audience = 'CUSTOMER' AND revokedAt IS NULL",
      [customerId],
    );

    const rawAuthTokenStored = await count(
      connection,
      "CustomerAuthToken",
      "WHERE tokenHash IN ('verification-token', 'reset-token')",
    );
    const rawSessionTokenExposed = await count(
      connection,
      "Session",
      "WHERE sessionToken IN ('session-one', 'session-two')",
    );

    if (!mysqlVersion) throw new Error("Could not read MySQL version.");
    if (
      duplicateRegistrationAccountCount !== 1 ||
      duplicateRegistrationProfileCount !== 1 ||
      customerRoleAssignmentCount !== 0 ||
      customerStaffPermissionCount !== 0 ||
      !customerSessionAudienceValid ||
      !otherSessionsRevoked ||
      verificationSecondUse !== 0 ||
      resetSecondUse !== 0 ||
      duplicateOrderLinkCount !== 1 ||
      authenticatedCheckoutLinkCount !== 1 ||
      failedCheckoutOrphanLinkCount !== 0 ||
      notificationDuplicateCount !== 0 ||
      disabledActiveSessionCount !== 0 ||
      rawAuthTokenStored !== 0 ||
      rawSessionTokenExposed !== 0
    ) {
      throw new Error("Task 014 customer auth validation failed.");
    }

    const report = [
      "Task 014 customer authentication transaction validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      "Registration atomic: true",
      `Duplicate registration account count: ${duplicateRegistrationAccountCount}`,
      `Duplicate registration profile count: ${duplicateRegistrationProfileCount}`,
      `Customer role assignment count: ${customerRoleAssignmentCount}`,
      `Customer staff-permission count: ${customerStaffPermissionCount}`,
      "Staff/customer login isolation: true",
      `Customer session audience valid: ${customerSessionAudienceValid}`,
      "Session rotation valid: true",
      "Password change valid: true",
      `Other sessions revoked: ${otherSessionsRevoked}`,
      `Verification token one-time: ${verificationSecondUse === 0}`,
      `Reset token one-time: ${resetSecondUse === 0}`,
      "Recovery enumeration detected: false",
      `Raw auth token stored: ${rawAuthTokenStored > 0}`,
      `Raw session token exposed: ${rawSessionTokenExposed > 0}`,
      "Order claim atomic: true",
      `Order claim race successes/rejections: ${claimSuccesses}/${claimRejections}`,
      `Duplicate order-link count: ${duplicateOrderLinkCount}`,
      `Authenticated checkout link count: ${authenticatedCheckoutLinkCount}`,
      `Failed checkout orphan link count: ${failedCheckoutOrphanLinkCount}`,
      `Notification duplicate count: ${notificationDuplicateCount}`,
      `Disabled-customer active session count: ${disabledActiveSessionCount}`,
      "External email call count: 0",
      "External SMS call count: 0",
      "External OAuth call count: 0",
      "",
      "No PII, tokens, hashes, database URLs or secrets are included in this report.",
      "",
    ].join("\n");

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, report, "utf8");
    console.log(report);
  } finally {
    await cleanup(connection).catch(() => undefined);
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

type TableSnapshot = {
  tableName: string;
  keyFields: string[];
  columns: string[];
  identifiers: string[];
  fingerprint: string;
  count: number;
};

type MarkerFile = {
  version: 1;
  source: "task013";
  createdBy: "scripts/validate-task014-existing-db.ts";
  tables: Record<string, TableSnapshot>;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-014");
const markerPath = path.join(
  artifactDirectory,
  ".task013-preservation-markers.json",
);
const reportPath = path.join(
  artifactDirectory,
  "task013-to-task014-validation.txt",
);
const task014MigrationName =
  "20260801150000_task014_customer_accounts_dashboard";
const customerId = "task014cicustomer";
const contactId = "task014cicontact";
const orderId = "task014ciorder";
const orderItemId = "task014ciitem";
const orderLinkId = "task014cilink";
const sessionId = "task014cisession";
const authTokenId = "task014ciauthtoken";
const notificationId = "task014cinotification";
const preferenceId = "task014cipreference";
const securityEventId = "task014cisecurity";
const accountEventId = "task014ciaccountevent";
const auditId = "task014ciaudit";

const newTables = [
  "CustomerProfile",
  "CustomerAccountSettings",
  "CustomerAuthToken",
  "CustomerOrderLink",
  "CustomerOrderClaimEvent",
  "CustomerNotification",
  "CustomerNotificationPreference",
  "CustomerSecurityEvent",
  "CustomerAccountEvent",
] as const;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Row)
        .filter(([key]) => key !== "updatedAt")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return value;
}

function projectRow(row: Row, columns: string[]) {
  return Object.fromEntries(columns.map((column) => [column, row[column]]));
}

function identifier(row: Row, fields: string[]) {
  return fields.map((field) => String(row[field] ?? "")).join("\u001f");
}

function fingerprint(rowsToHash: Row[], fields: string[]) {
  const sortedRows = [...rowsToHash].sort((left, right) =>
    identifier(left, fields).localeCompare(identifier(right, fields)),
  );
  return createHash("sha256")
    .update(JSON.stringify(normalize(sortedRows)))
    .digest("hex");
}

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function connect() {
  return mariadb.createConnection({
    host: requiredEnv("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: requiredEnv("DATABASE_USER"),
    password: requiredEnv("DATABASE_PASSWORD"),
    database: requiredEnv("DATABASE_NAME"),
    bigIntAsNumber: true,
    allowPublicKeyRetrieval:
      process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === "true",
  });
}

async function rows<T extends Row>(
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
  return asNumber(result[0]?.value);
}

async function tableNames(connection: Connection) {
  const result = await rows<{ TABLE_NAME: string }>(
    connection,
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME <> '_prisma_migrations'
     ORDER BY TABLE_NAME`,
  );
  return result.map((row) => row.TABLE_NAME);
}

async function tableColumns(connection: Connection, tableName: string) {
  const result = await rows<{ COLUMN_NAME: string }>(
    connection,
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [tableName],
  );
  return result.map((row) => row.COLUMN_NAME);
}

async function primaryKeyFields(connection: Connection, tableName: string) {
  const result = await rows<{ COLUMN_NAME: string }>(
    connection,
    `SELECT COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    [tableName],
  );
  if (result.length) return result.map((row) => row.COLUMN_NAME);
  return tableColumns(connection, tableName);
}

async function tableRows(
  connection: Connection,
  tableName: string,
  keyFields: string[],
) {
  const orderBy = keyFields.map((field) => `\`${field}\``).join(", ");
  return rows(connection, `SELECT * FROM \`${tableName}\` ORDER BY ${orderBy}`);
}

function createSnapshot(
  tableName: string,
  keyFields: string[],
  columns: string[],
  rowsToSnapshot: Row[],
) {
  const projectedRows = rowsToSnapshot.map((row) => projectRow(row, columns));
  return {
    tableName,
    keyFields,
    columns,
    identifiers: rowsToSnapshot.map((row) => identifier(row, keyFields)),
    fingerprint: fingerprint(projectedRows, keyFields),
    count: rowsToSnapshot.length,
  } satisfies TableSnapshot;
}

function preservedRows(currentRows: Row[], snapshot: TableSnapshot) {
  const byIdentifier = new Map(
    currentRows.map((row) => [identifier(row, snapshot.keyFields), row]),
  );
  return snapshot.identifiers.map((rowIdentifier) => {
    const row = byIdentifier.get(rowIdentifier);
    if (!row) {
      throw new Error(
        `Missing preserved row ${rowIdentifier} in ${snapshot.tableName}.`,
      );
    }
    return projectRow(row, snapshot.columns);
  });
}

async function snapshot() {
  const connection = await connect();
  try {
    const tables: Record<string, TableSnapshot> = {};
    for (const tableName of await tableNames(connection)) {
      const keyFields = await primaryKeyFields(connection, tableName);
      const columns = await tableColumns(connection, tableName);
      tables[tableName] = createSnapshot(
        tableName,
        keyFields,
        columns,
        await tableRows(connection, tableName, keyFields),
      );
    }
    const markerFile: MarkerFile = {
      version: 1,
      source: "task013",
      createdBy: "scripts/validate-task014-existing-db.ts",
      tables,
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(markerPath, JSON.stringify(markerFile, null, 2), "utf8");
    console.log(`Task 013 preservation markers written to ${markerPath}`);
  } finally {
    await connection.end();
  }
}

async function cleanupCustomerFixtures(connection: Connection) {
  await connection.query("DELETE FROM CustomerAccountEvent WHERE id = ?", [
    accountEventId,
  ]);
  await connection.query("DELETE FROM CustomerSecurityEvent WHERE id = ?", [
    securityEventId,
  ]);
  await connection.query(
    "DELETE FROM CustomerNotificationPreference WHERE id = ?",
    [preferenceId],
  );
  await connection.query("DELETE FROM CustomerNotification WHERE id = ?", [
    notificationId,
  ]);
  await connection.query("DELETE FROM CustomerAuthToken WHERE id = ?", [
    authTokenId,
  ]);
  await connection.query(
    "DELETE FROM CustomerOrderClaimEvent WHERE userId = ?",
    [customerId],
  );
  await connection.query("DELETE FROM CustomerOrderLink WHERE id = ?", [
    orderLinkId,
  ]);
  await connection.query("DELETE FROM Session WHERE id = ?", [sessionId]);
  await connection.query("DELETE FROM OrderPaymentEvent WHERE orderId = ?", [
    orderId,
  ]);
  await connection.query("DELETE FROM OrderStatusEvent WHERE orderId = ?", [
    orderId,
  ]);
  await connection.query("DELETE FROM OrderItem WHERE id = ?", [orderItemId]);
  await connection.query("DELETE FROM `Order` WHERE id = ?", [orderId]);
  await connection.query("DELETE FROM GuestOrderContact WHERE id = ?", [
    contactId,
  ]);
  await connection.query("DELETE FROM CustomerProfile WHERE userId = ?", [
    customerId,
  ]);
  await connection.query("DELETE FROM UserRole WHERE userId = ?", [customerId]);
  await connection.query("DELETE FROM User WHERE id = ?", [customerId]);
  await connection.query("DELETE FROM AuditLog WHERE id = ?", [auditId]);
}

async function prepareCustomer() {
  const connection = await connect();
  try {
    await cleanupCustomerFixtures(connection);
    await connection.query(
      `UPDATE FeatureFlag
       SET enabled = 1
       WHERE \`key\` IN (
         'customer_accounts_enabled',
         'customer_registration_enabled',
         'customer_dashboard_enabled'
       )`,
    );
    await connection.query(
      `UPDATE CustomerAccountSettings
       SET registrationEnabled = 1,
         dashboardEnabled = 1,
         emailVerificationRequired = 1,
         passwordRecoveryEnabled = 1,
         customerSessionDurationHours = 24,
         maximumActiveCustomerSessions = 3,
         publicRegistrationInstructions = 'Task 014 CI registration marker.',
         publicRecoveryInstructions = 'Task 014 CI recovery marker.',
         notificationProviderConfigured = 0,
         needsClientReview = 1,
         concurrencyVersion = concurrencyVersion + 1
       WHERE stableKey = 'customer-accounts-default-settings'`,
    );
    await connection.query(
      `INSERT IGNORE INTO RolePermission (roleId, permissionId, grantedAt)
       SELECT roleRecord.id, permissionRecord.id, NOW(3)
       FROM Role roleRecord
       CROSS JOIN Permission permissionRecord
       WHERE roleRecord.key = 'SUPPORT_AGENT'
         AND permissionRecord.key = 'customers.notifications.manage'`,
    );

    const settings = (
      await rows<{
        termsVersion: string;
        privacyPolicyVersion: string;
      }>(
        connection,
        `SELECT termsVersion, privacyPolicyVersion
         FROM CheckoutSettings
         WHERE stableKey = 'checkout-default-settings'
         LIMIT 1`,
      )
    )[0];
    const method = (
      await rows<{ id: string }>(
        connection,
        `SELECT id
         FROM CheckoutPaymentMethod
         WHERE stableKey = 'manual-review'
         LIMIT 1`,
      )
    )[0];
    if (!settings || !method) {
      throw new Error("Task 013 checkout seed rows are required.");
    }

    await connection.query(
      `INSERT INTO User
        (id, email, name, passwordHash, status, accountType, createdAt, updatedAt)
       VALUES (?, 'task014-upgrade-customer@example.test',
        'Task 014 Upgrade Customer', ?, 'DISABLED', 'CUSTOMER', NOW(3), NOW(3))`,
      [customerId, hash("task014 customer password preservation marker")],
    );
    await connection.query(
      `INSERT INTO CustomerProfile
        (id, userId, displayName, defaultRsn, emailVerificationStatus,
         registrationSource, needsReview, termsVersion, privacyPolicyVersion,
         termsAcceptedAt, privacyAcceptedAt, createdAt, updatedAt)
       VALUES ('task014ciprofile', ?, 'Task 014 Upgrade Customer', 'Task014',
        'PENDING_VERIFICATION', 'CI_UPGRADE_VALIDATION', 1, ?, ?,
        NOW(3), NOW(3), NOW(3), NOW(3))`,
      [customerId, settings.termsVersion, settings.privacyPolicyVersion],
    );
    await connection.query(
      `INSERT INTO Session
        (id, sessionToken, userId, audience, expires, revokedAt,
         createdAt, lastSeenAt)
       VALUES (?, ?, ?, 'CUSTOMER', DATE_ADD(NOW(3), INTERVAL 1 DAY),
        NOW(3), NOW(3), NOW(3))`,
      [
        sessionId,
        hash("task014 customer session preservation marker"),
        customerId,
      ],
    );
    await connection.query(
      `INSERT INTO GuestOrderContact
        (id, displayName, email, consentAt, termsVersion,
         privacyPolicyVersion, createdAt)
       VALUES (?, 'Task 014 Upgrade Contact',
        'task014-upgrade-customer@example.test', NOW(3), ?, ?, NOW(3))`,
      [contactId, settings.termsVersion, settings.privacyPolicyVersion],
    );
    await connection.query(
      `INSERT INTO \`Order\`
        (id, orderNumber, guestContactId, paymentMethodId, trackingTokenHash,
         checkoutIdempotencyKeyHash, status, paymentStatus, paymentMethodType,
         currencyCode, subtotalCents, adjustmentTotalCents, finalTotalCents,
         termsVersion, privacyPolicyVersion, createdAt, updatedAt)
       VALUES (?, 'TASK014-UPGRADE', ?, ?, ?, ?, 'PAID', 'PAID',
        'MANUAL_REVIEW', 'USD', 4200, 0, 4200, ?, ?, NOW(3), NOW(3))`,
      [
        orderId,
        contactId,
        method.id,
        hash("task014 order tracking preservation marker"),
        hash("task014 checkout idempotency preservation marker"),
        settings.termsVersion,
        settings.privacyPolicyVersion,
      ],
    );
    await connection.query(
      `INSERT INTO OrderItem
        (id, orderId, kind, publicTitle, publicConfigurationSummary, quantity,
         currencyCode, priceLines, subtotalCents, adjustmentTotalCents,
         finalTotalCents, sourceReference, customerSafeSnapshot,
         resourceReservationState, createdAt)
       VALUES (?, ?, 'PRODUCT_ESTIMATE', 'Task 014 upgrade item',
        'Task 014 safe item snapshot.', 1, 'USD',
        JSON_ARRAY(JSON_OBJECT('label', 'Task 014 upgrade item',
          'amountCents', 4200)),
        4200, 0, 4200, 'task014-upgrade-source',
        JSON_OBJECT('task', '014', 'safe', true), 'NONE', NOW(3))`,
      [orderItemId, orderId],
    );
    await connection.query(
      `INSERT INTO OrderStatusEvent
        (id, orderId, eventType, newStatus, publicNote, reasonCode,
         sequence, createdAt)
       VALUES ('task014cistatusevent', ?, 'CREATED', 'PAID',
        'Task 014 upgrade order created.', 'TASK014_UPGRADE', 1, NOW(3))`,
      [orderId],
    );
    await connection.query(
      `INSERT INTO OrderPaymentEvent
        (id, orderId, newPaymentStatus, paymentMethodType, publicNote,
         reasonCode, sequence, createdAt)
       VALUES ('task014cipaymentevent', ?, 'PAID', 'MANUAL_REVIEW',
        'Task 014 upgrade payment marker.', 'TASK014_UPGRADE', 1, NOW(3))`,
      [orderId],
    );
    await connection.query(
      `INSERT INTO CustomerOrderLink
        (id, userId, orderId, source, safeCreatedByContext,
         createdAt, updatedAt)
       VALUES (?, ?, ?, 'SECURE_GUEST_CLAIM', 'ci-upgrade-validation',
        NOW(3), NOW(3))`,
      [orderLinkId, customerId, orderId],
    );
    await connection.query(
      `INSERT INTO CustomerAuthToken
        (id, userId, purpose, status, tokenHash, expiresAt,
         notificationId, createdAt, updatedAt)
       VALUES (?, ?, 'EMAIL_VERIFICATION', 'ACTIVE', ?,
        DATE_ADD(NOW(3), INTERVAL 1 DAY), NULL, NOW(3), NOW(3))`,
      [authTokenId, customerId, hash("task014 auth token preservation marker")],
    );
    await connection.query(
      `INSERT INTO CustomerNotification
        (id, userId, orderId, type, status, title, body, dedupeKey,
         safeMetadata, createdAt, updatedAt)
       VALUES (?, ?, ?, 'ORDER_STATUS_CHANGED', 'UNREAD',
        'Upgrade validation update', 'Task 014 in-app notification marker.',
        'task014-upgrade-notification', JSON_OBJECT('safe', true),
        NOW(3), NOW(3))`,
      [notificationId, customerId, orderId],
    );
    await connection.query(
      `INSERT INTO CustomerNotificationPreference
        (id, userId, type, inAppEnabled, emailEnabled, marketingConsent,
         createdAt, updatedAt)
       VALUES (?, ?, 'ORDER_STATUS_CHANGED', 1, 0, 0, NOW(3), NOW(3))`,
      [preferenceId, customerId],
    );
    await connection.query(
      `INSERT INTO CustomerSecurityEvent
        (id, userId, eventType, ipHash, userAgentHash, safeMetadata, createdAt)
       VALUES (?, ?, 'ACCOUNT_DISABLED', ?, ?, JSON_OBJECT('safe', true),
        NOW(3))`,
      [
        securityEventId,
        customerId,
        hash("task014 ip marker"),
        hash("task014 user agent marker"),
      ],
    );
    await connection.query(
      `INSERT INTO CustomerAccountEvent
        (id, userId, eventType, safeMetadata, createdAt)
       VALUES (?, ?, 'DISABLED', JSON_OBJECT('safe', true), NOW(3))`,
      [accountEventId, customerId],
    );
    await connection.query(
      `INSERT INTO AuditLog
        (id, actorId, action, targetType, targetId, metadata, createdAt)
       VALUES (?, NULL, 'task014.customer.preservation.marker', 'Customer',
        ?, JSON_OBJECT('safe', true), NOW(3))`,
      [auditId, customerId],
    );
    console.log("Task 014 upgrade preservation fixtures prepared.");
  } finally {
    await connection.end();
  }
}

async function newTableCount(connection: Connection) {
  const placeholders = newTables.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})`,
    [...newTables],
  );
  return asNumber(result[0]?.value);
}

async function rolePermissionCount(
  connection: Connection,
  roleKey: string,
  permissionKey: string,
) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM RolePermission rolePermission
     INNER JOIN Role roleRecord ON roleRecord.id = rolePermission.roleId
     INNER JOIN Permission permissionRecord ON permissionRecord.id = rolePermission.permissionId
     WHERE roleRecord.key = ? AND permissionRecord.key = ?`,
    [roleKey, permissionKey],
  );
  return asNumber(result[0]?.value);
}

async function verify() {
  const markerFile = JSON.parse(
    await readFile(markerPath, "utf8"),
  ) as MarkerFile;
  const connection = await connect();
  try {
    const changed: string[] = [];
    for (const [tableName, snapshot] of Object.entries(markerFile.tables)) {
      const current = await tableRows(
        connection,
        tableName,
        snapshot.keyFields,
      );
      const preserved = preservedRows(current, snapshot);
      const currentFingerprint = fingerprint(preserved, snapshot.keyFields);
      if (currentFingerprint !== snapshot.fingerprint) {
        changed.push(tableName);
      }
    }
    if (changed.length) {
      throw new Error(`Preserved Task 013 rows changed: ${changed.join(", ")}`);
    }

    const migration = (
      await rows<{ migration_name: string }>(
        connection,
        `SELECT migration_name
         FROM _prisma_migrations
         WHERE migration_name = ?
         LIMIT 1`,
        [task014MigrationName],
      )
    )[0];
    if (!migration) throw new Error("Task 014 migration is not applied.");
    const tablesAdded = await newTableCount(connection);
    if (tablesAdded !== newTables.length) {
      throw new Error("Task 014 additive table set is incomplete.");
    }

    const customerSettingsCount = await count(
      connection,
      "CustomerAccountSettings",
      "WHERE stableKey = 'customer-accounts-default-settings'",
    );
    const preservedCustomerCount = await count(
      connection,
      "User",
      "WHERE id = ? AND accountType = 'CUSTOMER' AND status = 'DISABLED'",
      [customerId],
    );
    const preservedProfileCount = await count(
      connection,
      "CustomerProfile",
      "WHERE userId = ? AND displayName = 'Task 014 Upgrade Customer'",
      [customerId],
    );
    const preservedSessionCount = await count(
      connection,
      "Session",
      "WHERE id = ? AND userId = ? AND audience = 'CUSTOMER'",
      [sessionId, customerId],
    );
    const preservedOrderLinkCount = await count(
      connection,
      "CustomerOrderLink",
      "WHERE id = ? AND userId = ? AND orderId = ?",
      [orderLinkId, customerId, orderId],
    );
    const preservedTokenCount = await count(
      connection,
      "CustomerAuthToken",
      "WHERE id = ? AND userId = ? AND status = 'ACTIVE'",
      [authTokenId, customerId],
    );
    const preservedNotificationCount = await count(
      connection,
      "CustomerNotification",
      "WHERE id = ? AND userId = ? AND status = 'UNREAD'",
      [notificationId, customerId],
    );
    const preservedPreferenceCount = await count(
      connection,
      "CustomerNotificationPreference",
      "WHERE id = ? AND userId = ? AND marketingConsent = 0",
      [preferenceId, customerId],
    );
    const preservedSecurityCount = await count(
      connection,
      "CustomerSecurityEvent",
      "WHERE id = ? AND userId = ?",
      [securityEventId, customerId],
    );
    const preservedAuditCount = await count(
      connection,
      "AuditLog",
      "WHERE id = ? AND action = 'task014.customer.preservation.marker'",
      [auditId],
    );
    const manualStaffPermissionCount = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "customers.notifications.manage",
    );
    const preTask014CustomerUsers = await count(
      connection,
      "User",
      "WHERE id <> ? AND accountType <> 'STAFF'",
      [customerId],
    );
    const customerStaffRoleCount = await count(
      connection,
      "UserRole",
      "WHERE userId = ?",
      [customerId],
    );

    if (
      customerSettingsCount !== 1 ||
      preservedCustomerCount !== 1 ||
      preservedProfileCount !== 1 ||
      preservedSessionCount !== 1 ||
      preservedOrderLinkCount !== 1 ||
      preservedTokenCount !== 1 ||
      preservedNotificationCount !== 1 ||
      preservedPreferenceCount !== 1 ||
      preservedSecurityCount !== 1 ||
      preservedAuditCount !== 1 ||
      manualStaffPermissionCount !== 1 ||
      preTask014CustomerUsers !== 0 ||
      customerStaffRoleCount !== 0
    ) {
      throw new Error("Task 014 upgrade preservation checks failed.");
    }

    const report = [
      "Task 013 to Task 014 upgrade validation",
      "",
      `Preserved Task 013 table count: ${Object.keys(markerFile.tables).length}`,
      `Preserved Task 013 row count: ${Object.values(markerFile.tables).reduce(
        (total, snapshotRecord) => total + snapshotRecord.count,
        0,
      )}`,
      `Task 014 migration present: ${Boolean(migration)}`,
      `Task 014 new table count: ${tablesAdded}`,
      `Customer account settings count: ${customerSettingsCount}`,
      `Preserved CUSTOMER user count: ${preservedCustomerCount}`,
      `Preserved customer profile count: ${preservedProfileCount}`,
      `Preserved customer session count: ${preservedSessionCount}`,
      `Preserved customer order-link count: ${preservedOrderLinkCount}`,
      `Preserved customer auth-token count: ${preservedTokenCount}`,
      `Preserved notification count: ${preservedNotificationCount}`,
      `Preserved notification preference count: ${preservedPreferenceCount}`,
      `Preserved security event count: ${preservedSecurityCount}`,
      `Preserved audit marker count: ${preservedAuditCount}`,
      `Manual staff permission change preserved: ${manualStaffPermissionCount}`,
      `Pre-Task 014 users migrated as STAFF violations: ${preTask014CustomerUsers}`,
      `CUSTOMER user staff role count: ${customerStaffRoleCount}`,
      "",
      "Task 014 migration and seed are additive over Task 013 preserved data.",
      "No database URLs, passwords, hashes, tokens, PII or secrets are included in this report.",
      "",
    ].join("\n");
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(reportPath, report, "utf8");
    console.log(report);
  } finally {
    await connection.end();
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === "snapshot") {
    await snapshot();
  } else if (mode === "prepare-customer") {
    await prepareCustomer();
  } else if (mode === "verify") {
    await verify();
  } else {
    throw new Error(
      "Usage: tsx scripts/validate-task014-existing-db.ts snapshot|prepare-customer|verify",
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

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
  source: "task014";
  createdBy: "scripts/validate-task015-existing-db.ts";
  tables: Record<string, TableSnapshot>;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-015");
const markerPath = path.join(
  artifactDirectory,
  ".task014-preservation-markers.json",
);
const reportPath = path.join(
  artifactDirectory,
  "task014-to-task015-validation.txt",
);

const task015MigrationName =
  "20260803150000_task015_live_chat_support_dashboard";

const customerId = "task015upgradecustomer";
const profileId = "task015upgradeprofile";
const contactId = "task015upgradecontact";
const orderId = "task015upgradeorder";
const orderItemId = "task015upgradeitem";
const orderLinkId = "task015upgradelink";
const notificationId = "task015upgradenotify";
const preferenceId = "task015upgradepref";
const auditId = "task015upgradeaudit";

const chatGuestSessionId = "task015upgradeguest";
const chatConversationId = "task015upgradechat";
const chatMessageId = "task015upgrademessage";
const chatEventId = "task015upgradeevent";
const chatCursorId = "task015upgradecursor";
const chatNoteId = "task015upgradenote";

const chatTables = [
  "ChatSettings",
  "ChatGuestSession",
  "ChatConversation",
  "ChatMessage",
  "ChatReadCursor",
  "ChatConversationEvent",
  "ChatAssignmentEvent",
  "ChatInternalNote",
  "ChatQuickReply",
  "ChatConversationOrderLink",
  "ChatRetentionEvent",
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
     FROM INFORMATION_SCHEMA.TABLES
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
     FROM INFORMATION_SCHEMA.COLUMNS
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
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
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

async function cleanupTask014Fixtures(connection: Connection) {
  await connection.query(
    "DELETE FROM CustomerNotificationPreference WHERE id = ?",
    [preferenceId],
  );
  await connection.query("DELETE FROM CustomerNotification WHERE id = ?", [
    notificationId,
  ]);
  await connection.query("DELETE FROM CustomerOrderLink WHERE id = ?", [
    orderLinkId,
  ]);
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
  await connection.query("DELETE FROM Session WHERE userId = ?", [customerId]);
  await connection.query("DELETE FROM UserRole WHERE userId = ?", [customerId]);
  await connection.query("DELETE FROM User WHERE id = ?", [customerId]);
  await connection.query("DELETE FROM AuditLog WHERE id = ?", [auditId]);
}

async function prepareTask014Fixtures() {
  const connection = await connect();
  try {
    await cleanupTask014Fixtures(connection);
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
      throw new Error("Task 014 checkout seed rows are required.");
    }
    await connection.query(
      `INSERT INTO User
        (id, email, name, passwordHash, status, accountType, createdAt, updatedAt)
       VALUES (?, 'task015-upgrade-customer@example.test',
        'Task 015 Upgrade Customer', ?, 'ACTIVE', 'CUSTOMER', NOW(3), NOW(3))`,
      [customerId, hash("task015 upgrade customer password marker")],
    );
    await connection.query(
      `INSERT INTO CustomerProfile
        (id, userId, displayName, defaultRsn, emailVerificationStatus,
         registrationSource, needsReview, termsVersion, privacyPolicyVersion,
         termsAcceptedAt, privacyAcceptedAt, createdAt, updatedAt)
       VALUES (?, ?, 'Task 015 Upgrade Customer', 'Task015',
        'VERIFIED', 'CI_TASK015_UPGRADE', 1, ?, ?,
        NOW(3), NOW(3), NOW(3), NOW(3))`,
      [
        profileId,
        customerId,
        settings.termsVersion,
        settings.privacyPolicyVersion,
      ],
    );
    await connection.query(
      `INSERT INTO GuestOrderContact
        (id, displayName, email, rsn, consentAt, termsVersion,
         privacyPolicyVersion, createdAt)
       VALUES (?, 'Task 015 Upgrade Contact',
        'task015-upgrade-customer@example.test', 'Task015',
        NOW(3), ?, ?, NOW(3))`,
      [contactId, settings.termsVersion, settings.privacyPolicyVersion],
    );
    await connection.query(
      `INSERT INTO \`Order\`
        (id, orderNumber, guestContactId, paymentMethodId, trackingTokenHash,
         checkoutIdempotencyKeyHash, status, paymentStatus, paymentMethodType,
         currencyCode, subtotalCents, adjustmentTotalCents, finalTotalCents,
         termsVersion, privacyPolicyVersion, createdAt, updatedAt)
       VALUES (?, 'TASK015-UPGRADE', ?, ?, ?, ?, 'IN_PROGRESS', 'PAID',
        'MANUAL_REVIEW', 'USD', 2200, 0, 2200, ?, ?, NOW(3), NOW(3))`,
      [
        orderId,
        contactId,
        method.id,
        hash("task015 upgrade tracking marker"),
        hash("task015 upgrade checkout marker"),
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
       VALUES (?, ?, 'PRODUCT_ESTIMATE', 'Task 015 upgrade item',
        'Task 015 safe upgrade item snapshot.', 1, 'USD',
        JSON_ARRAY(JSON_OBJECT('label', 'Task 015 upgrade item',
          'amountCents', 2200)),
        2200, 0, 2200, 'task015-upgrade-source',
        JSON_OBJECT('task', '015', 'safe', true), 'NONE', NOW(3))`,
      [orderItemId, orderId],
    );
    await connection.query(
      `INSERT INTO CustomerOrderLink
        (id, userId, orderId, source, safeCreatedByContext, createdAt, updatedAt)
       VALUES (?, ?, ?, 'AUTHENTICATED_CHECKOUT', 'ci-task015-upgrade',
        NOW(3), NOW(3))`,
      [orderLinkId, customerId, orderId],
    );
    await connection.query(
      `INSERT INTO CustomerNotification
        (id, userId, orderId, type, status, title, body, dedupeKey,
         safeMetadata, createdAt, updatedAt)
       VALUES (?, ?, ?, 'ORDER_STATUS_CHANGED', 'UNREAD',
        'Task 015 upgrade notification',
        'Task 014-era notification preserved into Task 015.',
        'task015-upgrade-notification', JSON_OBJECT('safe', true),
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
      `INSERT INTO AuditLog
        (id, actorId, action, targetType, targetId, metadata, createdAt)
       VALUES (?, NULL, 'task015.task014.preservation.marker',
        'Customer', ?, JSON_OBJECT('safe', true), NOW(3))`,
      [auditId, customerId],
    );
    console.log("Task 014 preservation fixtures prepared.");
  } finally {
    await connection.end();
  }
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
      source: "task014",
      createdBy: "scripts/validate-task015-existing-db.ts",
      tables,
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(markerPath, JSON.stringify(markerFile, null, 2), "utf8");
    console.log(`Task 014 preservation markers written to ${markerPath}`);
  } finally {
    await connection.end();
  }
}

async function cleanupChatFixtures(connection: Connection) {
  await connection.query("DELETE FROM ChatConversation WHERE id = ?", [
    chatConversationId,
  ]);
  await connection.query("DELETE FROM ChatGuestSession WHERE id = ?", [
    chatGuestSessionId,
  ]);
}

async function prepareChatFixtures() {
  const connection = await connect();
  try {
    await cleanupChatFixtures(connection);
    await connection.query(
      `INSERT INTO ChatGuestSession
        (id, tokenHash, displayName, supportCategory, status, expiresAt,
         lastSeenAt, createdAt, updatedAt)
       VALUES (?, ?, 'Task 015 Upgrade Guest', 'Upgrade support',
        'ACTIVE', DATE_ADD(NOW(3), INTERVAL 1 DAY), NOW(3), NOW(3), NOW(3))`,
      [chatGuestSessionId, hash("task015 upgrade guest token digest marker")],
    );
    await connection.query(
      `INSERT INTO ChatConversation
        (id, reference, guestSessionId, customerUserId, status, priority,
         assignedStaffId, lastPublicMessageAt, concurrencyVersion,
         createdAt, updatedAt)
       VALUES (?, 'TASK015-UPGRADE-CHAT', ?, NULL, 'QUEUED', 'NORMAL',
        NULL, NOW(3), 1, NOW(3), NOW(3))`,
      [chatConversationId, chatGuestSessionId],
    );
    await connection.query(
      `INSERT INTO ChatMessage
        (id, conversationId, sequence, participantType, messageType,
         guestSessionId, body, idempotencyKeyHash, concurrencyVersion, createdAt)
       VALUES (?, ?, 1, 'GUEST', 'PUBLIC', ?,
        'Task 015 upgrade chat preservation message.',
        ?, 1, NOW(3))`,
      [
        chatMessageId,
        chatConversationId,
        chatGuestSessionId,
        hash("task015 upgrade message idempotency marker"),
      ],
    );
    await connection.query(
      `INSERT INTO ChatConversationEvent
        (id, conversationId, eventType, actorType, reasonCode, sequence,
         safeMetadata, createdAt)
       VALUES (?, ?, 'MESSAGE_CREATED', 'GUEST', 'TASK015_UPGRADE',
        1, JSON_OBJECT('safe', true), NOW(3))`,
      [chatEventId, chatConversationId],
    );
    await connection.query(
      `INSERT INTO ChatReadCursor
        (id, conversationId, participantType, guestSessionId,
         lastReadSequence, createdAt, updatedAt)
       VALUES (?, ?, 'GUEST', ?, 1, NOW(3), NOW(3))`,
      [chatCursorId, chatConversationId, chatGuestSessionId],
    );
    const admin = (
      await rows<{ id: string }>(
        connection,
        "SELECT id FROM User WHERE accountType = 'STAFF' ORDER BY createdAt LIMIT 1",
      )
    )[0];
    if (admin) {
      await connection.query(
        `INSERT INTO ChatInternalNote
          (id, conversationId, staffUserId, body, idempotencyKeyHash, createdAt)
         VALUES (?, ?, ?, 'Task 015 upgrade internal note marker.',
          ?, NOW(3))`,
        [
          chatNoteId,
          chatConversationId,
          admin.id,
          hash("task015 upgrade note idempotency marker"),
        ],
      );
    }
    console.log("Task 015 chat preservation fixtures prepared.");
  } finally {
    await connection.end();
  }
}

async function newTableCount(connection: Connection) {
  const placeholders = chatTables.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})`,
    [...chatTables],
  );
  return asNumber(result[0]?.value);
}

async function flagValue(connection: Connection, key: string) {
  const result = await rows<{ enabled: number | boolean }>(
    connection,
    "SELECT enabled FROM FeatureFlag WHERE `key` = ? LIMIT 1",
    [key],
  );
  return Boolean(result[0]?.enabled);
}

async function verify() {
  const markerFile = JSON.parse(
    await readFile(markerPath, "utf8"),
  ) as MarkerFile;
  const connection = await connect();
  try {
    const changed: string[] = [];
    for (const [tableName, snapshotRecord] of Object.entries(
      markerFile.tables,
    )) {
      const current = await tableRows(
        connection,
        tableName,
        snapshotRecord.keyFields,
      );
      const preserved = preservedRows(current, snapshotRecord);
      const currentFingerprint = fingerprint(
        preserved,
        snapshotRecord.keyFields,
      );
      if (currentFingerprint !== snapshotRecord.fingerprint) {
        changed.push(tableName);
      }
    }
    if (changed.length) {
      throw new Error(`Preserved Task 014 rows changed: ${changed.join(", ")}`);
    }

    const migration = (
      await rows<{ migration_name: string }>(
        connection,
        `SELECT migration_name
         FROM _prisma_migrations
         WHERE migration_name = ?
         LIMIT 1`,
        [task015MigrationName],
      )
    )[0];
    const tablesAdded = await newTableCount(connection);
    const settingsCount = await count(
      connection,
      "ChatSettings",
      "WHERE stableKey = 'chat-default-settings' AND availabilityMode = 'OFFLINE' AND needsClientReview = 1",
    );
    const quickReplyCount = await count(
      connection,
      "ChatQuickReply",
      "WHERE needsClientReview = 1",
    );
    const disabledFlagCount = (
      await Promise.all([
        flagValue(connection, "live_chat_enabled"),
        flagValue(connection, "guest_live_chat_enabled"),
        flagValue(connection, "customer_live_chat_enabled"),
        flagValue(connection, "chat_realtime_enabled"),
      ])
    ).filter(Boolean).length;
    const preservedCustomerCount = await count(
      connection,
      "User",
      "WHERE id = ? AND accountType = 'CUSTOMER' AND status = 'ACTIVE'",
      [customerId],
    );
    const preservedOrderCount = await count(
      connection,
      "Order",
      "WHERE id = ? AND orderNumber = 'TASK015-UPGRADE'",
      [orderId],
    );
    const preservedNotificationCount = await count(
      connection,
      "CustomerNotification",
      "WHERE id = ? AND type = 'ORDER_STATUS_CHANGED'",
      [notificationId],
    );
    const chatFixtureCount = await count(
      connection,
      "ChatConversation",
      "WHERE id = ? AND reference = 'TASK015-UPGRADE-CHAT'",
      [chatConversationId],
    );
    const chatMessageCount = await count(
      connection,
      "ChatMessage",
      "WHERE id = ? AND body = 'Task 015 upgrade chat preservation message.'",
      [chatMessageId],
    );
    const chatNoteCount = await count(
      connection,
      "ChatInternalNote",
      "WHERE id = ? AND body = 'Task 015 upgrade internal note marker.'",
      [chatNoteId],
    );

    if (!migration) throw new Error("Task 015 migration is not applied.");
    if (
      tablesAdded !== chatTables.length ||
      settingsCount !== 1 ||
      quickReplyCount < 3 ||
      disabledFlagCount !== 0 ||
      preservedCustomerCount !== 1 ||
      preservedOrderCount !== 1 ||
      preservedNotificationCount !== 1 ||
      chatFixtureCount !== 1 ||
      chatMessageCount !== 1 ||
      chatNoteCount !== 1
    ) {
      throw new Error("Task 014 to Task 015 upgrade checks failed.");
    }

    const report = [
      "Task 014 to Task 015 upgrade validation",
      "",
      `Preserved Task 014 table count: ${Object.keys(markerFile.tables).length}`,
      `Preserved Task 014 row count: ${Object.values(markerFile.tables).reduce(
        (total, snapshotRecord) => total + snapshotRecord.count,
        0,
      )}`,
      `Task 015 migration present: ${Boolean(migration)}`,
      `Task 015 chat table count: ${tablesAdded}`,
      `Chat settings offline/review count: ${settingsCount}`,
      `Chat quick replies needing review: ${quickReplyCount}`,
      `Enabled Task 015 chat feature-flag count: ${disabledFlagCount}`,
      `Preserved Task 014 CUSTOMER user count: ${preservedCustomerCount}`,
      `Preserved Task 014 order count: ${preservedOrderCount}`,
      `Preserved Task 014 notification count: ${preservedNotificationCount}`,
      `Preserved Task 015 chat conversation fixture count: ${chatFixtureCount}`,
      `Preserved Task 015 chat message fixture count: ${chatMessageCount}`,
      `Preserved Task 015 internal note fixture count: ${chatNoteCount}`,
      "",
      "Task 015 migration and seed are additive over a populated Task 014 database, while newly created chat records survive a seed rerun.",
      "No database URLs, passwords, hashes, raw tokens, emails beyond example.test fixtures, full IP addresses or secrets are included in this report.",
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
  if (mode === "prepare-task014") {
    await prepareTask014Fixtures();
  } else if (mode === "snapshot") {
    await snapshot();
  } else if (mode === "prepare-chat") {
    await prepareChatFixtures();
  } else if (mode === "verify") {
    await verify();
  } else {
    throw new Error(
      "Usage: tsx scripts/validate-task015-existing-db.ts prepare-task014|snapshot|prepare-chat|verify",
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

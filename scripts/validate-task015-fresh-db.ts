import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-015");
const outputPath = path.join(
  artifactDirectory,
  "task015-fresh-database-validation.txt",
);

const task015Migration = "20260803150000_task015_live_chat_support_dashboard";

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

const chatFeatureFlags = [
  "live_chat_enabled",
  "guest_live_chat_enabled",
  "customer_live_chat_enabled",
  "chat_realtime_enabled",
] as const;

const chatPermissionKeys = [
  "chat.view",
  "chat.respond",
  "chat.assign",
  "chat.status.manage",
  "chat.internal_notes.create",
  "chat.order_link",
  "chat.settings.manage",
  "chat.quick_replies.manage",
  "chat.messages.redact",
  "chat.archive",
  "chat.monitor_all",
] as const;

const supportOperationalPermissionKeys = [
  "chat.view",
  "chat.respond",
  "chat.assign",
  "chat.status.manage",
  "chat.internal_notes.create",
  "chat.order_link",
] as const;

const supportRestrictedPermissionKeys = [
  "chat.settings.manage",
  "chat.quick_replies.manage",
  "chat.messages.redact",
  "chat.archive",
  "chat.monitor_all",
] as const;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function asNumber(value: unknown) {
  return Number(value ?? 0);
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

async function rolePermissionCount(
  connection: Connection,
  roleKey: string,
  permissionKeys: readonly string[],
) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM RolePermission rolePermission
     INNER JOIN Role roleRecord ON roleRecord.id = rolePermission.roleId
     INNER JOIN Permission permissionRecord ON permissionRecord.id = rolePermission.permissionId
     WHERE roleRecord.\`key\` = ?
       AND permissionRecord.\`key\` IN (${permissionKeys.map(() => "?").join(", ")})`,
    [roleKey, ...permissionKeys],
  );
  return asNumber(result[0]?.value);
}

async function schemaCount(
  connection: Connection,
  sqlPredicate: string,
  values: unknown[] = [],
) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       ${sqlPredicate}`,
    values,
  );
  return asNumber(result[0]?.value);
}

async function tableSetCount(
  connection: Connection,
  tableNames: readonly string[],
) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${tableNames.map(() => "?").join(", ")})`,
    [...tableNames],
  );
  return asNumber(result[0]?.value);
}

async function notificationEnumContainsChat(connection: Connection) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('CustomerNotification', 'CustomerNotificationPreference')
       AND COLUMN_NAME = 'type'
       AND COLUMN_TYPE LIKE '%CHAT_MESSAGE%'`,
  );
  return asNumber(result[0]?.value);
}

async function main() {
  const connection = await connectDatabase();
  try {
    const mysqlVersion = (
      await rows<{ version: string }>(connection, "SELECT VERSION() AS version")
    )[0]?.version;
    const migrationCount = await count(connection, "_prisma_migrations");
    const migrationPresent = await count(
      connection,
      "_prisma_migrations",
      "WHERE migration_name = ?",
      [task015Migration],
    );
    const tableCount = await tableSetCount(connection, chatTables);
    const permissionCount = await count(
      connection,
      "Permission",
      `WHERE \`key\` IN (${chatPermissionKeys.map(() => "?").join(", ")})`,
      [...chatPermissionKeys],
    );
    const superAdminChatPermissionCount = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      chatPermissionKeys,
    );
    const supportOperationalPermissionCount = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      supportOperationalPermissionKeys,
    );
    const supportRestrictedPermissionCount = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      supportRestrictedPermissionKeys,
    );
    const customerChatAdminPermissionCount = await rows<{ value: number }>(
      connection,
      `SELECT COUNT(*) AS value
       FROM User userRecord
       INNER JOIN UserRole userRole ON userRole.userId = userRecord.id
       INNER JOIN RolePermission rolePermission ON rolePermission.roleId = userRole.roleId
       INNER JOIN Permission permissionRecord ON permissionRecord.id = rolePermission.permissionId
       WHERE userRecord.accountType = 'CUSTOMER'
         AND permissionRecord.\`key\` LIKE 'chat.%'`,
    ).then((result) => asNumber(result[0]?.value));
    const flagValues = new Map(
      await Promise.all(
        chatFeatureFlags.map(
          async (key) => [key, await flagValue(connection, key)] as const,
        ),
      ),
    );

    const counts = {
      chatSettings: await count(
        connection,
        "ChatSettings",
        "WHERE stableKey = 'chat-default-settings'",
      ),
      reviewedChatSettings: await count(
        connection,
        "ChatSettings",
        "WHERE stableKey = 'chat-default-settings' AND needsClientReview = 1",
      ),
      onlineLaunchers: await count(
        connection,
        "ChatSettings",
        "WHERE publicLauncherEnabled = 1 OR availabilityMode <> 'OFFLINE'",
      ),
      quickReplies: await count(connection, "ChatQuickReply"),
      quickRepliesNeedingReview: await count(
        connection,
        "ChatQuickReply",
        "WHERE needsClientReview = 1",
      ),
      guestSessions: await count(connection, "ChatGuestSession"),
      conversations: await count(connection, "ChatConversation"),
      messages: await count(connection, "ChatMessage"),
      readCursors: await count(connection, "ChatReadCursor"),
      events: await count(connection, "ChatConversationEvent"),
      assignments: await count(connection, "ChatAssignmentEvent"),
      internalNotes: await count(connection, "ChatInternalNote"),
      orderLinks: await count(connection, "ChatConversationOrderLink"),
      retentionEvents: await count(connection, "ChatRetentionEvent"),
    };

    const rawChatTokenColumnCount = await schemaCount(
      connection,
      `AND TABLE_NAME LIKE 'Chat%'
       AND LOWER(COLUMN_NAME) REGEXP '(^token$|raw.*token|guesttoken|sessiontoken|authtoken)'
       AND LOWER(COLUMN_NAME) NOT IN ('tokenhash', 'idempotencykeyhash')`,
    );
    const credentialColumnCount = await schemaCount(
      connection,
      `AND TABLE_NAME LIKE 'Chat%'
       AND LOWER(COLUMN_NAME) REGEXP '(runescapepassword|emailpassword|recoveryanswer|authenticatorsecret|bankpin|cardnumber|cvv|credential)'`,
    );
    const chatAttachmentSchemaCount = await schemaCount(
      connection,
      `AND TABLE_NAME LIKE 'Chat%'
       AND LOWER(CONCAT(TABLE_NAME, '.', COLUMN_NAME)) REGEXP '(attachment|upload|blob|media|filepath|filename)'`,
    );
    const chatAttachmentTableCount = await rows<{ value: number }>(
      connection,
      `SELECT COUNT(*) AS value
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) REGEXP '^chat.*(attachment|upload|blob|media|file)'`,
    ).then((result) => asNumber(result[0]?.value));
    const externalChatProviderSchemaCount = await rows<{ value: number }>(
      connection,
      `SELECT COUNT(*) AS value
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(CONCAT(TABLE_NAME, '.', COLUMN_NAME)) REGEXP '(intercom|zendesk|crisp|tawk|livechat|helpscout|drift|twilio|pusher|ably|pubnub)'`,
    ).then((result) => asNumber(result[0]?.value));
    const chatMessageEnumCount = await notificationEnumContainsChat(connection);

    if (!mysqlVersion) throw new Error("Could not read MySQL version.");
    if (migrationPresent !== 1) throw new Error("Task 015 migration missing.");
    if (tableCount !== chatTables.length) {
      throw new Error("Task 015 additive chat table set is incomplete.");
    }
    if (counts.chatSettings !== 1 || counts.reviewedChatSettings !== 1) {
      throw new Error(
        "Chat settings seed is missing or not marked for review.",
      );
    }
    if (counts.onlineLaunchers !== 0) {
      throw new Error("Fresh chat settings must not enable live launcher.");
    }
    if (
      counts.quickReplies !== 3 ||
      counts.quickRepliesNeedingReview !== counts.quickReplies
    ) {
      throw new Error(
        "Chat quick replies must be seeded and client-review marked.",
      );
    }
    if (
      counts.guestSessions !== 0 ||
      counts.conversations !== 0 ||
      counts.messages !== 0 ||
      counts.readCursors !== 0 ||
      counts.events !== 0 ||
      counts.assignments !== 0 ||
      counts.internalNotes !== 0 ||
      counts.orderLinks !== 0 ||
      counts.retentionEvents !== 0
    ) {
      throw new Error("Fresh seed created chat activity records.");
    }
    if ([...flagValues.values()].some(Boolean)) {
      throw new Error("Chat feature flags must default disabled.");
    }
    if (
      permissionCount !== chatPermissionKeys.length ||
      superAdminChatPermissionCount !== chatPermissionKeys.length ||
      supportOperationalPermissionCount !==
        supportOperationalPermissionKeys.length ||
      supportRestrictedPermissionCount !== 0 ||
      customerChatAdminPermissionCount !== 0
    ) {
      throw new Error("Chat role/permission defaults are unsafe.");
    }
    if (chatMessageEnumCount !== 2) {
      throw new Error("CHAT_MESSAGE notification enum value is missing.");
    }
    if (
      rawChatTokenColumnCount !== 0 ||
      credentialColumnCount !== 0 ||
      chatAttachmentSchemaCount !== 0 ||
      chatAttachmentTableCount !== 0 ||
      externalChatProviderSchemaCount !== 0
    ) {
      throw new Error("Chat privacy/provider schema validation failed.");
    }

    const report = [
      "Task 015 fresh database validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Applied migration count: ${migrationCount}`,
      `Task 015 migration present: ${migrationPresent === 1}`,
      `Task 015 chat table count: ${tableCount}`,
      `Chat settings count: ${counts.chatSettings}`,
      `Chat settings needing client review: ${counts.reviewedChatSettings}`,
      `Enabled/online launcher settings count: ${counts.onlineLaunchers}`,
      `Chat quick-reply count: ${counts.quickReplies}`,
      `Chat quick replies needing review: ${counts.quickRepliesNeedingReview}`,
      `Guest-session count: ${counts.guestSessions}`,
      `Conversation count: ${counts.conversations}`,
      `Message count: ${counts.messages}`,
      `Read-cursor count: ${counts.readCursors}`,
      `Conversation-event count: ${counts.events}`,
      `Assignment-event count: ${counts.assignments}`,
      `Internal-note count: ${counts.internalNotes}`,
      `Order-link count: ${counts.orderLinks}`,
      `Retention-event count: ${counts.retentionEvents}`,
      ...chatFeatureFlags.map(
        (key) => `${key} value: ${flagValues.get(key) ?? false}`,
      ),
      `Chat permission count: ${permissionCount}`,
      `SUPER_ADMIN chat permission assignments: ${superAdminChatPermissionCount}`,
      `SUPPORT_AGENT operational chat assignments: ${supportOperationalPermissionCount}`,
      `SUPPORT_AGENT restricted chat assignments: ${supportRestrictedPermissionCount}`,
      `CUSTOMER chat-admin permission count: ${customerChatAdminPermissionCount}`,
      `CHAT_MESSAGE notification enum columns: ${chatMessageEnumCount}`,
      `Plaintext token column count: ${rawChatTokenColumnCount}`,
      `Credential-like column count: ${credentialColumnCount}`,
      `Attachment-table count: ${chatAttachmentTableCount}`,
      `External chat-provider configuration count: ${externalChatProviderSchemaCount}`,
      `Raw chat-token schema-column count: ${rawChatTokenColumnCount}`,
      `Credential-like chat schema-column count: ${credentialColumnCount}`,
      `Chat attachment schema-column count: ${chatAttachmentSchemaCount}`,
      `External chat-provider schema count: ${externalChatProviderSchemaCount}`,
      "",
      "Fresh Task 015 seed leaves chat disabled, review-marked and without conversations, guest sessions, messages, attachments or external provider configuration.",
      "No database URLs, emails, names, tokens, token hashes, password hashes, IP addresses, order identifiers or secrets are included in this report.",
      "",
    ].join("\n");

    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(outputPath, report, "utf8");
    console.log(report);
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

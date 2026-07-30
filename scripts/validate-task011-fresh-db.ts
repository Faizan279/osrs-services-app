import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

const outputPath = path.join(
  process.cwd(),
  "artifacts",
  "task-011",
  "task011-fresh-database-validation.txt",
);

const task011MigrationName = "20260728150000_task011_custom_account_build";
const customBuildPermissionKeys = [
  "custom_builds.view",
  "custom_builds.edit",
  "custom_builds.publish",
  "custom_builds.requests.review",
  "custom_builds.attachments.review",
  "custom_builds.quotes.manage",
] as const;

const credentialColumnPattern =
  /(password|passcode|credential|login|recovery|authenticator|twofactor|two_factor|2fa|backupCode|backup_code|cookie|bankPin|bank_pin|emailPassword|email_password|rawToken|sessionToken)/i;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function asBoolean(value: unknown) {
  return asNumber(value) === 1;
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

async function credentialColumnMatches(connection: Connection) {
  const columns = await rows<{ tableName: string; columnName: string }>(
    connection,
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME LIKE 'CustomBuild%'`,
  );
  return columns
    .filter((column) => credentialColumnPattern.test(column.columnName))
    .map((column) => `${column.tableName}.${column.columnName}`);
}

function privateAttachmentRootOutsidePublic() {
  const configured =
    process.env.CUSTOM_BUILD_PRIVATE_ATTACHMENT_ROOT ||
    "storage/private/custom-build-attachments";
  const resolved = path.resolve(process.cwd(), configured);
  const publicRoot = path.resolve(process.cwd(), "public");
  const publicRootWithSeparator = publicRoot.endsWith(path.sep)
    ? publicRoot
    : `${publicRoot}${path.sep}`;
  return (
    resolved !== publicRoot && !resolved.startsWith(publicRootWithSeparator)
  );
}

async function customBuildPermissionCount(connection: Connection) {
  const placeholders = customBuildPermissionKeys.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value FROM Permission WHERE \`key\` IN (${placeholders})`,
    [...customBuildPermissionKeys],
  );
  return asNumber(result[0]?.value);
}

async function main() {
  const connection = await connect();
  try {
    const mysqlVersion = (
      await rows<{ version: string }>(connection, "SELECT VERSION() AS version")
    )[0]?.version;
    const migration = (
      await rows<{ migration_name: string }>(
        connection,
        `SELECT migration_name
         FROM _prisma_migrations
         WHERE migration_name = ?
         LIMIT 1`,
        [task011MigrationName],
      )
    )[0];
    const flag = (
      await rows<{ enabled: number }>(
        connection,
        "SELECT enabled FROM FeatureFlag WHERE `key` = 'custom_account_build_enabled' LIMIT 1",
      )
    )[0];
    const permissionCount = await customBuildPermissionCount(connection);
    const credentialColumns = await credentialColumnMatches(connection);
    const attachmentRootPrivate = privateAttachmentRootOutsidePublic();

    if (!mysqlVersion) throw new Error("Could not read MySQL version.");
    if (!migration) throw new Error("Task 011 migration is not applied.");
    if (!flag) throw new Error("custom_account_build_enabled is missing.");
    if (asBoolean(flag.enabled)) {
      throw new Error("custom_account_build_enabled must default to false.");
    }
    if (permissionCount !== customBuildPermissionKeys.length) {
      throw new Error("Custom-build permissions are incomplete.");
    }
    if (credentialColumns.length > 0) {
      throw new Error(
        `Credential-like custom-build columns detected: ${credentialColumns.join(
          ", ",
        )}`,
      );
    }
    if (!attachmentRootPrivate) {
      throw new Error("Private attachment root resolves inside public assets.");
    }

    const superAdminPublish = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "custom_builds.publish",
    );
    const supportView = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "custom_builds.view",
    );
    const supportRequestReview = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "custom_builds.requests.review",
    );
    const supportPublish = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "custom_builds.publish",
    );
    const supportAttachmentReview = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "custom_builds.attachments.review",
    );
    const supportQuoteManage = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "custom_builds.quotes.manage",
    );
    if (
      superAdminPublish !== 1 ||
      supportView !== 1 ||
      supportRequestReview !== 1 ||
      supportPublish !== 0 ||
      supportAttachmentReview !== 0 ||
      supportQuoteManage !== 0
    ) {
      throw new Error("Custom-build role assignments are incorrect.");
    }

    const report = [
      "Task 011 fresh database validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Applied migration count: ${await count(connection, "_prisma_migrations")}`,
      `Task 011 migration present: ${Boolean(migration)}`,
      `Custom-build service count: ${await count(connection, "CustomBuildService")}`,
      `Draft rule-set count: ${await count(
        connection,
        "CustomBuildRuleSet",
        "WHERE status = 'DRAFT'",
      )}`,
      `Published revision count: ${await count(connection, "CustomBuildRevision")}`,
      `Skill-rule count: ${await count(connection, "CustomBuildSkillRule")}`,
      `Objective count: ${await count(connection, "CustomBuildObjective")}`,
      `Objective-rule count: ${await count(
        connection,
        "CustomBuildObjectiveRule",
      )}`,
      `Request count: ${await count(connection, "CustomBuildRequest")}`,
      `Status-event count: ${await count(
        connection,
        "CustomBuildRequestStatusEvent",
      )}`,
      `Attachment metadata count: ${await count(
        connection,
        "CustomBuildAttachment",
      )}`,
      `Quote count: ${await count(connection, "CustomBuildQuote")}`,
      `Quote-revision count: ${await count(
        connection,
        "CustomBuildQuoteRevision",
      )}`,
      `Quote-line count: ${await count(connection, "CustomBuildQuoteLine")}`,
      `Customer-decision count: ${await count(
        connection,
        "CustomBuildQuoteDecision",
      )}`,
      `custom_account_build_enabled value: ${asBoolean(flag.enabled)}`,
      `Custom-build permission count: ${permissionCount}`,
      `SUPER_ADMIN custom_builds.publish assignment: ${superAdminPublish}`,
      `SUPPORT_AGENT custom_builds.view assignment: ${supportView}`,
      `SUPPORT_AGENT custom_builds.requests.review assignment: ${supportRequestReview}`,
      `SUPPORT_AGENT custom_builds.publish assignment: ${supportPublish}`,
      `SUPPORT_AGENT custom_builds.attachments.review assignment: ${supportAttachmentReview}`,
      `SUPPORT_AGENT custom_builds.quotes.manage assignment: ${supportQuoteManage}`,
      `Credential-like schema-column count: ${credentialColumns.length}`,
      `Private attachment root outside public directory: ${attachmentRootPrivate}`,
      "",
      "No passwords, hashes, emails, Discord usernames, RSNs, tracking tokens, customer notes, attachment filenames, attachment paths, database URLs or secrets are included in this report.",
      "",
    ].join("\n");

    await mkdir(path.dirname(outputPath), { recursive: true });
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

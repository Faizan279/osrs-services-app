import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

const outputPath = path.join(
  process.cwd(),
  "artifacts",
  "task-010",
  "task010-fresh-database-validation.txt",
);

const credentialColumnPattern =
  /(password|login|credential|recoveryAnswer|recoveryQuestion|authenticatorSecret|authenticatorSeed|sessionToken|cookie|bankPinValue|emailAddress|loginEmail)/i;

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
       AND TABLE_NAME LIKE 'Account%'`,
  );
  return columns
    .filter((column) => credentialColumnPattern.test(column.columnName))
    .map((column) => `${column.tableName}.${column.columnName}`);
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
         WHERE migration_name = '20260727150000_task010_account_marketplace'
         LIMIT 1`,
      )
    )[0];
    const flag = (
      await rows<{ enabled: number }>(
        connection,
        "SELECT enabled FROM FeatureFlag WHERE `key` = 'account_marketplace_enabled' LIMIT 1",
      )
    )[0];
    const accountPermissionCount = (
      await rows<{ value: number }>(
        connection,
        `SELECT COUNT(*) AS value FROM Permission
         WHERE \`key\` IN (
           'accounts.view',
           'accounts.edit',
           'accounts.approve',
           'accounts.publish',
           'accounts.availability.manage',
           'accounts.handover.review'
         )`,
      )
    )[0]?.value;
    const credentialColumns = await credentialColumnMatches(connection);

    if (!mysqlVersion) throw new Error("Could not read MySQL version.");
    if (!migration) throw new Error("Task 010 migration is not applied.");
    if (!flag) throw new Error("account_marketplace_enabled is missing.");
    if (asBoolean(flag.enabled)) {
      throw new Error("account_marketplace_enabled must default to false.");
    }
    if (asNumber(accountPermissionCount) !== 6) {
      throw new Error("Account permissions are incomplete.");
    }
    if (credentialColumns.length > 0) {
      throw new Error(
        `Credential-like account columns detected: ${credentialColumns.join(", ")}`,
      );
    }

    const superAdminPublish = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "accounts.publish",
    );
    const supportView = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.view",
    );
    const supportPublish = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.publish",
    );
    const supportApprove = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.approve",
    );
    const supportAvailability = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.availability.manage",
    );
    const supportHandover = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.handover.review",
    );
    if (superAdminPublish !== 1) {
      throw new Error("SUPER_ADMIN account publish permission is missing.");
    }
    if (
      supportView !== 1 ||
      supportPublish !== 0 ||
      supportApprove !== 0 ||
      supportAvailability !== 0 ||
      supportHandover !== 0
    ) {
      throw new Error("SUPPORT_AGENT account permissions are incorrect.");
    }

    const report = [
      "Task 010 fresh database validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Applied migration count: ${await count(connection, "_prisma_migrations")}`,
      `Task 010 migration present: ${Boolean(migration)}`,
      `Marketplace count: ${await count(connection, "AccountMarketplace")}`,
      `Listing count: ${await count(connection, "AccountListing")}`,
      `Draft listing count: ${await count(
        connection,
        "AccountListing",
        "WHERE publicationStatus = 'DRAFT'",
      )}`,
      `Published listing count: ${await count(
        connection,
        "AccountListing",
        "WHERE publicationStatus = 'PUBLISHED'",
      )}`,
      `Approved listing count: ${await count(
        connection,
        "AccountListing",
        "WHERE approvalStatus = 'APPROVED'",
      )}`,
      `Available listing count: ${await count(
        connection,
        "AccountListing",
        "WHERE availability = 'AVAILABLE'",
      )}`,
      `Held listing count: ${await count(
        connection,
        "AccountListing",
        "WHERE availability = 'HELD'",
      )}`,
      `Sold listing count: ${await count(
        connection,
        "AccountListing",
        "WHERE availability = 'SOLD'",
      )}`,
      `Stat count: ${await count(connection, "AccountListingStat")}`,
      `Unlock count: ${await count(connection, "AccountListingUnlock")}`,
      `Feature count: ${await count(connection, "AccountListingFeature")}`,
      `Image count: ${await count(connection, "AccountListingImage")}`,
      `Revision count: ${await count(connection, "AccountListingRevision")}`,
      `Hold count: ${await count(connection, "AccountListingHold")}`,
      `account_marketplace_enabled value: ${asBoolean(flag.enabled)}`,
      `Account permission count: ${accountPermissionCount}`,
      `SUPER_ADMIN accounts.publish assignment: ${superAdminPublish}`,
      `SUPPORT_AGENT accounts.view assignment: ${supportView}`,
      `SUPPORT_AGENT accounts.publish assignment: ${supportPublish}`,
      `SUPPORT_AGENT accounts.approve assignment: ${supportApprove}`,
      `SUPPORT_AGENT accounts.availability.manage assignment: ${supportAvailability}`,
      `SUPPORT_AGENT accounts.handover.review assignment: ${supportHandover}`,
      `Credential-like account columns detected: ${credentialColumns.length}`,
      "",
      "No passwords, hashes, database URLs, secrets, private notes or credential values are included in this report.",
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

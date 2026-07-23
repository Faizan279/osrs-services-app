import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

const outputPath = path.join(
  process.cwd(),
  "artifacts",
  "task-008",
  "task008-fresh-database-validation.txt",
);

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

function parseJson(value: unknown) {
  if (typeof value === "string") return JSON.parse(value) as Row;
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8")) as Row;
  if (value && typeof value === "object") return value as Row;
  throw new Error("Expected a JSON object.");
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

async function count(connection: Connection, tableName: string) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value FROM \`${tableName}\``,
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
         WHERE migration_name = '20260723160000_task008_global_pricing_foundation'
         LIMIT 1`,
      )
    )[0];
    const flag = (
      await rows<{ enabled: number; description: string }>(
        connection,
        "SELECT enabled, description FROM FeatureFlag WHERE `key` = 'global_pricing_enabled' LIMIT 1",
      )
    )[0];
    const draft = (
      await rows<{
        id: string;
        status: string;
        currencyCode: string;
        snapshotSchemaVersion: number;
        draftVersion: number;
        needsClientReview: number;
      }>(
        connection,
        `SELECT id, status, currencyCode, snapshotSchemaVersion,
          draftVersion, needsClientReview
         FROM PricingRuleSet
         WHERE status = 'DRAFT'
         ORDER BY createdAt ASC
         LIMIT 1`,
      )
    )[0];
    const latestRevision = (
      await rows<{
        id: string;
        revisionNumber: number;
        snapshot: unknown;
        publishedById: string | null;
      }>(
        connection,
        `SELECT id, revisionNumber, snapshot, publishedById
         FROM PricingRevision
         ORDER BY revisionNumber DESC, publishedAt DESC
         LIMIT 1`,
      )
    )[0];

    if (!mysqlVersion) throw new Error("Could not read MySQL version.");
    if (!migration) throw new Error("Task 008 migration is not applied.");
    if (!flag) throw new Error("global_pricing_enabled is missing.");
    if (asBoolean(flag.enabled)) {
      throw new Error("global_pricing_enabled must default to false.");
    }
    if (!draft) throw new Error("Draft PricingRuleSet is missing.");
    if (draft.status !== "DRAFT")
      throw new Error("Pricing rule set is not a draft.");
    if (draft.currencyCode !== "USD")
      throw new Error("Pricing rule set currency must be USD.");
    if (asNumber(draft.snapshotSchemaVersion) !== 1) {
      throw new Error("Unexpected pricing snapshot schema version.");
    }
    if (!latestRevision) throw new Error("Seeded pricing revision missing.");

    const snapshot = parseJson(latestRevision.snapshot);
    if (snapshot.schemaVersion !== 1) {
      throw new Error("Seeded pricing revision snapshot schema is invalid.");
    }
    if (snapshot.ruleSetId !== draft.id) {
      throw new Error("Seeded pricing revision does not point at the draft.");
    }
    if (!Array.isArray(snapshot.rules)) {
      throw new Error("Seeded pricing revision rules must be an array.");
    }
    if (snapshot.rules.length !== 0) {
      throw new Error("Fresh seed must be a neutral zero-rule revision.");
    }

    const pricingPermissionCount = (
      await rows<{ value: number }>(
        connection,
        "SELECT COUNT(*) AS value FROM Permission WHERE `key` IN ('pricing.view', 'pricing.edit', 'pricing.publish')",
      )
    )[0]?.value;
    if (asNumber(pricingPermissionCount) !== 3) {
      throw new Error("Pricing permissions are incomplete.");
    }

    const superAdminPublish = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "pricing.publish",
    );
    const supportPublish = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "pricing.publish",
    );
    const supportEdit = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "pricing.edit",
    );
    if (superAdminPublish !== 1) {
      throw new Error("SUPER_ADMIN must receive pricing.publish.");
    }
    if (supportPublish !== 0 || supportEdit !== 0) {
      throw new Error("SUPPORT_AGENT must not receive pricing edit/publish.");
    }

    const report = [
      "Task 008 fresh database validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Applied migration count: ${await count(connection, "_prisma_migrations")}`,
      `Task 008 migration present: ${Boolean(migration)}`,
      `Pricing rule set count: ${await count(connection, "PricingRuleSet")}`,
      `Pricing rule count: ${await count(connection, "PricingRule")}`,
      `Pricing applicability count: ${await count(
        connection,
        "PricingRuleApplicability",
      )}`,
      `Pricing revision count: ${await count(connection, "PricingRevision")}`,
      `global_pricing_enabled value: ${asBoolean(flag.enabled)}`,
      `Draft rule set id: ${draft.id}`,
      `Draft rule set version: ${draft.draftVersion}`,
      `Draft needs client review: ${asBoolean(draft.needsClientReview)}`,
      `Latest pricing revision: #${latestRevision.revisionNumber}`,
      `Latest revision schemaVersion: ${snapshot.schemaVersion}`,
      `Latest revision rules: ${snapshot.rules.length}`,
      `Pricing permission count: ${pricingPermissionCount}`,
      `SUPER_ADMIN pricing.publish assignment: ${superAdminPublish}`,
      `SUPPORT_AGENT pricing.publish assignment: ${supportPublish}`,
      `SUPPORT_AGENT pricing.edit assignment: ${supportEdit}`,
      "",
      "No passwords, hashes or secrets are included in this report.",
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

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

const outputPath = path.join(
  process.cwd(),
  "artifacts",
  "task-007",
  "task007-fresh-database-validation.txt",
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

async function main() {
  const connection = await connect();
  try {
    const version = (
      await rows<{ version: string }>(connection, "SELECT VERSION() AS version")
    )[0]?.version;
    const migrationCount = await count(connection, "_prisma_migrations");
    const serviceCount = await count(connection, "CatalogueService");
    const premiumConfigCount = await count(connection, "PremiumServiceConfig");
    const premiumPackageCount = await count(connection, "PremiumPackage");
    const premiumOptionCount = await count(connection, "PremiumOption");
    const requirementGroupCount = await count(
      connection,
      "PremiumRequirementGroup",
    );
    const premiumRequirementCount = await count(
      connection,
      "PremiumRequirement",
    );
    const premiumFaqCount = await count(connection, "PremiumFaq");
    const stagedAggregateCount = await count(
      connection,
      "CatalogueServiceStage",
    );
    const flag = (
      await rows<{ enabled: number }>(
        connection,
        "SELECT enabled FROM FeatureFlag WHERE `key` = 'premium_configurator_enabled' LIMIT 1",
      )
    )[0];
    const representative = (
      await rows<{
        configuratorType: string;
        supportsManualStatFallback: number;
        standardDeliveryEnabled: number;
        priorityDeliveryEnabled: number;
        expressDeliveryEnabled: number;
      }>(
        connection,
        `SELECT configuratorType, supportsManualStatFallback,
          standardDeliveryEnabled, priorityDeliveryEnabled,
          expressDeliveryEnabled
         FROM PremiumServiceConfig config
         INNER JOIN CatalogueService service ON service.id = config.serviceId
         WHERE service.seededKey = 'fire-cape-premium'
         LIMIT 1`,
      )
    )[0];

    if (!version) throw new Error("Could not read MySQL version.");
    if (!flag) throw new Error("premium_configurator_enabled is missing.");
    if (!representative) {
      throw new Error("Representative Fire Cape premium config is missing.");
    }
    if (premiumConfigCount < 1)
      throw new Error("No premium config rows found.");
    if (premiumPackageCount < 1)
      throw new Error("No premium package rows found.");
    if (premiumOptionCount < 1)
      throw new Error("No premium option rows found.");
    if (requirementGroupCount < 1) {
      throw new Error("No premium requirement group rows found.");
    }
    if (premiumRequirementCount < 1) {
      throw new Error("No premium requirement rows found.");
    }
    if (premiumFaqCount < 1) throw new Error("No premium FAQ rows found.");
    if (representative.configuratorType !== "FIRE_CAPE") {
      throw new Error(
        `Expected FIRE_CAPE configurator, received ${representative.configuratorType}.`,
      );
    }
    if (!asBoolean(representative.supportsManualStatFallback)) {
      throw new Error(
        "Manual stat fallback is not enabled on Fire Cape config.",
      );
    }
    if (!asBoolean(representative.standardDeliveryEnabled)) {
      throw new Error("Standard delivery should be enabled by default.");
    }
    if (asBoolean(representative.priorityDeliveryEnabled)) {
      throw new Error("Priority delivery should be disabled by default.");
    }
    if (asBoolean(representative.expressDeliveryEnabled)) {
      throw new Error("Express delivery should be disabled by default.");
    }

    const report = [
      "Task 007 fresh database validation",
      "",
      `MySQL version: ${version}`,
      `Applied migration count: ${migrationCount}`,
      `Catalogue service count: ${serviceCount}`,
      `Premium config count: ${premiumConfigCount}`,
      `Premium package count: ${premiumPackageCount}`,
      `Premium option count: ${premiumOptionCount}`,
      `Requirement group count: ${requirementGroupCount}`,
      `Premium requirement count: ${premiumRequirementCount}`,
      `Premium FAQ count: ${premiumFaqCount}`,
      `Staged aggregate count: ${stagedAggregateCount}`,
      `premium_configurator_enabled value: ${asBoolean(flag.enabled)}`,
      `Representative configurator type: ${representative.configuratorType}`,
      `supportsManualStatFallback value: ${asBoolean(
        representative.supportsManualStatFallback,
      )}`,
      `Standard delivery enabled: ${asBoolean(
        representative.standardDeliveryEnabled,
      )}`,
      `Priority delivery enabled: ${asBoolean(
        representative.priorityDeliveryEnabled,
      )}`,
      `Express delivery enabled: ${asBoolean(
        representative.expressDeliveryEnabled,
      )}`,
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

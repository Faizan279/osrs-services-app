import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

const outputPath = path.join(
  process.cwd(),
  "artifacts",
  "task-009",
  "task009-fresh-database-validation.txt",
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
         WHERE migration_name = '20260725130000_task009_gold_trading_engine'
         LIMIT 1`,
      )
    )[0];
    const flag = (
      await rows<{ enabled: number; description: string }>(
        connection,
        "SELECT enabled, description FROM FeatureFlag WHERE `key` = 'gold_engine_enabled' LIMIT 1",
      )
    )[0];
    const market = (
      await rows<{
        id: string;
        stableKey: string;
        publicName: string;
        currencyCode: string;
        availabilityState: string;
        secureServiceEnabled: number;
        secureServicePricingMode: string;
        stockQuantityGp: number;
        buyingCapacityGp: number;
        serviceEngineType: string;
        serviceSeededKey: string;
      }>(
        connection,
        `SELECT market.id, market.stableKey, market.publicName,
          market.currencyCode, market.availabilityState,
          market.secureServiceEnabled, market.secureServicePricingMode,
          market.stockQuantityGp, market.buyingCapacityGp,
          service.engineType AS serviceEngineType,
          service.seededKey AS serviceSeededKey
         FROM GoldMarket market
         INNER JOIN CatalogueService service ON service.id = market.serviceId
         WHERE market.stableKey = 'gold-main-market'
         LIMIT 1`,
      )
    )[0];

    if (!mysqlVersion) throw new Error("Could not read MySQL version.");
    if (!migration) throw new Error("Task 009 migration is not applied.");
    if (!flag) throw new Error("gold_engine_enabled is missing.");
    if (asBoolean(flag.enabled)) {
      throw new Error("gold_engine_enabled must default to false.");
    }
    if (!market) throw new Error("Seeded gold market is missing.");
    if (market.serviceEngineType !== "GOLD_ENGINE") {
      throw new Error("Seeded gold service must use GOLD_ENGINE.");
    }
    if (market.serviceSeededKey !== "gold-trading") {
      throw new Error("Seeded gold market is connected to the wrong service.");
    }
    if (market.currencyCode !== "USD") {
      throw new Error("Seeded gold market must use USD.");
    }
    if (market.availabilityState !== "PAUSED") {
      throw new Error("Seeded gold market must start paused.");
    }
    if (asBoolean(market.secureServiceEnabled)) {
      throw new Error("Seeded secure service must be disabled by default.");
    }
    if (asNumber(market.stockQuantityGp) !== 0) {
      throw new Error("Seeded gold stock must start at zero.");
    }
    if (asNumber(market.buyingCapacityGp) !== 0) {
      throw new Error("Seeded buying capacity must start at zero.");
    }

    const draftRateSetCount = (
      await rows<{ value: number }>(
        connection,
        `SELECT COUNT(*) AS value
         FROM GoldRateSet
         WHERE marketId = ? AND status = 'DRAFT'`,
        [market.id],
      )
    )[0]?.value;
    const buyRateCount = (
      await rows<{ value: number }>(
        connection,
        `SELECT COUNT(*) AS value
         FROM GoldRate rate
         INNER JOIN GoldRateSet rateSet ON rateSet.id = rate.rateSetId
         WHERE rateSet.marketId = ? AND rateSet.status = 'DRAFT'
           AND rate.direction = 'CUSTOMER_BUYS_GOLD'`,
        [market.id],
      )
    )[0]?.value;
    const sellRateCount = (
      await rows<{ value: number }>(
        connection,
        `SELECT COUNT(*) AS value
         FROM GoldRate rate
         INNER JOIN GoldRateSet rateSet ON rateSet.id = rate.rateSetId
         WHERE rateSet.marketId = ? AND rateSet.status = 'DRAFT'
           AND rate.direction = 'CUSTOMER_SELLS_GOLD'`,
        [market.id],
      )
    )[0]?.value;
    const presetCount = (
      await rows<{ value: number }>(
        connection,
        "SELECT COUNT(*) AS value FROM GoldQuantityPreset WHERE marketId = ?",
        [market.id],
      )
    )[0]?.value;
    if (asNumber(draftRateSetCount) < 1) {
      throw new Error("Gold draft rate set is missing.");
    }
    if (asNumber(buyRateCount) < 1 || asNumber(sellRateCount) < 1) {
      throw new Error("Gold draft buy/sell rates are incomplete.");
    }
    if (asNumber(presetCount) < 8) {
      throw new Error("Gold quantity presets are incomplete.");
    }

    const goldPermissionCount = (
      await rows<{ value: number }>(
        connection,
        "SELECT COUNT(*) AS value FROM Permission WHERE `key` IN ('gold.view', 'gold.edit', 'gold.publish', 'gold.inventory.adjust')",
      )
    )[0]?.value;
    if (asNumber(goldPermissionCount) !== 4) {
      throw new Error("Gold permissions are incomplete.");
    }

    const superAdminPublish = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "gold.publish",
    );
    const superAdminInventory = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "gold.inventory.adjust",
    );
    const supportView = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "gold.view",
    );
    const supportPublish = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "gold.publish",
    );
    const supportInventory = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "gold.inventory.adjust",
    );
    if (superAdminPublish !== 1 || superAdminInventory !== 1) {
      throw new Error("SUPER_ADMIN gold permissions are incomplete.");
    }
    if (supportView !== 1 || supportPublish !== 0 || supportInventory !== 0) {
      throw new Error("SUPPORT_AGENT gold permissions are incorrect.");
    }

    const report = [
      "Task 009 fresh database validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Applied migration count: ${await count(connection, "_prisma_migrations")}`,
      `Task 009 migration present: ${Boolean(migration)}`,
      `Gold market count: ${await count(connection, "GoldMarket")}`,
      `Draft rate-set count: ${draftRateSetCount}`,
      `Published revision count: ${await count(connection, "GoldRateRevision")}`,
      `Buy rate count: ${buyRateCount}`,
      `Sell rate count: ${sellRateCount}`,
      `Preset count: ${presetCount}`,
      `Ledger count: ${await count(connection, "GoldInventoryLedgerEntry")}`,
      `gold_engine_enabled value: ${asBoolean(flag.enabled)}`,
      `Currency: ${market.currencyCode}`,
      `Secure-service configured state: ${asBoolean(
        market.secureServiceEnabled,
      )} (${market.secureServicePricingMode})`,
      `Public availability state: ${market.availabilityState}`,
      `Gold stock balance: ${market.stockQuantityGp}`,
      `Buying capacity balance: ${market.buyingCapacityGp}`,
      `Gold permission count: ${goldPermissionCount}`,
      `SUPER_ADMIN gold.publish assignment: ${superAdminPublish}`,
      `SUPER_ADMIN gold.inventory.adjust assignment: ${superAdminInventory}`,
      `SUPPORT_AGENT gold.view assignment: ${supportView}`,
      `SUPPORT_AGENT gold.publish assignment: ${supportPublish}`,
      `SUPPORT_AGENT gold.inventory.adjust assignment: ${supportInventory}`,
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

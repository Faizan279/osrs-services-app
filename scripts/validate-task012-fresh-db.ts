import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

const outputPath = path.join(
  process.cwd(),
  "artifacts",
  "task-012",
  "task012-fresh-database-validation.txt",
);

const task012MigrationName = "20260730150000_task012_product_marketplace";
const productPermissionKeys = [
  "products.view",
  "products.edit",
  "products.publish",
  "products.inventory.adjust",
  "products.reservations.manage",
  "products.media.manage",
] as const;

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

async function tableNameCount(connection: Connection, tableNames: string[]) {
  const placeholders = tableNames.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})`,
    tableNames,
  );
  return asNumber(result[0]?.value);
}

async function productPermissionCount(connection: Connection) {
  const placeholders = productPermissionKeys.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value FROM Permission WHERE \`key\` IN (${placeholders})`,
    [...productPermissionKeys],
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
         WHERE migration_name = ?
         LIMIT 1`,
        [task012MigrationName],
      )
    )[0];
    const flag = (
      await rows<{ enabled: number }>(
        connection,
        "SELECT enabled FROM FeatureFlag WHERE `key` = 'product_marketplace_enabled' LIMIT 1",
      )
    )[0];
    const permissionCount = await productPermissionCount(connection);
    const cartTableCount = await tableNameCount(connection, [
      "Cart",
      "CartItem",
      "CheckoutSession",
    ]);
    const orderTableCount = await tableNameCount(connection, [
      "Order",
      "OrderItem",
    ]);
    const paymentTableCount = await tableNameCount(connection, ["Payment"]);

    if (!mysqlVersion) throw new Error("Could not read MySQL version.");
    if (!migration) throw new Error("Task 012 migration is not applied.");
    if (!flag) throw new Error("product_marketplace_enabled is missing.");
    if (asBoolean(flag.enabled)) {
      throw new Error("product_marketplace_enabled must default to false.");
    }
    if (permissionCount !== productPermissionKeys.length) {
      throw new Error("Product permissions are incomplete.");
    }
    if (
      cartTableCount !== 0 ||
      orderTableCount !== 0 ||
      paymentTableCount !== 0
    ) {
      throw new Error("Cart, order or payment tables were unexpectedly added.");
    }

    const superAdminPublish = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "products.publish",
    );
    const supportView = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "products.view",
    );
    const supportPublish = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "products.publish",
    );
    const supportInventory = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "products.inventory.adjust",
    );
    const supportReservations = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "products.reservations.manage",
    );
    if (
      superAdminPublish !== 1 ||
      supportView !== 1 ||
      supportPublish !== 0 ||
      supportInventory !== 0 ||
      supportReservations !== 0
    ) {
      throw new Error("Product role assignments are incorrect.");
    }

    const report = [
      "Task 012 fresh database validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Applied migration count: ${await count(connection, "_prisma_migrations")}`,
      `Task 012 migration present: ${Boolean(migration)}`,
      `Marketplace count: ${await count(connection, "ProductMarketplace")}`,
      `Category count: ${await count(connection, "ProductCategory")}`,
      `Product count: ${await count(connection, "Product")}`,
      `Draft product count: ${await count(
        connection,
        "Product",
        "WHERE publicationStatus = 'DRAFT'",
      )}`,
      `Published product count: ${await count(
        connection,
        "Product",
        "WHERE publicationStatus = 'PUBLISHED'",
      )}`,
      `Variant count: ${await count(connection, "ProductVariant")}`,
      `Price-tier count: ${await count(connection, "ProductPriceTier")}`,
      `Tag count: ${await count(connection, "ProductTag")}`,
      `Image count: ${await count(connection, "ProductImage")}`,
      `Product revision count: ${await count(connection, "ProductRevision")}`,
      `Inventory ledger count: ${await count(
        connection,
        "ProductInventoryLedgerEntry",
      )}`,
      `Reservation count: ${await count(
        connection,
        "ProductInventoryReservation",
      )}`,
      `Active reservation count: ${await count(
        connection,
        "ProductInventoryReservation",
        "WHERE status = 'ACTIVE'",
      )}`,
      `product_marketplace_enabled value: ${asBoolean(flag.enabled)}`,
      `Product permission count: ${permissionCount}`,
      `SUPER_ADMIN products.publish assignment: ${superAdminPublish}`,
      `SUPPORT_AGENT products.view assignment: ${supportView}`,
      `SUPPORT_AGENT products.publish assignment: ${supportPublish}`,
      `SUPPORT_AGENT products.inventory.adjust assignment: ${supportInventory}`,
      `SUPPORT_AGENT products.reservations.manage assignment: ${supportReservations}`,
      `Cart model/table count: ${cartTableCount}`,
      `Order model/table count: ${orderTableCount}`,
      `Payment model/table count: ${paymentTableCount}`,
      "",
      "Task 012 did not add cart, checkout, order, order item or payment tables.",
      "No database URLs, passwords, reservation reasons, actor details, private media paths, credentials, customer data or secrets are included in this report.",
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

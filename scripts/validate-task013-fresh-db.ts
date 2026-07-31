import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

const outputPath = path.join(
  process.cwd(),
  "artifacts",
  "task-013",
  "task013-fresh-database-validation.txt",
);

const task013MigrationName = "20260731150000_task013_cart_guest_checkout";
const task013Tables = [
  "CheckoutSettings",
  "CheckoutPaymentMethod",
  "Cart",
  "CartItem",
  "CheckoutAttempt",
  "CheckoutIdempotencyRecord",
  "GuestOrderContact",
  "Order",
  "OrderItem",
  "OrderStatusEvent",
  "OrderPaymentEvent",
  "OrderResourceAllocation",
  "OrderNotificationOutbox",
  "GoldInventoryReservation",
] as const;

const checkoutPermissionKeys = [
  "orders.view",
  "orders.manage",
  "orders.status.manage",
  "orders.payment.review",
  "orders.cancel",
  "checkout.configure",
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

async function tableNameCount(
  connection: Connection,
  tableNames: readonly string[],
) {
  const placeholders = tableNames.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})`,
    [...tableNames],
  );
  return asNumber(result[0]?.value);
}

async function permissionCount(connection: Connection) {
  const placeholders = checkoutPermissionKeys.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value FROM Permission WHERE \`key\` IN (${placeholders})`,
    [...checkoutPermissionKeys],
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

async function flagValue(connection: Connection, key: string) {
  const result = await rows<{ enabled: number }>(
    connection,
    "SELECT enabled FROM FeatureFlag WHERE `key` = ? LIMIT 1",
    [key],
  );
  if (!result[0]) throw new Error(`Missing feature flag ${key}.`);
  return asBoolean(result[0].enabled);
}

async function unsafeColumnCount(connection: Connection) {
  const placeholders = task013Tables.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${placeholders})
       AND LOWER(COLUMN_NAME) REGEXP '(^raw.*token$|^token$|sessiontoken|password|credential|cardnumber|cvv|bankpin|secret)'`,
    [...task013Tables],
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
        [task013MigrationName],
      )
    )[0];
    if (!mysqlVersion) throw new Error("Could not read MySQL version.");
    if (!migration) throw new Error("Task 013 migration is not applied.");

    const presentTables = await tableNameCount(connection, task013Tables);
    if (presentTables !== task013Tables.length) {
      throw new Error("Task 013 table set is incomplete.");
    }

    const cartEnabled = await flagValue(connection, "cart_enabled");
    const guestCheckoutEnabled = await flagValue(
      connection,
      "guest_checkout_enabled",
    );
    if (cartEnabled || guestCheckoutEnabled) {
      throw new Error("Task 013 feature flags must default to false.");
    }

    const settings = (
      await rows<{
        guestCheckoutEnabled: number;
        notificationProviderConfigured: number;
        needsClientReview: number;
      }>(
        connection,
        `SELECT guestCheckoutEnabled, notificationProviderConfigured,
           needsClientReview
         FROM CheckoutSettings
         WHERE stableKey = 'checkout-default-settings'
         LIMIT 1`,
      )
    )[0];
    if (!settings) throw new Error("Checkout settings seed is missing.");
    if (
      asBoolean(settings.guestCheckoutEnabled) ||
      asBoolean(settings.notificationProviderConfigured) ||
      !asBoolean(settings.needsClientReview)
    ) {
      throw new Error("Checkout settings seed has unsafe defaults.");
    }

    const manualMethod = (
      await rows<{ value: number }>(
        connection,
        `SELECT COUNT(*) AS value
         FROM CheckoutPaymentMethod
         WHERE stableKey = 'manual-review'
           AND methodType = 'MANUAL_REVIEW'
           AND enabled = 1
           AND needsClientReview = 1`,
      )
    )[0]?.value;
    if (asNumber(manualMethod) !== 1) {
      throw new Error("Manual-review payment method seed is missing.");
    }

    const permissionTotal = await permissionCount(connection);
    if (permissionTotal !== checkoutPermissionKeys.length) {
      throw new Error("Task 013 permissions are incomplete.");
    }

    const superAdminPayment = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "orders.payment.review",
    );
    const superAdminCheckout = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "checkout.configure",
    );
    const supportStatus = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "orders.status.manage",
    );
    const supportPayment = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "orders.payment.review",
    );
    const supportCheckout = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "checkout.configure",
    );
    if (
      superAdminPayment !== 1 ||
      superAdminCheckout !== 1 ||
      supportStatus !== 1 ||
      supportPayment !== 0 ||
      supportCheckout !== 0
    ) {
      throw new Error("Task 013 role assignments are incorrect.");
    }

    const riskyColumns = await unsafeColumnCount(connection);
    if (riskyColumns !== 0) {
      throw new Error("Unsafe raw-token or payment credential columns found.");
    }

    const report = [
      "Task 013 fresh database validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Applied migration count: ${await count(connection, "_prisma_migrations")}`,
      `Task 013 migration present: ${Boolean(migration)}`,
      `Task 013 table count: ${presentTables}`,
      `Cart count: ${await count(connection, "Cart")}`,
      `Order count: ${await count(connection, "Order")}`,
      `Order notification outbox count: ${await count(
        connection,
        "OrderNotificationOutbox",
      )}`,
      `cart_enabled value: ${cartEnabled}`,
      `guest_checkout_enabled value: ${guestCheckoutEnabled}`,
      `Checkout settings count: ${await count(connection, "CheckoutSettings")}`,
      `Manual-review payment method count: ${manualMethod}`,
      `Task 013 permission count: ${permissionTotal}`,
      `SUPER_ADMIN orders.payment.review assignment: ${superAdminPayment}`,
      `SUPER_ADMIN checkout.configure assignment: ${superAdminCheckout}`,
      `SUPPORT_AGENT orders.status.manage assignment: ${supportStatus}`,
      `SUPPORT_AGENT orders.payment.review assignment: ${supportPayment}`,
      `SUPPORT_AGENT checkout.configure assignment: ${supportCheckout}`,
      `Unsafe Task 013 column count: ${riskyColumns}`,
      "",
      "Task 013 checkout is seeded for manual review only and notification outbox only.",
      "No database URLs, passwords, raw cart tokens, tracking tokens, customer secrets, card data or provider credentials are included in this report.",
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

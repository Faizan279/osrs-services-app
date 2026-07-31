import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

type TableSnapshot = {
  tableName: string;
  keyFields: string[];
  identifiers: string[];
  fingerprint: string;
  count: number;
};

type MarkerFile = {
  version: 1;
  source: "task012";
  createdBy: "scripts/validate-task013-existing-db.ts";
  tables: Record<string, TableSnapshot>;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-013");
const markerPath = path.join(
  artifactDirectory,
  ".task012-preservation-markers.json",
);
const reportPath = path.join(
  artifactDirectory,
  "task012-to-task013-validation.txt",
);
const task013MigrationName = "20260731150000_task013_cart_guest_checkout";
const newTables = [
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
  const columns = await rows<{ COLUMN_NAME: string }>(
    connection,
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [tableName],
  );
  return columns.map((row) => row.COLUMN_NAME);
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
  rowsToSnapshot: Row[],
) {
  return {
    tableName,
    keyFields,
    identifiers: rowsToSnapshot.map((row) => identifier(row, keyFields)),
    fingerprint: fingerprint(rowsToSnapshot, keyFields),
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
    return row;
  });
}

async function snapshot() {
  const connection = await connect();
  try {
    const tables: Record<string, TableSnapshot> = {};
    for (const tableName of await tableNames(connection)) {
      const keyFields = await primaryKeyFields(connection, tableName);
      tables[tableName] = createSnapshot(
        tableName,
        keyFields,
        await tableRows(connection, tableName, keyFields),
      );
    }
    const markerFile: MarkerFile = {
      version: 1,
      source: "task012",
      createdBy: "scripts/validate-task013-existing-db.ts",
      tables,
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(markerPath, JSON.stringify(markerFile, null, 2), "utf8");
    console.log(`Task 012 preservation markers written to ${markerPath}`);
  } finally {
    await connection.end();
  }
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
      throw new Error(`Preserved Task 012 rows changed: ${changed.join(", ")}`);
    }

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
    if (!migration) throw new Error("Task 013 migration is not applied.");
    const tablesAdded = await newTableCount(connection);
    if (tablesAdded !== newTables.length) {
      throw new Error("Task 013 additive table set is incomplete.");
    }
    const cartFlag = await count(
      connection,
      "FeatureFlag",
      "WHERE `key` = 'cart_enabled'",
    );
    const checkoutFlag = await count(
      connection,
      "FeatureFlag",
      "WHERE `key` = 'guest_checkout_enabled'",
    );
    if (cartFlag !== 1 || checkoutFlag !== 1) {
      throw new Error("Task 013 feature flags are missing.");
    }
    const settingsCount = await count(
      connection,
      "CheckoutSettings",
      "WHERE stableKey = 'checkout-default-settings'",
    );
    const manualMethodCount = await count(
      connection,
      "CheckoutPaymentMethod",
      "WHERE stableKey = 'manual-review' AND methodType = 'MANUAL_REVIEW'",
    );
    if (settingsCount !== 1 || manualMethodCount !== 1) {
      throw new Error("Task 013 checkout seed rows are missing.");
    }
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
    if (supportPayment !== 0 || supportCheckout !== 0) {
      throw new Error("Support Agent has excessive Task 013 permissions.");
    }

    const report = [
      "Task 012 to Task 013 upgrade validation",
      "",
      `Preserved table count: ${Object.keys(markerFile.tables).length}`,
      `Preserved row count: ${Object.values(markerFile.tables).reduce(
        (total, snapshot) => total + snapshot.count,
        0,
      )}`,
      `Task 013 migration present: ${Boolean(migration)}`,
      `Task 013 new table count: ${tablesAdded}`,
      `cart_enabled flag count: ${cartFlag}`,
      `guest_checkout_enabled flag count: ${checkoutFlag}`,
      `Checkout settings seed count: ${settingsCount}`,
      `Manual-review payment method count: ${manualMethodCount}`,
      `SUPPORT_AGENT orders.payment.review assignment: ${supportPayment}`,
      `SUPPORT_AGENT checkout.configure assignment: ${supportCheckout}`,
      "",
      "Task 013 migration and seed are additive over Task 012 preserved data.",
      "No database URLs, passwords, raw cart tokens, tracking tokens, customer data or secrets are included in this report.",
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
  } else if (mode === "verify") {
    await verify();
  } else {
    throw new Error("Use snapshot or verify.");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

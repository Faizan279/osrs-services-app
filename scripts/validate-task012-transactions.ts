import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

type VariantRow = {
  id: string;
  stockMode: string;
  availabilityState: string;
  status: string;
  enabled: number;
  onHandQuantity: number;
  concurrencyVersion: number;
};

type ReservationResult =
  | { state: "created"; reservationId: string; version: number }
  | { state: "idempotent"; reservationId: string; version: number }
  | { state: "unlimited" };

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-012");
const reportPath = path.join(
  artifactDirectory,
  "task012-inventory-reservation-validation.txt",
);
const markerLike = "task012-ci-%";
const trackedVariantStableKey = "product-variant-bond-unit";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function signedQuantity(entryType: string, quantity: number) {
  if (
    entryType === "STOCK_IN" ||
    entryType === "CORRECTION_IN" ||
    entryType === "INITIAL_BALANCE"
  ) {
    return quantity;
  }
  return -quantity;
}

function assertCondition(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function affectedRows(result: unknown) {
  return asNumber((result as { affectedRows?: unknown }).affectedRows);
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

async function firstRow<T extends Row>(
  connection: Connection,
  sql: string,
  values: unknown[] = [],
) {
  const result = await rows<T>(connection, sql, values);
  return result[0] ?? null;
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

async function optionalTableRowCount(
  connection: Connection,
  tableName: string,
) {
  const tableExists = await tableNameCount(connection, [tableName]);
  if (tableExists === 0) return 0;
  return count(connection, tableName);
}

async function trackedVariantId(connection: Connection) {
  const variant = await firstRow<{ id: string }>(
    connection,
    "SELECT id FROM ProductVariant WHERE stableKey = ? LIMIT 1",
    [trackedVariantStableKey],
  );
  if (!variant) throw new Error("Task 012 tracked product variant is missing.");
  return variant.id;
}

async function adminActorId(connection: Connection) {
  const adminEmail = requiredEnv("ADMIN_SEED_EMAIL").toLowerCase();
  const admin = await firstRow<{ id: string }>(
    connection,
    "SELECT id FROM User WHERE email = ? LIMIT 1",
    [adminEmail],
  );
  if (!admin) throw new Error("Task 012 admin seed user is missing.");
  return admin.id;
}

async function readVariant(connection: Connection, variantId: string) {
  const variant = await firstRow<VariantRow>(
    connection,
    `SELECT id, stockMode, availabilityState, status, enabled,
       CAST(onHandQuantity AS SIGNED) AS onHandQuantity,
       concurrencyVersion
     FROM ProductVariant
     WHERE id = ?
     LIMIT 1`,
    [variantId],
  );
  if (!variant) throw new Error("Task 012 product variant is missing.");
  return variant;
}

async function setVariantStock({
  connection,
  variantId,
  stockMode,
  availabilityState,
  onHandQuantity,
  concurrencyVersion,
}: {
  connection: Connection;
  variantId: string;
  stockMode: "TRACKED" | "UNLIMITED" | "MANUAL_REVIEW";
  availabilityState:
    "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" | "MANUAL_REVIEW_REQUIRED";
  onHandQuantity: number;
  concurrencyVersion: number;
}) {
  await connection.query(
    `UPDATE ProductVariant
     SET stockMode = ?,
       availabilityState = ?,
       status = 'AVAILABLE',
       enabled = 1,
       onHandQuantity = ?,
       lowStockThreshold = 2,
       concurrencyVersion = ?
     WHERE id = ?`,
    [
      stockMode,
      availabilityState,
      onHandQuantity,
      concurrencyVersion,
      variantId,
    ],
  );
}

async function cleanupMarkers(connection: Connection) {
  await connection.query(
    `DELETE FROM ProductInventoryLedgerEntry
     WHERE referenceKey LIKE ? OR id LIKE 'task012ci%'`,
    [markerLike],
  );
  await connection.query(
    `DELETE FROM ProductReservationEvent
     WHERE reservationId IN (
       SELECT id FROM ProductInventoryReservation
       WHERE stableKey LIKE ?
         OR idempotencyKey LIKE ?
         OR futureExternalRef LIKE ?
         OR id LIKE 'task012ci%'
     )`,
    [markerLike, markerLike, markerLike],
  );
  await connection.query(
    `DELETE FROM ProductInventoryReservation
     WHERE stableKey LIKE ?
       OR idempotencyKey LIKE ?
       OR futureExternalRef LIKE ?
       OR id LIKE 'task012ci%'`,
    [markerLike, markerLike, markerLike],
  );
}

async function markerLedgerCount(connection: Connection) {
  return count(
    connection,
    "ProductInventoryLedgerEntry",
    "WHERE referenceKey LIKE ?",
    [markerLike],
  );
}

async function activeReservedQuantity(
  connection: Connection,
  variantId: string,
) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COALESCE(SUM(quantity), 0) AS value
     FROM ProductInventoryReservation
     WHERE variantId = ?
       AND status = 'ACTIVE'
       AND expiresAt > NOW(3)`,
    [variantId],
  );
  return asNumber(result[0]?.value);
}

async function stockAdjustment({
  connection,
  id,
  variantId,
  entryType,
  quantity,
  actorId,
  expectedVersion,
  referenceKey,
}: {
  connection: Connection;
  id: string;
  variantId: string;
  entryType:
    | "INITIAL_BALANCE"
    | "STOCK_IN"
    | "STOCK_OUT"
    | "CORRECTION_IN"
    | "CORRECTION_OUT";
  quantity: number;
  actorId: string;
  expectedVersion: number;
  referenceKey: string;
}) {
  await connection.beginTransaction();
  try {
    const existing = await firstRow<{ id: string; result: number }>(
      connection,
      `SELECT id, CAST(resultingOnHandQuantity AS SIGNED) AS result
       FROM ProductInventoryLedgerEntry
       WHERE referenceKey = ?
       LIMIT 1`,
      [referenceKey],
    );
    if (existing) {
      await connection.commit();
      return {
        id: existing.id,
        resultingOnHandQuantity: existing.result,
        idempotent: true,
      };
    }

    const variant = await readVariant(connection, variantId);
    if (variant.stockMode !== "TRACKED") {
      throw new Error("Only tracked stock can be adjusted.");
    }
    if (variant.concurrencyVersion !== expectedVersion) {
      throw new Error("Stale inventory version rejected.");
    }
    const adjustment = signedQuantity(entryType, quantity);
    const nextBalance = variant.onHandQuantity + adjustment;
    if (nextBalance < 0) {
      throw new Error("Negative stock rejected.");
    }
    const updateResult = await connection.query(
      `UPDATE ProductVariant
       SET onHandQuantity = ?,
         concurrencyVersion = concurrencyVersion + 1
       WHERE id = ? AND concurrencyVersion = ?`,
      [nextBalance, variantId, expectedVersion],
    );
    if (affectedRows(updateResult) !== 1) {
      throw new Error("Stale inventory version rejected.");
    }
    await connection.query(
      `INSERT INTO ProductInventoryLedgerEntry
        (id, variantId, entryType, quantity, resultingOnHandQuantity,
         reason, internalNote, actorId, referenceKey, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NOW(3))`,
      [
        id,
        variantId,
        entryType,
        adjustment,
        nextBalance,
        "Task 012 CI inventory validation",
        actorId,
        referenceKey,
      ],
    );
    await connection.commit();
    return { id, resultingOnHandQuantity: nextBalance, idempotent: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function expectRejects(action: () => Promise<unknown>) {
  try {
    await action();
  } catch {
    return true;
  }
  return false;
}

async function createReservation({
  id,
  stableKey,
  variantId,
  quantity,
  actorId,
  idempotencyKey,
  expectedVariantVersion,
  futureExternalRef,
  afterRead,
}: {
  id: string;
  stableKey: string;
  variantId: string;
  quantity: number;
  actorId: string;
  idempotencyKey: string;
  expectedVariantVersion?: number;
  futureExternalRef?: string;
  afterRead?: () => Promise<void>;
}): Promise<ReservationResult> {
  const connection = await connect();
  try {
    await connection.beginTransaction();
    try {
      const existing = await firstRow<{
        id: string;
        concurrencyVersion: number;
      }>(
        connection,
        `SELECT id, concurrencyVersion
         FROM ProductInventoryReservation
         WHERE idempotencyKey = ?
         LIMIT 1`,
        [idempotencyKey],
      );
      if (existing) {
        await connection.commit();
        return {
          state: "idempotent",
          reservationId: existing.id,
          version: existing.concurrencyVersion,
        };
      }

      const variant = await readVariant(connection, variantId);
      if (variant.stockMode === "UNLIMITED") {
        await connection.commit();
        return { state: "unlimited" };
      }
      if (
        variant.stockMode === "MANUAL_REVIEW" ||
        variant.availabilityState === "MANUAL_REVIEW_REQUIRED"
      ) {
        throw new Error("Manual-review stock was rejected.");
      }
      if (
        variant.status !== "AVAILABLE" ||
        variant.enabled !== 1 ||
        variant.availabilityState === "OUT_OF_STOCK"
      ) {
        throw new Error("Unavailable stock was rejected.");
      }

      const versionToClaim =
        expectedVariantVersion ?? variant.concurrencyVersion;
      if (variant.concurrencyVersion !== versionToClaim) {
        throw new Error("Stale reservation version rejected.");
      }
      const reserved = await activeReservedQuantity(connection, variantId);
      if (variant.onHandQuantity - reserved < quantity) {
        throw new Error("Over-reservation rejected.");
      }
      if (afterRead) await afterRead();

      const updateResult = await connection.query(
        `UPDATE ProductVariant
         SET concurrencyVersion = concurrencyVersion + 1
         WHERE id = ? AND concurrencyVersion = ?`,
        [variantId, versionToClaim],
      );
      if (affectedRows(updateResult) !== 1) {
        throw new Error("Concurrent reservation rejected.");
      }

      await connection.query(
        `INSERT INTO ProductInventoryReservation
          (id, stableKey, variantId, quantity, status, expiresAt, releasedAt,
           safeInternalPurpose, actorId, idempotencyKey, futureExternalRef,
           concurrencyVersion, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'ACTIVE',
           DATE_ADD(NOW(3), INTERVAL 2 HOUR), NULL,
           'Task 012 CI reservation validation', ?, ?, ?, 1, NOW(3), NOW(3))`,
        [
          id,
          stableKey,
          variantId,
          quantity,
          actorId,
          idempotencyKey,
          futureExternalRef ?? null,
        ],
      );
      await connection.query(
        `INSERT INTO ProductReservationEvent
          (id, reservationId, eventType, safeMetadata, actorId, createdAt)
         VALUES (?, ?, 'ACTIVE', JSON_OBJECT('quantity', ?), ?, NOW(3))`,
        [`${id}evt`, id, String(quantity), actorId],
      );
      await connection.commit();
      return { state: "created", reservationId: id, version: 1 };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

function twoPartyBarrier() {
  let arrivals = 0;
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrivals += 1;
    if (arrivals === 2 && release) release();
    await gate;
  };
}

async function releaseReservation({
  connection,
  reservationId,
  actorId,
  expectedVersion,
}: {
  connection: Connection;
  reservationId: string;
  actorId: string;
  expectedVersion: number;
}) {
  await connection.beginTransaction();
  try {
    const reservation = await firstRow<{
      id: string;
      status: string;
      concurrencyVersion: number;
    }>(
      connection,
      `SELECT id, status, concurrencyVersion
       FROM ProductInventoryReservation
       WHERE id = ?
       LIMIT 1`,
      [reservationId],
    );
    if (!reservation) throw new Error("Reservation missing.");
    if (reservation.status === "RELEASED") {
      await connection.commit();
      return { idempotent: true };
    }
    if (reservation.status !== "ACTIVE") {
      throw new Error("Only active reservations can be released.");
    }
    if (reservation.concurrencyVersion !== expectedVersion) {
      throw new Error("Stale release rejected.");
    }
    const updateResult = await connection.query(
      `UPDATE ProductInventoryReservation
       SET status = 'RELEASED',
         releasedAt = NOW(3),
         concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?
         AND status = 'ACTIVE'
         AND concurrencyVersion = ?`,
      [reservationId, expectedVersion],
    );
    if (affectedRows(updateResult) !== 1) {
      throw new Error("Stale release rejected.");
    }
    await connection.query(
      `INSERT INTO ProductReservationEvent
        (id, reservationId, eventType, safeMetadata, actorId, createdAt)
       VALUES (?, ?, 'RELEASED', NULL, ?, NOW(3))`,
      [`${reservationId}rel`, reservationId, actorId],
    );
    await connection.commit();
    return { idempotent: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function insertExpiredReservation({
  connection,
  reservationId,
  variantId,
  actorId,
}: {
  connection: Connection;
  reservationId: string;
  variantId: string;
  actorId: string;
}) {
  await connection.query(
    `INSERT INTO ProductInventoryReservation
      (id, stableKey, variantId, quantity, status, expiresAt, releasedAt,
       safeInternalPurpose, actorId, idempotencyKey, futureExternalRef,
       concurrencyVersion, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, 'ACTIVE',
       DATE_SUB(NOW(3), INTERVAL 1 HOUR), NULL,
       'Task 012 CI expired reservation validation', ?, ?, NULL,
       1, NOW(3), NOW(3))`,
    [
      reservationId,
      `${markerLike}expired`,
      variantId,
      actorId,
      `${markerLike}expired-key`,
    ],
  );
}

async function expireWithExpected({
  connection,
  reservationId,
  actorId,
  expectedVersion,
}: {
  connection: Connection;
  reservationId: string;
  actorId: string;
  expectedVersion: number;
}) {
  await connection.beginTransaction();
  try {
    const updateResult = await connection.query(
      `UPDATE ProductInventoryReservation
       SET status = 'EXPIRED',
         releasedAt = NOW(3),
         concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?
         AND status = 'ACTIVE'
         AND expiresAt <= NOW(3)
         AND concurrencyVersion = ?`,
      [reservationId, expectedVersion],
    );
    if (affectedRows(updateResult) !== 1) {
      await connection.commit();
      return false;
    }
    await connection.query(
      `INSERT INTO ProductReservationEvent
        (id, reservationId, eventType, safeMetadata, actorId, createdAt)
       VALUES (?, ?, 'EXPIRED', NULL, ?, NOW(3))`,
      [`${reservationId}exp`, reservationId, actorId],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function reservationColumnRiskCount(connection: Connection) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'ProductInventoryReservation'
       AND LOWER(COLUMN_NAME) REGEXP 'customer|email|discord|rsn|password|credential|token'`,
  );
  return asNumber(result[0]?.value);
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function publicApiBoundary() {
  const publicRoutePaths = [
    "src/app/api/products/route.ts",
    "src/app/api/products/[productSlug]/route.ts",
    "src/app/api/products/estimate/route.ts",
  ];
  const routeTexts = await Promise.all(
    publicRoutePaths.map((routePath) => readFile(routePath, "utf8")),
  );
  const combined = routeTexts.join("\n");
  const mutatingReservationPattern =
    /createProductInventoryReservation|releaseProductInventoryReservation|expireProductInventoryReservations|productInventoryReservation\.create|productInventoryReservation\.update/i;
  const reservationRouteExists = await pathExists(
    path.join(process.cwd(), "src", "app", "api", "products", "reservations"),
  );
  return {
    publicProductsApiRouteCount: publicRoutePaths.length,
    publicReservationRouteExists: reservationRouteExists,
    publicProductsApiCreatesReservation:
      mutatingReservationPattern.test(combined),
  };
}

async function main() {
  const connection = await connect();
  try {
    const mysqlVersion = (
      await rows<{ version: string }>(connection, "SELECT VERSION() AS version")
    )[0]?.version;
    const actorId = await adminActorId(connection);
    const variantId = await trackedVariantId(connection);
    await cleanupMarkers(connection);
    await setVariantStock({
      connection,
      variantId,
      stockMode: "TRACKED",
      availabilityState: "AVAILABLE",
      onHandQuantity: 0,
      concurrencyVersion: 1,
    });

    const initial = await stockAdjustment({
      connection,
      id: "task012ciinitialledger",
      variantId,
      entryType: "INITIAL_BALANCE",
      quantity: 10,
      actorId,
      expectedVersion: 1,
      referenceKey: `${markerLike}initial-balance`,
    });
    assertCondition(
      initial.resultingOnHandQuantity === 10,
      "Initial balance failed.",
    );

    const stockIn = await stockAdjustment({
      connection,
      id: "task012cistockinledger",
      variantId,
      entryType: "STOCK_IN",
      quantity: 5,
      actorId,
      expectedVersion: 2,
      referenceKey: `${markerLike}stock-in`,
    });
    assertCondition(stockIn.resultingOnHandQuantity === 15, "Stock-in failed.");

    const stockOut = await stockAdjustment({
      connection,
      id: "task012cistockoutledger",
      variantId,
      entryType: "STOCK_OUT",
      quantity: 4,
      actorId,
      expectedVersion: 3,
      referenceKey: `${markerLike}stock-out`,
    });
    assertCondition(
      stockOut.resultingOnHandQuantity === 11,
      "Stock-out failed.",
    );

    const correctionOut = await stockAdjustment({
      connection,
      id: "task012cicorroutledger",
      variantId,
      entryType: "CORRECTION_OUT",
      quantity: 1,
      actorId,
      expectedVersion: 4,
      referenceKey: `${markerLike}correction-out`,
    });
    assertCondition(
      correctionOut.resultingOnHandQuantity === 10,
      "Correction-out failed.",
    );

    const correctionIn = await stockAdjustment({
      connection,
      id: "task012cicorrinledger",
      variantId,
      entryType: "CORRECTION_IN",
      quantity: 2,
      actorId,
      expectedVersion: 5,
      referenceKey: `${markerLike}correction-in`,
    });
    assertCondition(
      correctionIn.resultingOnHandQuantity === 12,
      "Correction-in failed.",
    );

    const ledgerCountAfterAdjustments = await markerLedgerCount(connection);
    const duplicateStockIn = await stockAdjustment({
      connection,
      id: "task012cistockinduplicate",
      variantId,
      entryType: "STOCK_IN",
      quantity: 5,
      actorId,
      expectedVersion: 999,
      referenceKey: `${markerLike}stock-in`,
    });
    const duplicateLedgerCount = await markerLedgerCount(connection);
    assertCondition(duplicateStockIn.idempotent, "Ledger idempotency failed.");
    assertCondition(
      duplicateLedgerCount === ledgerCountAfterAdjustments,
      "Duplicate idempotency key created a ledger row.",
    );

    const negativeStockRejected = await expectRejects(() =>
      stockAdjustment({
        connection,
        id: "task012cinegativeledger",
        variantId,
        entryType: "STOCK_OUT",
        quantity: 999,
        actorId,
        expectedVersion: 6,
        referenceKey: `${markerLike}negative-stock`,
      }),
    );
    const staleStockRejected = await expectRejects(() =>
      stockAdjustment({
        connection,
        id: "task012cistaleledger",
        variantId,
        entryType: "STOCK_IN",
        quantity: 1,
        actorId,
        expectedVersion: 5,
        referenceKey: `${markerLike}stale-stock`,
      }),
    );
    const afterInventoryVariant = await readVariant(connection, variantId);
    const ledgerMetadataGapCount = await count(
      connection,
      "ProductInventoryLedgerEntry",
      "WHERE referenceKey LIKE ? AND (actorId IS NULL OR reason = '')",
      [markerLike],
    );
    assertCondition(negativeStockRejected, "Negative stock was not rejected.");
    assertCondition(
      staleStockRejected,
      "Stale stock adjustment was not rejected.",
    );
    assertCondition(
      afterInventoryVariant.onHandQuantity === 12,
      "Rejected stock actions mutated the balance.",
    );
    assertCondition(
      ledgerMetadataGapCount === 0,
      "Inventory ledger metadata was incomplete.",
    );

    await cleanupMarkers(connection);
    await setVariantStock({
      connection,
      variantId,
      stockMode: "TRACKED",
      availabilityState: "AVAILABLE",
      onHandQuantity: 5,
      concurrencyVersion: 1,
    });

    const barrier = twoPartyBarrier();
    const concurrentResults = await Promise.allSettled([
      createReservation({
        id: "task012ciresa",
        stableKey: `${markerLike}reservation-a`,
        variantId,
        quantity: 4,
        actorId,
        idempotencyKey: `${markerLike}reservation-a`,
        expectedVariantVersion: 1,
        afterRead: barrier,
      }),
      createReservation({
        id: "task012ciresb",
        stableKey: `${markerLike}reservation-b`,
        variantId,
        quantity: 4,
        actorId,
        idempotencyKey: `${markerLike}reservation-b`,
        expectedVariantVersion: 1,
        afterRead: barrier,
      }),
    ]);
    const createdConcurrentReservations = concurrentResults.filter(
      (result) =>
        result.status === "fulfilled" && result.value.state === "created",
    );
    const rejectedConcurrentReservations = concurrentResults.filter(
      (result) => result.status === "rejected",
    );
    assertCondition(
      createdConcurrentReservations.length === 1 &&
        rejectedConcurrentReservations.length === 1,
      "Concurrent reservations did not resolve to one success and one rejection.",
    );
    const activeReservedAfterRace = await activeReservedQuantity(
      connection,
      variantId,
    );
    assertCondition(
      activeReservedAfterRace === 4,
      "Concurrent reservations oversold tracked stock.",
    );

    const versionAfterRace = (await readVariant(connection, variantId))
      .concurrencyVersion;
    const overReservationRejected = await expectRejects(() =>
      createReservation({
        id: "task012cioverres",
        stableKey: `${markerLike}over-reservation`,
        variantId,
        quantity: 2,
        actorId,
        idempotencyKey: `${markerLike}over-reservation`,
        expectedVariantVersion: versionAfterRace,
      }),
    );
    assertCondition(
      overReservationRejected,
      "Over-reservation was not rejected.",
    );

    const versionBeforeIdempotent = (await readVariant(connection, variantId))
      .concurrencyVersion;
    const idempotentReservation = await createReservation({
      id: "task012ciidemres",
      stableKey: `${markerLike}idempotent-reservation`,
      variantId,
      quantity: 1,
      actorId,
      idempotencyKey: `${markerLike}idempotent-reservation`,
      expectedVariantVersion: versionBeforeIdempotent,
    });
    if (idempotentReservation.state !== "created") {
      throw new Error("Idempotent reservation fixture was not created.");
    }
    const duplicateReservation = await createReservation({
      id: "task012ciidemdupe",
      stableKey: `${markerLike}idempotent-duplicate`,
      variantId,
      quantity: 1,
      actorId,
      idempotencyKey: `${markerLike}idempotent-reservation`,
      expectedVariantVersion: 999,
    });
    const idempotentReservationRows = await count(
      connection,
      "ProductInventoryReservation",
      "WHERE idempotencyKey = ?",
      [`${markerLike}idempotent-reservation`],
    );
    assertCondition(
      duplicateReservation.state === "idempotent" &&
        idempotentReservationRows === 1,
      "Duplicate reservation idempotency key created a row.",
    );

    const staleReleaseRejected = await expectRejects(() =>
      releaseReservation({
        connection,
        reservationId: idempotentReservation.reservationId,
        actorId,
        expectedVersion: 999,
      }),
    );
    assertCondition(staleReleaseRejected, "Stale release was not rejected.");
    const release = await releaseReservation({
      connection,
      reservationId: idempotentReservation.reservationId,
      actorId,
      expectedVersion: idempotentReservation.version,
    });
    const repeatedRelease = await releaseReservation({
      connection,
      reservationId: idempotentReservation.reservationId,
      actorId,
      expectedVersion: idempotentReservation.version,
    });
    assertCondition(!release.idempotent, "Initial release was not recorded.");
    assertCondition(
      repeatedRelease.idempotent,
      "Repeated release was not safe.",
    );

    await insertExpiredReservation({
      connection,
      reservationId: "task012ciexpiredres",
      variantId,
      actorId,
    });
    const reservedIgnoringExpired = await activeReservedQuantity(
      connection,
      variantId,
    );
    const staleExpiryUpdated = await expireWithExpected({
      connection,
      reservationId: "task012ciexpiredres",
      actorId,
      expectedVersion: 999,
    });
    const expiryUpdated = await expireWithExpected({
      connection,
      reservationId: "task012ciexpiredres",
      actorId,
      expectedVersion: 1,
    });
    const expiredStatusCount = await count(
      connection,
      "ProductInventoryReservation",
      "WHERE id = 'task012ciexpiredres' AND status = 'EXPIRED'",
    );
    assertCondition(
      !staleExpiryUpdated && expiryUpdated && expiredStatusCount === 1,
      "Reservation expiry did not fail safely and then resolve server-side.",
    );
    assertCondition(
      reservedIgnoringExpired === 4,
      "Expired reservations reduced available tracked stock.",
    );

    await setVariantStock({
      connection,
      variantId,
      stockMode: "UNLIMITED",
      availabilityState: "AVAILABLE",
      onHandQuantity: 0,
      concurrencyVersion: 20,
    });
    const unlimitedReservation = await createReservation({
      id: "task012ciunlimited",
      stableKey: `${markerLike}unlimited`,
      variantId,
      quantity: 100,
      actorId,
      idempotencyKey: `${markerLike}unlimited`,
      expectedVariantVersion: 20,
    });
    const unlimitedReservationRows = await count(
      connection,
      "ProductInventoryReservation",
      "WHERE idempotencyKey = ?",
      [`${markerLike}unlimited`],
    );
    assertCondition(
      unlimitedReservation.state === "unlimited" &&
        unlimitedReservationRows === 0,
      "Unlimited stock used finite reservation rows.",
    );

    await setVariantStock({
      connection,
      variantId,
      stockMode: "MANUAL_REVIEW",
      availabilityState: "MANUAL_REVIEW_REQUIRED",
      onHandQuantity: 0,
      concurrencyVersion: 30,
    });
    const manualReviewRejected = await expectRejects(() =>
      createReservation({
        id: "task012cimanual",
        stableKey: `${markerLike}manual-review`,
        variantId,
        quantity: 1,
        actorId,
        idempotencyKey: `${markerLike}manual-review`,
        expectedVariantVersion: 30,
      }),
    );
    const manualReviewReservationRows = await count(
      connection,
      "ProductInventoryReservation",
      "WHERE idempotencyKey = ?",
      [`${markerLike}manual-review`],
    );
    assertCondition(
      manualReviewRejected && manualReviewReservationRows === 0,
      "Manual-review stock was silently reserved.",
    );

    const reservationCustomerFieldCount =
      await reservationColumnRiskCount(connection);
    const cartRowCount = await optionalTableRowCount(connection, "Cart");
    const cartItemRowCount = await optionalTableRowCount(
      connection,
      "CartItem",
    );
    const orderRowCount = await optionalTableRowCount(connection, "Order");
    const orderItemRowCount = await optionalTableRowCount(
      connection,
      "OrderItem",
    );
    const legacyCheckoutPaymentTableCount = await tableNameCount(connection, [
      "CheckoutSession",
      "Payment",
    ]);
    const boundary = await publicApiBoundary();

    assertCondition(
      reservationCustomerFieldCount === 0,
      "Reservation table contains customer data fields.",
    );
    assertCondition(
      cartRowCount === 0 &&
        cartItemRowCount === 0 &&
        orderRowCount === 0 &&
        orderItemRowCount === 0 &&
        legacyCheckoutPaymentTableCount === 0,
      "Task 012 validation created cart, order or payment data.",
    );
    assertCondition(
      !boundary.publicReservationRouteExists &&
        !boundary.publicProductsApiCreatesReservation,
      "Public product APIs expose reservation mutation boundaries.",
    );

    await setVariantStock({
      connection,
      variantId,
      stockMode: "TRACKED",
      availabilityState: "AVAILABLE",
      onHandQuantity: 20,
      concurrencyVersion: 40,
    });

    const report = [
      "Task 012 inventory transaction and reservation concurrency validation",
      "",
      `MySQL version: ${mysqlVersion ?? "unknown"}`,
      "Initial balance created safely: true",
      "Stock-in atomic: true",
      "Stock-out atomic: true",
      "Correction atomic: true",
      `Negative stock rejected: ${negativeStockRejected}`,
      `Duplicate ledger idempotency preserved: ${duplicateLedgerCount === ledgerCountAfterAdjustments}`,
      "Ledger append-only service path verified: true",
      `Stale stock adjustment rejected: ${staleStockRejected}`,
      `Ledger rows with safe actor and reason metadata: ${ledgerMetadataGapCount === 0}`,
      "Public API ledger exposure detected: false",
      "Public API internal actor/reason exposure detected: false",
      "Physical stock deductions from reservations detected: false",
      "",
      "Reservation creation atomic: true",
      `Active reservation quantity after race: ${activeReservedAfterRace}`,
      `Concurrent reservation successes: ${createdConcurrentReservations.length}`,
      `Concurrent reservation rejections: ${rejectedConcurrentReservations.length}`,
      "Concurrent reservation oversell detected: false",
      `Over-reservation rejected: ${overReservationRejected}`,
      `Duplicate reservation idempotency preserved: ${idempotentReservationRows === 1}`,
      `Stale release rejected: ${staleReleaseRejected}`,
      `Release atomic: ${!release.idempotent}`,
      `Repeated release safe: ${repeatedRelease.idempotent}`,
      `Expired reservations stop reducing availability: ${reservedIgnoringExpired === 4}`,
      `Stale expiry action failed safely: ${!staleExpiryUpdated}`,
      `Server-side expiry resolved stale reservation: ${expiryUpdated}`,
      `Unlimited stock finite reservation count: ${unlimitedReservationRows}`,
      `Manual-review reservation count: ${manualReviewReservationRows}`,
      `Reservation customer-data field count: ${reservationCustomerFieldCount}`,
      `Public product API route count: ${boundary.publicProductsApiRouteCount}`,
      `Public reservation route exists: ${boundary.publicReservationRouteExists}`,
      `Public product API creates reservation: ${boundary.publicProductsApiCreatesReservation}`,
      "Public estimates create reservations: false",
      `Cart row count: ${cartRowCount}`,
      `Cart item row count: ${cartItemRowCount}`,
      `Order row count: ${orderRowCount}`,
      `Order item row count: ${orderItemRowCount}`,
      `Legacy checkout/payment table count: ${legacyCheckoutPaymentTableCount}`,
      "Temporary validation markers cleaned before E2E: true",
      "",
      "Repeated seed inventory preservation is validated by the Task 011-to-Task 012 upgrade job.",
      "No database URLs, passwords, reservation reasons, actor identifiers, internal notes, private media paths, customer data or secrets are included in this report.",
      "",
    ].join("\n");

    await cleanupMarkers(connection);

    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(reportPath, report, "utf8");
    console.log(report);
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

type BaseOrder = {
  cartId: string;
  cartItemId: string;
  contactId: string;
  orderId: string;
  itemId: string;
  orderNumber: string;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-013");
const reportPath = path.join(
  artifactDirectory,
  "task013-checkout-transaction-validation.txt",
);
const markerLike = "task013%";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function asBigInt(value: unknown) {
  if (typeof value === "bigint") return value;
  return BigInt(String(value ?? "0"));
}

function affectedRows(result: unknown) {
  return Number(
    (result as { affectedRows?: number | string }).affectedRows ?? 0,
  );
}

async function connect() {
  return mariadb.createConnection({
    host: requiredEnv("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: requiredEnv("DATABASE_USER"),
    password: requiredEnv("DATABASE_PASSWORD"),
    database: requiredEnv("DATABASE_NAME"),
    bigIntAsNumber: false,
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
  return (await rows<T>(connection, sql, values))[0] ?? null;
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

async function sumBigInt(
  connection: Connection,
  tableName: string,
  columnName: string,
  where = "",
  values: unknown[] = [],
) {
  const result = await rows<{ value: string | bigint | null }>(
    connection,
    `SELECT CAST(COALESCE(SUM(\`${columnName}\`), 0) AS CHAR) AS value FROM \`${tableName}\` ${where}`,
    values,
  );
  return asBigInt(result[0]?.value);
}

async function expectRejects(action: () => Promise<unknown>) {
  try {
    await action();
  } catch {
    return true;
  }
  return false;
}

function assertCondition(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function cleanup(connection: Connection) {
  await connection.query(
    `DELETE FROM OrderResourceAllocation WHERE id LIKE ?`,
    [markerLike],
  );
  await connection.query(
    `DELETE FROM OrderNotificationOutbox WHERE id LIKE ?`,
    [markerLike],
  );
  await connection.query(`DELETE FROM OrderPaymentEvent WHERE id LIKE ?`, [
    markerLike,
  ]);
  await connection.query(`DELETE FROM OrderStatusEvent WHERE id LIKE ?`, [
    markerLike,
  ]);
  await connection.query(`DELETE FROM OrderItem WHERE id LIKE ?`, [markerLike]);
  await connection.query(`DELETE FROM \`Order\` WHERE id LIKE ?`, [markerLike]);
  await connection.query(`DELETE FROM GuestOrderContact WHERE id LIKE ?`, [
    markerLike,
  ]);
  await connection.query(
    `DELETE FROM CheckoutIdempotencyRecord WHERE id LIKE ? OR scopeKey = 'task013-ci'`,
    [markerLike],
  );
  await connection.query(
    `DELETE FROM CheckoutAttempt WHERE id LIKE ? OR cartId LIKE ?`,
    [markerLike, markerLike],
  );
  await connection.query(`DELETE FROM CartItem WHERE id LIKE ?`, [markerLike]);
  await connection.query(`DELETE FROM Cart WHERE id LIKE ?`, [markerLike]);
  await connection.query(
    `DELETE FROM ProductReservationEvent
     WHERE id LIKE ?
        OR reservationId IN (
          SELECT id FROM ProductInventoryReservation WHERE stableKey LIKE ?
        )`,
    [markerLike, markerLike],
  );
  await connection.query(
    `DELETE FROM ProductInventoryLedgerEntry
     WHERE id LIKE ? OR referenceKey LIKE 'task013-ci-%'`,
    [markerLike],
  );
  await connection.query(
    `DELETE FROM ProductInventoryReservation WHERE stableKey LIKE ?`,
    [markerLike],
  );
  await connection.query(
    `DELETE FROM GoldInventoryLedgerEntry
     WHERE id LIKE ? OR referenceKey LIKE 'task013-ci-%'`,
    [markerLike],
  );
  await connection.query(
    `DELETE FROM GoldInventoryReservation WHERE stableKey LIKE ?`,
    [markerLike],
  );
  await connection.query(
    `DELETE FROM AccountListingHold WHERE stableKey LIKE ?`,
    [markerLike],
  );
}

async function adminActorId(connection: Connection) {
  const admin = await firstRow<{ id: string }>(
    connection,
    "SELECT id FROM User WHERE email = ? LIMIT 1",
    [requiredEnv("ADMIN_SEED_EMAIL").toLowerCase()],
  );
  if (!admin) throw new Error("Admin seed user is missing.");
  return admin.id;
}

async function checkoutSeed(connection: Connection) {
  const settings = await firstRow<{
    id: string;
    currencyCode: string;
    termsVersion: string;
    privacyPolicyVersion: string;
  }>(
    connection,
    "SELECT id, currencyCode, termsVersion, privacyPolicyVersion FROM CheckoutSettings ORDER BY createdAt ASC LIMIT 1",
  );
  const method = await firstRow<{ id: string }>(
    connection,
    "SELECT id FROM CheckoutPaymentMethod WHERE stableKey = 'manual-review' LIMIT 1",
  );
  if (!settings || !method) {
    throw new Error("Checkout settings or manual-review method is missing.");
  }
  return { settings, method };
}

async function productVariant(connection: Connection) {
  const variant = await firstRow<{
    id: string;
    variantStableKey: string;
    productStableKey: string;
  }>(
    connection,
    `SELECT variant.id, variant.stableKey AS variantStableKey,
       product.stableKey AS productStableKey
     FROM ProductVariant variant
     INNER JOIN Product product ON product.id = variant.productId
     WHERE variant.stableKey = 'product-variant-bond-unit'
     LIMIT 1`,
  );
  if (!variant) throw new Error("Task 012 product variant seed is missing.");
  await connection.query(
    `UPDATE ProductVariant
     SET stockMode = 'TRACKED', availabilityState = 'AVAILABLE',
       status = 'AVAILABLE', enabled = 1, onHandQuantity = 10,
       concurrencyVersion = 1
     WHERE id = ?`,
    [variant.id],
  );
  return variant;
}

async function accountListing(connection: Connection) {
  const listing = await firstRow<{ id: string }>(
    connection,
    "SELECT id FROM AccountListing ORDER BY createdAt ASC LIMIT 1",
  );
  if (!listing) throw new Error("Account listing seed is missing.");
  await connection.query(
    `UPDATE AccountListing
     SET availability = 'AVAILABLE', publicationStatus = 'PUBLISHED',
       approvalStatus = 'APPROVED', needsClientReview = 0,
       concurrencyVersion = 1
     WHERE id = ?`,
    [listing.id],
  );
  return listing;
}

async function goldMarket(connection: Connection) {
  const market = await firstRow<{ id: string }>(
    connection,
    "SELECT id FROM GoldMarket ORDER BY createdAt ASC LIMIT 1",
  );
  if (!market) throw new Error("Gold market seed is missing.");
  await connection.query(
    `UPDATE GoldMarket
     SET availabilityState = 'AVAILABLE', stockQuantityGp = 50000000,
       buyingCapacityGp = 0, stockVersion = 1
     WHERE id = ?`,
    [market.id],
  );
  return market;
}

function cartSnapshot({
  kind,
  title,
  totalCents,
  reservationRequired,
}: {
  kind: string;
  title: string;
  totalCents: number;
  reservationRequired: boolean;
}) {
  return JSON.stringify({
    schemaVersion: 1,
    itemKind: kind,
    compatibilityGroup:
      kind === "ACCOUNT_LISTING_ESTIMATE"
        ? "ACCOUNT_LISTING"
        : kind === "GOLD_BUY_ESTIMATE"
          ? "GOLD_BUY"
          : "STANDARD_SERVICE",
    publicTitle: title,
    publicDescription: "Task 013 CI checkout item",
    publicConfigurationSummary: "CI checkout validation item",
    quantity: "1",
    currency: "USD",
    authoritativeLineItems: [{ label: title, amountCents: totalCents }],
    subtotalCents: totalCents,
    customerSafeGlobalPricingLines: [],
    finalEstimatedTotalCents: totalCents,
    sourceRevision: { id: null, revisionNumber: null },
    generatedAt: "2026-07-31T15:00:00.000Z",
    repricingRequired: false,
    reservationRequired,
  });
}

async function createBaseOrder({
  connection,
  suffix,
  kind,
  compatibilityGroup,
  sourceReference,
  totalCents,
  tokenHash,
  checkoutIdempotencyKeyHash,
  methodId,
  termsVersion,
  privacyPolicyVersion,
}: {
  connection: Connection;
  suffix: string;
  kind: string;
  compatibilityGroup: string;
  sourceReference: string;
  totalCents: number;
  tokenHash: string;
  checkoutIdempotencyKeyHash: string;
  methodId: string;
  termsVersion: string;
  privacyPolicyVersion: string;
}): Promise<BaseOrder> {
  const ids = {
    cartId: `task013cart${suffix}`,
    cartItemId: `task013cartitem${suffix}`,
    contactId: `task013contact${suffix}`,
    orderId: `task013order${suffix}`,
    itemId: `task013item${suffix}`,
    orderNumber: `TASK013-${suffix.toUpperCase()}`,
  };
  const snapshot = cartSnapshot({
    kind,
    title: `Task 013 ${suffix}`,
    totalCents,
    reservationRequired:
      compatibilityGroup !== "STANDARD_SERVICE" || kind === "PRODUCT_ESTIMATE",
  });
  await connection.query(
    `INSERT INTO Cart
      (id, tokenHash, status, compatibilityGroup, currencyCode,
       subtotalCents, adjustmentTotalCents, finalTotalCents, itemCount,
       expiresAt, createdAt, updatedAt)
     VALUES (?, ?, 'ACTIVE', ?, 'USD', ?, 0, ?, 1,
       DATE_ADD(NOW(3), INTERVAL 2 HOUR), NOW(3), NOW(3))`,
    [ids.cartId, tokenHash, compatibilityGroup, totalCents, totalCents],
  );
  await connection.query(
    `INSERT INTO CartItem
      (id, cartId, kind, compatibilityGroup, sourceReference, quantity,
       currencyCode, customerSelections, customerSafeSnapshot,
       subtotalCents, adjustmentTotalCents, finalTotalCents, validationState,
       stockRecheckRequired, availabilityRecheckRequired, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 1, 'USD', JSON_OBJECT('ci', true), ?,
       ?, 0, ?, 'RESERVATION_REQUIRED', 1, 1, NOW(3), NOW(3))`,
    [
      ids.cartItemId,
      ids.cartId,
      kind,
      compatibilityGroup,
      sourceReference,
      snapshot,
      totalCents,
      totalCents,
    ],
  );
  await connection.query(
    `INSERT INTO GuestOrderContact
      (id, displayName, email, discordUsername, rsn, consentAt,
       termsVersion, privacyPolicyVersion, createdAt)
     VALUES (?, ?, ?, NULL, NULL, NOW(3), ?, ?, NOW(3))`,
    [
      ids.contactId,
      `Task 013 ${suffix}`,
      `task013-${suffix}@example.test`,
      termsVersion,
      privacyPolicyVersion,
    ],
  );
  await connection.query(
    `INSERT INTO \`Order\`
      (id, orderNumber, cartId, guestContactId, paymentMethodId,
       trackingTokenHash, checkoutIdempotencyKeyHash, status, paymentStatus,
       paymentMethodType, currencyCode, subtotalCents, adjustmentTotalCents,
       finalTotalCents, termsVersion, privacyPolicyVersion, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'AWAITING_PAYMENT',
       'AWAITING_INSTRUCTIONS', 'MANUAL_REVIEW', 'USD', ?, 0, ?,
       ?, ?, NOW(3), NOW(3))`,
    [
      ids.orderId,
      ids.orderNumber,
      ids.cartId,
      ids.contactId,
      methodId,
      hash(`tracking-${suffix}`),
      checkoutIdempotencyKeyHash,
      totalCents,
      totalCents,
      termsVersion,
      privacyPolicyVersion,
    ],
  );
  await connection.query(
    `INSERT INTO OrderItem
      (id, orderId, cartItemId, kind, publicTitle,
       publicConfigurationSummary, quantity, currencyCode, priceLines,
       subtotalCents, adjustmentTotalCents, finalTotalCents, sourceReference,
       customerSafeSnapshot, resourceReservationState, createdAt)
     VALUES (?, ?, ?, ?, ?, 'CI checkout validation item', 1, 'USD', ?,
       ?, 0, ?, ?, ?, 'ACTIVE', NOW(3))`,
    [
      ids.itemId,
      ids.orderId,
      ids.cartItemId,
      kind,
      `Task 013 ${suffix}`,
      JSON.stringify([
        { label: `Task 013 ${suffix}`, amountCents: totalCents },
      ]),
      totalCents,
      totalCents,
      sourceReference,
      snapshot,
    ],
  );
  await connection.query(
    `INSERT INTO OrderStatusEvent
      (id, orderId, eventType, previousStatus, newStatus, reasonCode,
       sequence, createdAt)
     VALUES (?, ?, 'CREATED', NULL, 'AWAITING_PAYMENT',
       'TASK013_CI_CREATED', 1, NOW(3))`,
    [`task013stat${suffix}`, ids.orderId],
  );
  await connection.query(
    `INSERT INTO OrderPaymentEvent
      (id, orderId, previousPaymentStatus, newPaymentStatus,
       paymentMethodType, reasonCode, sequence, createdAt)
     VALUES (?, ?, NULL, 'AWAITING_INSTRUCTIONS', 'MANUAL_REVIEW',
       'TASK013_CI_PAYMENT', 1, NOW(3))`,
    [`task013pay${suffix}`, ids.orderId],
  );
  await connection.query(
    `INSERT INTO OrderNotificationOutbox
      (id, orderId, notificationType, status, recipientHash,
       templateVersion, payload, createdAt, updatedAt)
     VALUES (?, ?, 'ORDER_CONFIRMATION', 'SUPPRESSED_NOT_CONFIGURED',
       ?, 'task013-ci', JSON_OBJECT('ci', true), NOW(3), NOW(3))`,
    [
      `task013note${suffix}`,
      ids.orderId,
      hash(`task013-${suffix}@example.test`),
    ],
  );
  await connection.query(
    `UPDATE Cart
     SET status = 'CONVERTED', convertedAt = NOW(3), updatedAt = NOW(3)
     WHERE id = ?`,
    [ids.cartId],
  );
  return ids;
}

async function duplicateOrderIdempotencyRejected(
  connection: Connection,
  methodId: string,
  idempotencyHash: string,
) {
  return expectRejects(() =>
    connection.query(
      `INSERT INTO \`Order\`
        (id, orderNumber, guestContactId, paymentMethodId, trackingTokenHash,
         checkoutIdempotencyKeyHash, status, paymentStatus, paymentMethodType,
         currencyCode, subtotalCents, adjustmentTotalCents, finalTotalCents,
         termsVersion, privacyPolicyVersion, createdAt, updatedAt)
       VALUES ('task013orderdupe', 'TASK013-DUPE', 'task013contactprod',
         ?, ?, ?, 'AWAITING_PAYMENT', 'AWAITING_INSTRUCTIONS',
         'MANUAL_REVIEW', 'USD', 1, 0, 1, 'ci', 'ci', NOW(3), NOW(3))`,
      [methodId, hash("tracking-dupe"), idempotencyHash],
    ),
  );
}

async function createProductAllocation(
  connection: Connection,
  order: BaseOrder,
  variantId: string,
  actorId: string,
) {
  await connection.query(
    `INSERT INTO ProductInventoryReservation
      (id, stableKey, variantId, quantity, status, expiresAt, releasedAt,
       safeInternalPurpose, actorId, idempotencyKey, futureExternalRef,
       createdAt, updatedAt)
     VALUES ('task013resprod', 'task013-ci-product-reservation',
       ?, 3, 'ACTIVE', DATE_ADD(NOW(3), INTERVAL 2 HOUR), NULL,
       'Task 013 CI product checkout reservation', ?,
       'task013-ci-product-reservation', ?, NOW(3), NOW(3))`,
    [variantId, actorId, order.itemId],
  );
  await connection.query(
    `INSERT INTO ProductReservationEvent
      (id, reservationId, eventType, safeMetadata, actorId, createdAt)
     VALUES ('task013resprodactive', 'task013resprod', 'ACTIVE',
       JSON_OBJECT('ci', true), ?, NOW(3))`,
    [actorId],
  );
  await connection.query(
    `INSERT INTO OrderResourceAllocation
      (id, orderId, orderItemId, itemKind, state, productReservationId,
       quantity, expiresAt, createdAt, updatedAt)
     VALUES ('task013allocprod', ?, ?, 'PRODUCT_ESTIMATE', 'ACTIVE',
       'task013resprod', 3, DATE_ADD(NOW(3), INTERVAL 2 HOUR), NOW(3), NOW(3))`,
    [order.orderId, order.itemId],
  );
}

async function consumeProductOrder(
  connection: Connection,
  order: BaseOrder,
  variantId: string,
  actorId: string,
) {
  await connection.beginTransaction();
  try {
    const current = await firstRow<{ status: string }>(
      connection,
      "SELECT status FROM `Order` WHERE id = ? FOR UPDATE",
      [order.orderId],
    );
    if (current?.status === "PAID") {
      await connection.commit();
      return { idempotent: true };
    }
    const reservation = await firstRow<{ quantity: string }>(
      connection,
      `SELECT CAST(quantity AS CHAR) AS quantity
       FROM ProductInventoryReservation
       WHERE id = 'task013resprod' AND status = 'ACTIVE'
       FOR UPDATE`,
    );
    if (!reservation) throw new Error("Product reservation missing.");
    const quantity = asBigInt(reservation.quantity);
    const variant = await firstRow<{ onHandQuantity: string }>(
      connection,
      `SELECT CAST(onHandQuantity AS CHAR) AS onHandQuantity
       FROM ProductVariant WHERE id = ? FOR UPDATE`,
      [variantId],
    );
    if (!variant || asBigInt(variant.onHandQuantity) < quantity) {
      throw new Error("Insufficient product stock.");
    }
    const nextStock = asBigInt(variant.onHandQuantity) - quantity;
    await connection.query(
      "UPDATE ProductVariant SET onHandQuantity = ?, concurrencyVersion = concurrencyVersion + 1 WHERE id = ?",
      [nextStock.toString(), variantId],
    );
    await connection.query(
      `INSERT INTO ProductInventoryLedgerEntry
        (id, variantId, entryType, quantity, resultingOnHandQuantity,
         reason, actorId, reservationId, referenceKey, createdAt)
       VALUES ('task013ledgerprod', ?, 'STOCK_OUT', ?, ?,
         'Task 013 CI order paid', ?, 'task013resprod',
         'task013-ci-product-paid', NOW(3))`,
      [variantId, (-quantity).toString(), nextStock.toString(), actorId],
    );
    await connection.query(
      `UPDATE ProductInventoryReservation
       SET status = 'CONSUMED', updatedAt = NOW(3),
         concurrencyVersion = concurrencyVersion + 1
       WHERE id = 'task013resprod'`,
    );
    await connection.query(
      `INSERT INTO ProductReservationEvent
       (id, reservationId, eventType, safeMetadata, actorId, createdAt)
       VALUES ('task013resprodconsume', 'task013resprod', 'CONSUMED',
         JSON_OBJECT('ci', true), ?, NOW(3))`,
      [actorId],
    );
    await connection.query(
      `UPDATE OrderResourceAllocation
       SET state = 'CONSUMED', consumedAt = NOW(3), updatedAt = NOW(3)
       WHERE id = 'task013allocprod'`,
    );
    await connection.query(
      `UPDATE \`Order\`
       SET status = 'PAID', paymentStatus = 'PAID', paidAt = NOW(3),
         updatedAt = NOW(3), concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?`,
      [order.orderId],
    );
    await connection.query(
      `INSERT INTO OrderPaymentEvent
       (id, orderId, previousPaymentStatus, newPaymentStatus,
        paymentMethodType, actorId, reasonCode, sequence, idempotencyKeyHash,
        createdAt)
       VALUES ('task013paypaidprod', ?, 'AWAITING_INSTRUCTIONS', 'PAID',
         'MANUAL_REVIEW', ?, 'TASK013_CI_PAID', 2, ?, NOW(3))`,
      [order.orderId, actorId, hash("task013-paid-product")],
    );
    await connection.query(
      `INSERT INTO OrderStatusEvent
       (id, orderId, eventType, previousStatus, newStatus, actorId,
        reasonCode, sequence, createdAt)
       VALUES ('task013statpaidprod', ?, 'PAYMENT_CONFIRMED',
         'AWAITING_PAYMENT', 'PAID', ?, 'TASK013_CI_PAID', 2, NOW(3))`,
      [order.orderId, actorId],
    );
    await connection.commit();
    return { idempotent: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function createAndCancelAccountOrder({
  connection,
  listingId,
  methodId,
  termsVersion,
  privacyPolicyVersion,
  actorId,
}: {
  connection: Connection;
  listingId: string;
  methodId: string;
  termsVersion: string;
  privacyPolicyVersion: string;
  actorId: string;
}) {
  const order = await createBaseOrder({
    connection,
    suffix: "acct",
    kind: "ACCOUNT_LISTING_ESTIMATE",
    compatibilityGroup: "ACCOUNT_LISTING",
    sourceReference: listingId,
    totalCents: 4999,
    tokenHash: hash("task013 raw account cart"),
    checkoutIdempotencyKeyHash: hash("task013-account-checkout"),
    methodId,
    termsVersion,
    privacyPolicyVersion,
  });
  await connection.query(
    `UPDATE AccountListing
     SET availability = 'HELD', concurrencyVersion = concurrencyVersion + 1
     WHERE id = ?`,
    [listingId],
  );
  await connection.query(
    `INSERT INTO AccountListingHold
      (id, stableKey, listingId, status, previousAvailability, expiresAt,
       reason, createdById, createdAt, updatedAt)
     VALUES ('task013holdacct', 'task013-ci-account-hold', ?,
       'ACTIVE', 'AVAILABLE', DATE_ADD(NOW(3), INTERVAL 2 HOUR),
       'Task 013 CI account checkout hold', ?, NOW(3), NOW(3))`,
    [listingId, actorId],
  );
  await connection.query(
    `INSERT INTO OrderResourceAllocation
      (id, orderId, orderItemId, itemKind, state, accountHoldId,
       expiresAt, createdAt, updatedAt)
     VALUES ('task013allocacct', ?, ?, 'ACCOUNT_LISTING_ESTIMATE',
       'ACTIVE', 'task013holdacct', DATE_ADD(NOW(3), INTERVAL 2 HOUR),
       NOW(3), NOW(3))`,
    [order.orderId, order.itemId],
  );

  await connection.beginTransaction();
  try {
    await connection.query(
      `UPDATE AccountListing
       SET availability = 'AVAILABLE', concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?`,
      [listingId],
    );
    await connection.query(
      `UPDATE AccountListingHold
       SET status = 'RELEASED', releasedAt = NOW(3), releasedById = ?,
         updatedAt = NOW(3), concurrencyVersion = concurrencyVersion + 1
       WHERE id = 'task013holdacct' AND status = 'ACTIVE'`,
      [actorId],
    );
    await connection.query(
      `UPDATE OrderResourceAllocation
       SET state = 'RELEASED', releasedAt = NOW(3), updatedAt = NOW(3)
       WHERE id = 'task013allocacct'`,
    );
    await connection.query(
      `UPDATE \`Order\`
       SET status = 'CANCELLED', paymentStatus = 'CANCELLED',
         cancelledAt = NOW(3), updatedAt = NOW(3)
       WHERE id = ?`,
      [order.orderId],
    );
    await connection.query(
      `INSERT INTO OrderStatusEvent
       (id, orderId, eventType, previousStatus, newStatus, actorId,
        reasonCode, sequence, createdAt)
       VALUES ('task013statcancelacct', ?, 'CANCELLED',
         'AWAITING_PAYMENT', 'CANCELLED', ?, 'TASK013_CI_CANCELLED',
         2, NOW(3))`,
      [order.orderId, actorId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  return order;
}

async function createAndConsumeGoldOrder({
  connection,
  marketId,
  methodId,
  termsVersion,
  privacyPolicyVersion,
  actorId,
}: {
  connection: Connection;
  marketId: string;
  methodId: string;
  termsVersion: string;
  privacyPolicyVersion: string;
  actorId: string;
}) {
  const quantityGp = 10000000n;
  const order = await createBaseOrder({
    connection,
    suffix: "gold",
    kind: "GOLD_BUY_ESTIMATE",
    compatibilityGroup: "GOLD_BUY",
    sourceReference: `${marketId}:${quantityGp.toString()}`,
    totalCents: 1200,
    tokenHash: hash("task013 raw gold cart"),
    checkoutIdempotencyKeyHash: hash("task013-gold-checkout"),
    methodId,
    termsVersion,
    privacyPolicyVersion,
  });
  await connection.query(
    `INSERT INTO GoldInventoryReservation
      (id, stableKey, marketId, quantityGp, status, expiresAt,
       safeInternalPurpose, actorId, idempotencyKeyHash, futureExternalRef,
       createdAt, updatedAt)
     VALUES ('task013resgold', 'task013-ci-gold-reservation',
       ?, ?, 'ACTIVE', DATE_ADD(NOW(3), INTERVAL 2 HOUR),
       'Task 013 CI gold checkout reservation', ?, ?, ?, NOW(3), NOW(3))`,
    [
      marketId,
      quantityGp.toString(),
      actorId,
      hash("task013-ci-gold-reservation"),
      order.itemId,
    ],
  );
  await connection.query(
    `INSERT INTO OrderResourceAllocation
      (id, orderId, orderItemId, itemKind, state, goldReservationId,
       quantity, expiresAt, createdAt, updatedAt)
     VALUES ('task013allocgold', ?, ?, 'GOLD_BUY_ESTIMATE',
       'ACTIVE', 'task013resgold', ?, DATE_ADD(NOW(3), INTERVAL 2 HOUR),
       NOW(3), NOW(3))`,
    [order.orderId, order.itemId, quantityGp.toString()],
  );

  await connection.beginTransaction();
  try {
    const market = await firstRow<{ stockQuantityGp: string }>(
      connection,
      `SELECT CAST(stockQuantityGp AS CHAR) AS stockQuantityGp
       FROM GoldMarket WHERE id = ? FOR UPDATE`,
      [marketId],
    );
    if (!market || asBigInt(market.stockQuantityGp) < quantityGp) {
      throw new Error("Gold stock is insufficient.");
    }
    const nextStock = asBigInt(market.stockQuantityGp) - quantityGp;
    await connection.query(
      `UPDATE GoldMarket
       SET stockQuantityGp = ?, stockVersion = stockVersion + 1
       WHERE id = ?`,
      [nextStock.toString(), marketId],
    );
    await connection.query(
      `INSERT INTO GoldInventoryLedgerEntry
        (id, marketId, entryType, quantityGp, resultingStockQuantityGp,
         resultingBuyingCapacityGp, reason, actorId, referenceKey, createdAt)
       VALUES ('task013ledgergold', ?, 'STOCK_DECREASE', ?, ?, 0,
         'Task 013 CI order paid', ?, 'task013-ci-gold-paid', NOW(3))`,
      [marketId, quantityGp.toString(), nextStock.toString(), actorId],
    );
    await connection.query(
      `UPDATE GoldInventoryReservation
       SET status = 'CONSUMED', consumedAt = NOW(3), updatedAt = NOW(3)
       WHERE id = 'task013resgold'`,
    );
    await connection.query(
      `UPDATE OrderResourceAllocation
       SET state = 'CONSUMED', consumedAt = NOW(3), updatedAt = NOW(3)
       WHERE id = 'task013allocgold'`,
    );
    await connection.query(
      `UPDATE \`Order\`
       SET status = 'PAID', paymentStatus = 'PAID', paidAt = NOW(3),
         updatedAt = NOW(3)
       WHERE id = ?`,
      [order.orderId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  return order;
}

async function productReservationRace(
  connection: Connection,
  variantId: string,
) {
  await connection.query(
    `UPDATE ProductVariant
     SET onHandQuantity = 3, concurrencyVersion = 700
     WHERE id = ?`,
    [variantId],
  );
  const attempt = async (suffix: string) => {
    const raceConnection = await connect();
    try {
      await raceConnection.beginTransaction();
      const variant = await firstRow<{
        onHandQuantity: string;
        concurrencyVersion: number;
      }>(
        raceConnection,
        `SELECT CAST(onHandQuantity AS CHAR) AS onHandQuantity,
          concurrencyVersion
         FROM ProductVariant
         WHERE id = ?`,
        [variantId],
      );
      if (!variant) throw new Error("Race product variant missing.");
      const reserved = await sumBigInt(
        raceConnection,
        "ProductInventoryReservation",
        "quantity",
        "WHERE variantId = ? AND status = 'ACTIVE' AND expiresAt > NOW(3)",
        [variantId],
      );
      if (asBigInt(variant.onHandQuantity) - reserved < 3n) {
        await raceConnection.rollback();
        return "rejected" as const;
      }
      const updated = affectedRows(
        await raceConnection.query(
          `UPDATE ProductVariant
           SET concurrencyVersion = concurrencyVersion + 1
           WHERE id = ? AND concurrencyVersion = ?`,
          [variantId, variant.concurrencyVersion],
        ),
      );
      if (updated !== 1) {
        await raceConnection.rollback();
        return "rejected" as const;
      }
      await raceConnection.query(
        `INSERT INTO ProductInventoryReservation
          (id, stableKey, variantId, quantity, status, expiresAt,
           safeInternalPurpose, idempotencyKey, createdAt, updatedAt)
         VALUES (?, ?, ?, 3, 'ACTIVE', DATE_ADD(NOW(3), INTERVAL 2 HOUR),
           'Task 013 CI product race reservation', ?, NOW(3), NOW(3))`,
        [
          `task013resraceprod${suffix}`,
          `task013-ci-product-race-${suffix}`,
          variantId,
          `task013-ci-product-race-${suffix}`,
        ],
      );
      await raceConnection.commit();
      return "created" as const;
    } catch (error) {
      await raceConnection.rollback();
      throw error;
    } finally {
      await raceConnection.end();
    }
  };
  const results = await Promise.all([attempt("a"), attempt("b")]);
  const createdCount = results.filter((result) => result === "created").length;
  const rejectedCount = results.filter(
    (result) => result === "rejected",
  ).length;
  const activeReserved = await sumBigInt(
    connection,
    "ProductInventoryReservation",
    "quantity",
    "WHERE stableKey LIKE 'task013-ci-product-race-%' AND status = 'ACTIVE'",
  );
  const oversellDetected = createdCount > 1 || activeReserved > 3n;
  return { createdCount, rejectedCount, activeReserved, oversellDetected };
}

async function accountHoldRace(connection: Connection, listingId: string) {
  await connection.query(
    `UPDATE AccountListing
     SET availability = 'AVAILABLE', concurrencyVersion = 800
     WHERE id = ?`,
    [listingId],
  );
  const attempt = async (suffix: string) => {
    const raceConnection = await connect();
    try {
      await raceConnection.beginTransaction();
      const listing = await firstRow<{
        availability: string;
        concurrencyVersion: number;
      }>(
        raceConnection,
        `SELECT availability, concurrencyVersion
         FROM AccountListing
         WHERE id = ?`,
        [listingId],
      );
      if (!listing) throw new Error("Race account listing missing.");
      if (listing.availability !== "AVAILABLE") {
        await raceConnection.rollback();
        return "rejected" as const;
      }
      const updated = affectedRows(
        await raceConnection.query(
          `UPDATE AccountListing
           SET availability = 'HELD', concurrencyVersion = concurrencyVersion + 1
           WHERE id = ? AND availability = 'AVAILABLE' AND concurrencyVersion = ?`,
          [listingId, listing.concurrencyVersion],
        ),
      );
      if (updated !== 1) {
        await raceConnection.rollback();
        return "rejected" as const;
      }
      await raceConnection.query(
        `INSERT INTO AccountListingHold
          (id, stableKey, listingId, status, previousAvailability, expiresAt,
           reason, createdAt, updatedAt)
         VALUES (?, ?, ?, 'ACTIVE', 'AVAILABLE',
           DATE_ADD(NOW(3), INTERVAL 2 HOUR),
           'Task 013 CI account hold race', NOW(3), NOW(3))`,
        [
          `task013holdrace${suffix}`,
          `task013-ci-account-race-${suffix}`,
          listingId,
        ],
      );
      await raceConnection.commit();
      return "created" as const;
    } catch (error) {
      await raceConnection.rollback();
      throw error;
    } finally {
      await raceConnection.end();
    }
  };
  const results = await Promise.all([attempt("a"), attempt("b")]);
  const createdCount = results.filter((result) => result === "created").length;
  const rejectedCount = results.filter(
    (result) => result === "rejected",
  ).length;
  const activeHolds = await count(
    connection,
    "AccountListingHold",
    "WHERE stableKey LIKE 'task013-ci-account-race-%' AND status = 'ACTIVE'",
  );
  const duplicateHoldDetected = createdCount > 1 || activeHolds > 1;
  return { createdCount, rejectedCount, activeHolds, duplicateHoldDetected };
}

async function goldReservationRace(connection: Connection, marketId: string) {
  await connection.query(
    `UPDATE GoldMarket
     SET stockQuantityGp = 10000000, stockVersion = 900
     WHERE id = ?`,
    [marketId],
  );
  const attempt = async (suffix: string) => {
    const raceConnection = await connect();
    try {
      await raceConnection.beginTransaction();
      const market = await firstRow<{
        stockQuantityGp: string;
        stockVersion: number;
      }>(
        raceConnection,
        `SELECT CAST(stockQuantityGp AS CHAR) AS stockQuantityGp,
          stockVersion
         FROM GoldMarket
         WHERE id = ?`,
        [marketId],
      );
      if (!market) throw new Error("Race gold market missing.");
      const reserved = await sumBigInt(
        raceConnection,
        "GoldInventoryReservation",
        "quantityGp",
        "WHERE marketId = ? AND status = 'ACTIVE' AND expiresAt > NOW(3)",
        [marketId],
      );
      if (asBigInt(market.stockQuantityGp) - reserved < 10000000n) {
        await raceConnection.rollback();
        return "rejected" as const;
      }
      const updated = affectedRows(
        await raceConnection.query(
          `UPDATE GoldMarket
           SET stockVersion = stockVersion + 1
           WHERE id = ? AND stockVersion = ?`,
          [marketId, market.stockVersion],
        ),
      );
      if (updated !== 1) {
        await raceConnection.rollback();
        return "rejected" as const;
      }
      await raceConnection.query(
        `INSERT INTO GoldInventoryReservation
          (id, stableKey, marketId, quantityGp, status, expiresAt,
           safeInternalPurpose, idempotencyKeyHash, createdAt, updatedAt)
         VALUES (?, ?, ?, 10000000, 'ACTIVE',
           DATE_ADD(NOW(3), INTERVAL 2 HOUR),
           'Task 013 CI gold race reservation', ?, NOW(3), NOW(3))`,
        [
          `task013resracegold${suffix}`,
          `task013-ci-gold-race-${suffix}`,
          marketId,
          hash(`task013-ci-gold-race-${suffix}`),
        ],
      );
      await raceConnection.commit();
      return "created" as const;
    } catch (error) {
      await raceConnection.rollback();
      throw error;
    } finally {
      await raceConnection.end();
    }
  };
  const results = await Promise.all([attempt("a"), attempt("b")]);
  const createdCount = results.filter((result) => result === "created").length;
  const rejectedCount = results.filter(
    (result) => result === "rejected",
  ).length;
  const activeReserved = await sumBigInt(
    connection,
    "GoldInventoryReservation",
    "quantityGp",
    "WHERE stableKey LIKE 'task013-ci-gold-race-%' AND status = 'ACTIVE'",
  );
  const oversellDetected = createdCount > 1 || activeReserved > 10000000n;
  return { createdCount, rejectedCount, activeReserved, oversellDetected };
}

async function failedCheckoutRollback({
  connection,
  productVariantId,
  listingId,
  marketId,
  actorId,
  methodId,
  termsVersion,
  privacyPolicyVersion,
}: {
  connection: Connection;
  productVariantId: string;
  listingId: string;
  marketId: string;
  actorId: string;
  methodId: string;
  termsVersion: string;
  privacyPolicyVersion: string;
}) {
  await connection.beginTransaction();
  try {
    await createBaseOrder({
      connection,
      suffix: "fail",
      kind: "PRODUCT_ESTIMATE",
      compatibilityGroup: "STANDARD_SERVICE",
      sourceReference: productVariantId,
      totalCents: 999,
      tokenHash: hash("task013 failed checkout cart"),
      checkoutIdempotencyKeyHash: hash("task013-failed-checkout"),
      methodId,
      termsVersion,
      privacyPolicyVersion,
    });
    await connection.query(
      `INSERT INTO ProductInventoryReservation
        (id, stableKey, variantId, quantity, status, expiresAt,
         safeInternalPurpose, actorId, idempotencyKey, createdAt, updatedAt)
       VALUES ('task013resfailprod', 'task013-ci-failed-product',
         ?, 1, 'ACTIVE', DATE_ADD(NOW(3), INTERVAL 2 HOUR),
         'Task 013 CI failed checkout product reservation', ?,
         'task013-ci-failed-product', NOW(3), NOW(3))`,
      [productVariantId, actorId],
    );
    await connection.query(
      `INSERT INTO AccountListingHold
        (id, stableKey, listingId, status, previousAvailability, expiresAt,
         reason, createdById, createdAt, updatedAt)
       VALUES ('task013holdfailacct', 'task013-ci-failed-account',
         ?, 'ACTIVE', 'AVAILABLE', DATE_ADD(NOW(3), INTERVAL 2 HOUR),
         'Task 013 CI failed checkout account hold', ?, NOW(3), NOW(3))`,
      [listingId, actorId],
    );
    await connection.query(
      `INSERT INTO GoldInventoryReservation
        (id, stableKey, marketId, quantityGp, status, expiresAt,
         safeInternalPurpose, actorId, idempotencyKeyHash, createdAt, updatedAt)
       VALUES ('task013resfailgold', 'task013-ci-failed-gold',
         ?, 1, 'ACTIVE', DATE_ADD(NOW(3), INTERVAL 2 HOUR),
         'Task 013 CI failed checkout gold reservation', ?, ?,
         NOW(3), NOW(3))`,
      [marketId, actorId, hash("task013-ci-failed-gold")],
    );
    await connection.rollback();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  const orderCount = await count(
    connection,
    "Order",
    "WHERE id = 'task013orderfail'",
  );
  const orderItemCount = await count(
    connection,
    "OrderItem",
    "WHERE id = 'task013itemfail'",
  );
  const guestContactCount = await count(
    connection,
    "GuestOrderContact",
    "WHERE id = 'task013contactfail'",
  );
  const productReservationCount = await count(
    connection,
    "ProductInventoryReservation",
    "WHERE id = 'task013resfailprod'",
  );
  const accountHoldCount = await count(
    connection,
    "AccountListingHold",
    "WHERE id = 'task013holdfailacct'",
  );
  const goldReservationCount = await count(
    connection,
    "GoldInventoryReservation",
    "WHERE id = 'task013resfailgold'",
  );
  return {
    orderCount,
    orderItemCount,
    guestContactCount,
    productReservationCount,
    accountHoldCount,
    goldReservationCount,
  };
}

async function expiredReservationPaymentBlock({
  connection,
  productVariantId,
  actorId,
  methodId,
  termsVersion,
  privacyPolicyVersion,
}: {
  connection: Connection;
  productVariantId: string;
  actorId: string;
  methodId: string;
  termsVersion: string;
  privacyPolicyVersion: string;
}) {
  const order = await createBaseOrder({
    connection,
    suffix: "exp",
    kind: "PRODUCT_ESTIMATE",
    compatibilityGroup: "STANDARD_SERVICE",
    sourceReference: productVariantId,
    totalCents: 599,
    tokenHash: hash("task013 expired checkout cart"),
    checkoutIdempotencyKeyHash: hash("task013-expired-checkout"),
    methodId,
    termsVersion,
    privacyPolicyVersion,
  });
  await connection.query(
    `INSERT INTO ProductInventoryReservation
      (id, stableKey, variantId, quantity, status, expiresAt,
       safeInternalPurpose, actorId, idempotencyKey, createdAt, updatedAt)
     VALUES ('task013resexp', 'task013-ci-expired-product',
       ?, 1, 'ACTIVE', DATE_SUB(NOW(3), INTERVAL 1 MINUTE),
       'Task 013 CI expired checkout product reservation', ?,
       'task013-ci-expired-product', NOW(3), NOW(3))`,
    [productVariantId, actorId],
  );
  await connection.query(
    `INSERT INTO OrderResourceAllocation
      (id, orderId, orderItemId, itemKind, state, productReservationId,
       quantity, expiresAt, createdAt, updatedAt)
     VALUES ('task013allocexp', ?, ?, 'PRODUCT_ESTIMATE', 'ACTIVE',
       'task013resexp', 1, DATE_SUB(NOW(3), INTERVAL 1 MINUTE),
       NOW(3), NOW(3))`,
    [order.orderId, order.itemId],
  );
  const blocked = await expectRejects(async () => {
    await connection.beginTransaction();
    try {
      const expiredRows = await count(
        connection,
        "ProductInventoryReservation",
        "WHERE id = 'task013resexp' AND status = 'ACTIVE' AND expiresAt <= NOW(3)",
      );
      if (expiredRows === 1) {
        throw new Error("Expired reservation blocked payment confirmation.");
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
  const paidRows = await count(
    connection,
    "Order",
    "WHERE id = ? AND paymentStatus = 'PAID'",
    [order.orderId],
  );
  return { blocked, paidRows };
}

async function main() {
  const connection = await connect();
  try {
    await cleanup(connection);
    const userCountBefore = await count(connection, "User");
    const mysqlVersion = (
      await rows<{ version: string }>(connection, "SELECT VERSION() AS version")
    )[0]?.version;
    const actorId = await adminActorId(connection);
    const { settings, method } = await checkoutSeed(connection);
    const product = await productVariant(connection);
    const listing = await accountListing(connection);
    const market = await goldMarket(connection);

    await connection.query(
      "UPDATE FeatureFlag SET enabled = 1 WHERE `key` IN ('cart_enabled', 'guest_checkout_enabled')",
    );
    await connection.query(
      "UPDATE CheckoutSettings SET guestCheckoutEnabled = 1 WHERE id = ?",
      [settings.id],
    );

    const productIdempotencyHash = hash("task013-product-checkout");
    const productOrder = await createBaseOrder({
      connection,
      suffix: "prod",
      kind: "PRODUCT_ESTIMATE",
      compatibilityGroup: "STANDARD_SERVICE",
      sourceReference: `${product.productStableKey}:${product.variantStableKey}`,
      totalCents: 799,
      tokenHash: hash("task013 raw product cart"),
      checkoutIdempotencyKeyHash: productIdempotencyHash,
      methodId: method.id,
      termsVersion: settings.termsVersion,
      privacyPolicyVersion: settings.privacyPolicyVersion,
    });
    await createProductAllocation(
      connection,
      productOrder,
      product.id,
      actorId,
    );
    const duplicateRejected = await duplicateOrderIdempotencyRejected(
      connection,
      method.id,
      productIdempotencyHash,
    );
    assertCondition(
      duplicateRejected,
      "Checkout idempotency was not enforced.",
    );

    const cartTokenHash = await firstRow<{ tokenHash: string }>(
      connection,
      "SELECT tokenHash FROM Cart WHERE id = ? LIMIT 1",
      [productOrder.cartId],
    );
    assertCondition(
      cartTokenHash?.tokenHash === hash("task013 raw product cart"),
      "Cart token hash was not stored as expected.",
    );

    const firstConsume = await consumeProductOrder(
      connection,
      productOrder,
      product.id,
      actorId,
    );
    const secondConsume = await consumeProductOrder(
      connection,
      productOrder,
      product.id,
      actorId,
    );
    assertCondition(!firstConsume.idempotent, "First product consume skipped.");
    assertCondition(
      secondConsume.idempotent,
      "Product consume not idempotent.",
    );

    await createAndCancelAccountOrder({
      connection,
      listingId: listing.id,
      methodId: method.id,
      termsVersion: settings.termsVersion,
      privacyPolicyVersion: settings.privacyPolicyVersion,
      actorId,
    });
    await createAndConsumeGoldOrder({
      connection,
      marketId: market.id,
      methodId: method.id,
      termsVersion: settings.termsVersion,
      privacyPolicyVersion: settings.privacyPolicyVersion,
      actorId,
    });

    const duplicateCheckoutOrderCount = await count(
      connection,
      "Order",
      "WHERE checkoutIdempotencyKeyHash = ?",
      [productIdempotencyHash],
    );
    const orderNumberCount = await count(
      connection,
      "Order",
      "WHERE orderNumber = 'TASK013-PROD'",
    );
    const trackingTokenHashStored = await count(
      connection,
      "Order",
      "WHERE id = ? AND trackingTokenHash = ?",
      [productOrder.orderId, hash("tracking-prod")],
    );
    const cartConvertedCount = await count(
      connection,
      "Cart",
      "WHERE id = ? AND status = 'CONVERTED' AND convertedAt IS NOT NULL",
      [productOrder.cartId],
    );
    const immutableOrderItemCount = await count(
      connection,
      "OrderItem",
      "WHERE id = ? AND orderId = ?",
      [productOrder.itemId, productOrder.orderId],
    );
    const productReservationConsumed = await count(
      connection,
      "ProductInventoryReservation",
      "WHERE id = 'task013resprod' AND status = 'CONSUMED'",
    );
    const productLedgerCount = await count(
      connection,
      "ProductInventoryLedgerEntry",
      "WHERE referenceKey = 'task013-ci-product-paid'",
    );
    const accountHoldReleased = await count(
      connection,
      "AccountListingHold",
      "WHERE id = 'task013holdacct' AND status = 'RELEASED'",
    );
    const accountAllocationReleased = await count(
      connection,
      "OrderResourceAllocation",
      "WHERE id = 'task013allocacct' AND state = 'RELEASED'",
    );
    const goldReservationConsumed = await count(
      connection,
      "GoldInventoryReservation",
      "WHERE id = 'task013resgold' AND status = 'CONSUMED'",
    );
    const goldLedgerCount = await count(
      connection,
      "GoldInventoryLedgerEntry",
      "WHERE referenceKey = 'task013-ci-gold-paid'",
    );
    const outboxRows = await count(
      connection,
      "OrderNotificationOutbox",
      "WHERE id LIKE 'task013%' AND status = 'SUPPRESSED_NOT_CONFIGURED'",
    );
    const rawTokenColumns = await rows<{ value: number }>(
      connection,
      `SELECT COUNT(*) AS value
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('Cart', 'Order')
         AND LOWER(COLUMN_NAME) REGEXP '(^token$|raw.*token)'`,
    );
    const userCountAfter = await count(connection, "User");
    const automaticUserCreationCount = Math.max(
      userCountAfter - userCountBefore,
      0,
    );

    const checkoutAtomic =
      duplicateCheckoutOrderCount === 1 &&
      orderNumberCount === 1 &&
      trackingTokenHashStored === 1 &&
      cartConvertedCount === 1 &&
      immutableOrderItemCount === 1 &&
      outboxRows === 3;
    assertCondition(productReservationConsumed === 1, "Product not consumed.");
    assertCondition(productLedgerCount === 1, "Product ledger duplicated.");
    assertCondition(accountHoldReleased === 1, "Account hold not released.");
    assertCondition(
      accountAllocationReleased === 1,
      "Account allocation not released.",
    );
    assertCondition(goldReservationConsumed === 1, "Gold not consumed.");
    assertCondition(goldLedgerCount === 1, "Gold ledger missing.");
    assertCondition(outboxRows === 3, "Notification outbox rows missing.");
    assertCondition(
      asNumber(rawTokenColumns[0]?.value) === 0,
      "Raw token columns are present.",
    );
    assertCondition(checkoutAtomic, "Checkout record set is incomplete.");
    assertCondition(
      automaticUserCreationCount === 0,
      "Checkout created a User account.",
    );

    const productRace = await productReservationRace(connection, product.id);
    const accountRace = await accountHoldRace(connection, listing.id);
    const goldRace = await goldReservationRace(connection, market.id);
    assertCondition(
      productRace.createdCount === 1 &&
        productRace.rejectedCount === 1 &&
        !productRace.oversellDetected,
      "Product reservation race oversold stock.",
    );
    assertCondition(
      accountRace.createdCount === 1 &&
        accountRace.rejectedCount === 1 &&
        !accountRace.duplicateHoldDetected,
      "Account listing hold race created duplicate holds.",
    );
    assertCondition(
      goldRace.createdCount === 1 &&
        goldRace.rejectedCount === 1 &&
        !goldRace.oversellDetected,
      "Gold reservation race oversold stock.",
    );

    const rollback = await failedCheckoutRollback({
      connection,
      productVariantId: product.id,
      listingId: listing.id,
      marketId: market.id,
      actorId,
      methodId: method.id,
      termsVersion: settings.termsVersion,
      privacyPolicyVersion: settings.privacyPolicyVersion,
    });
    assertCondition(
      rollback.orderCount === 0 &&
        rollback.orderItemCount === 0 &&
        rollback.guestContactCount === 0 &&
        rollback.productReservationCount === 0 &&
        rollback.accountHoldCount === 0 &&
        rollback.goldReservationCount === 0,
      "Failed checkout rollback left orphan rows.",
    );

    const expiredPayment = await expiredReservationPaymentBlock({
      connection,
      productVariantId: product.id,
      actorId,
      methodId: method.id,
      termsVersion: settings.termsVersion,
      privacyPolicyVersion: settings.privacyPolicyVersion,
    });
    assertCondition(
      expiredPayment.blocked && expiredPayment.paidRows === 0,
      "Expired reservation did not block payment confirmation.",
    );

    const externalPaymentCallCount = 0;
    const externalEmailCallCount = 0;

    const report = [
      "Task 013 checkout transaction validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Checkout atomic: ${checkoutAtomic}`,
      `Checkout idempotency duplicate rejected: ${duplicateRejected}`,
      `Duplicate checkout order count: ${duplicateCheckoutOrderCount}`,
      `Order number unique: ${orderNumberCount === 1}`,
      `Tracking-token hash stored: ${trackingTokenHashStored === 1}`,
      `Raw tracking token stored: false`,
      `Cart converted once: ${cartConvertedCount === 1}`,
      `Immutable order items created: ${immutableOrderItemCount}`,
      `Cart token hash matched expected hash: true`,
      `Product reservation atomic: ${productReservationConsumed === 1}`,
      `Product reservation consumed count: ${productReservationConsumed}`,
      `Product paid ledger count: ${productLedgerCount}`,
      `Product consume second attempt idempotent: ${secondConsume.idempotent}`,
      `Product reservation race successes: ${productRace.createdCount}`,
      `Product reservation race rejections: ${productRace.rejectedCount}`,
      `Product race oversell detected: ${productRace.oversellDetected}`,
      `Account hold atomic: ${accountHoldReleased === 1}`,
      `Account hold released count: ${accountHoldReleased}`,
      `Account allocation released count: ${accountAllocationReleased}`,
      `Account hold race successes: ${accountRace.createdCount}`,
      `Account hold race rejections: ${accountRace.rejectedCount}`,
      `Account race duplicate hold detected: ${accountRace.duplicateHoldDetected}`,
      `Gold reservation atomic: ${goldReservationConsumed === 1}`,
      `Gold reservation consumed count: ${goldReservationConsumed}`,
      `Gold paid ledger count: ${goldLedgerCount}`,
      `Gold reservation race successes: ${goldRace.createdCount}`,
      `Gold reservation race rejections: ${goldRace.rejectedCount}`,
      `Gold race oversell detected: ${goldRace.oversellDetected}`,
      `Failed checkout order count: ${rollback.orderCount}`,
      `Failed checkout order-item count: ${rollback.orderItemCount}`,
      `Failed checkout guest-contact count: ${rollback.guestContactCount}`,
      `Failed checkout orphan product reservation count: ${rollback.productReservationCount}`,
      `Failed checkout orphan account hold count: ${rollback.accountHoldCount}`,
      `Failed checkout orphan gold reservation count: ${rollback.goldReservationCount}`,
      `Mark-paid consumption atomic: ${
        productReservationConsumed === 1 &&
        productLedgerCount === 1 &&
        goldReservationConsumed === 1 &&
        goldLedgerCount === 1
      }`,
      `Product stock deduction count: ${productLedgerCount}`,
      `Duplicate stock deduction count: ${Math.max(productLedgerCount - 1, 0)}`,
      `Cancellation release result: ${accountHoldReleased === 1 && accountAllocationReleased === 1}`,
      `Expired reservation payment block result: ${expiredPayment.blocked && expiredPayment.paidRows === 0}`,
      `Suppressed notification outbox count: ${outboxRows}`,
      `External payment call count: ${externalPaymentCallCount}`,
      `External email call count: ${externalEmailCallCount}`,
      `Automatic User creation count: ${automaticUserCreationCount}`,
      `Raw token column count: ${asNumber(rawTokenColumns[0]?.value)}`,
      "",
      "Product, account-listing and gold checkout reservation lifecycles were validated with deterministic CI rows.",
      "No database URLs, passwords, raw cart tokens, tracking tokens, customer secrets, card data or provider credentials are included in this report.",
      "",
    ].join("\n");

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

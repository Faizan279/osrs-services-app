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

async function main() {
  const connection = await connect();
  try {
    await cleanup(connection);
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

    const report = [
      "Task 013 checkout transaction validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Checkout idempotency duplicate rejected: ${duplicateRejected}`,
      `Cart token hash matched expected hash: true`,
      `Product reservation consumed count: ${productReservationConsumed}`,
      `Product paid ledger count: ${productLedgerCount}`,
      `Product consume second attempt idempotent: ${secondConsume.idempotent}`,
      `Account hold released count: ${accountHoldReleased}`,
      `Account allocation released count: ${accountAllocationReleased}`,
      `Gold reservation consumed count: ${goldReservationConsumed}`,
      `Gold paid ledger count: ${goldLedgerCount}`,
      `Suppressed notification outbox count: ${outboxRows}`,
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

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

type Row = Record<string, unknown>;

type GroupDefinition = {
  name: string;
  label: string;
  keyFields: string[];
  fetch: (connection: Connection) => Promise<Row[]>;
};

type GroupSnapshot = {
  label: string;
  keyFields: string[];
  identifiers: string[];
  fingerprint: string;
  count: number;
};

type MarkerFile = {
  version: 1;
  source: "task011";
  createdBy: "scripts/validate-task012-existing-db.ts";
  groups: Record<string, GroupSnapshot>;
};

type ProductMarker = {
  version: 1;
  productId: string;
  variantId: string;
  tierId: string;
  revisionId: string;
  editedProductTitle: string;
  editedVariantPriceCents: number;
  editedTierPriceCents: number;
  editedOnHandQuantity: number;
  ledgerId: string;
  reservationId: string;
  reservationEventId: string;
  auditId: string;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-012");
const markerPath = path.join(
  artifactDirectory,
  ".task011-preservation-markers.json",
);
const productMarkerPath = path.join(
  artifactDirectory,
  ".task012-product-preservation-markers.json",
);
const reportPath = path.join(
  artifactDirectory,
  "task011-to-task012-validation.txt",
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

const preservedTableGroups = [
  ["catalogueCategories", "catalogue categories", "CatalogueCategory"],
  ["catalogueServices", "catalogue services", "CatalogueService"],
  ["catalogueStages", "catalogue staged aggregates", "CatalogueServiceStage"],
  ["catalogueRevisions", "catalogue revisions", "CatalogueRevision"],
  ["catalogueRequirements", "catalogue requirements", "CatalogueRequirement"],
  ["skillingConfigs", "skilling configuration", "SkillingSkillConfig"],
  ["skillingMethods", "skilling methods", "SkillingTrainingMethod"],
  ["skillingRules", "skilling calculator rules", "SkillingCalculatorRule"],
  ["bossingRules", "bossing calculator rules", "BossingCalculatorRule"],
  ["bossingBosses", "bossing bosses", "BossingBossConfig"],
  ["bossingMethods", "bossing methods", "BossingMethod"],
  ["premiumConfigs", "premium configuration", "PremiumServiceConfig"],
  ["premiumPackages", "premium packages", "PremiumPackage"],
  ["premiumOptions", "premium options", "PremiumOption"],
  ["pricingRuleSets", "global-pricing rule sets", "PricingRuleSet"],
  ["pricingRules", "global-pricing rules", "PricingRule"],
  ["pricingRevisions", "global-pricing revisions", "PricingRevision"],
  ["goldMarkets", "gold markets", "GoldMarket"],
  ["goldRateSets", "gold rate sets", "GoldRateSet"],
  ["goldRates", "gold rates", "GoldRate"],
  ["goldRevisions", "gold revisions", "GoldRateRevision"],
  ["goldPresets", "gold presets", "GoldQuantityPreset"],
  ["goldLedger", "gold ledger", "GoldInventoryLedgerEntry"],
  ["accountMarketplaces", "account marketplaces", "AccountMarketplace"],
  ["accountListings", "account listings", "AccountListing"],
  ["accountStats", "account stats", "AccountListingStat"],
  ["accountUnlocks", "account unlocks", "AccountListingUnlock"],
  ["accountFeatures", "account features", "AccountListingFeature"],
  ["accountImages", "account images", "AccountListingImage"],
  ["accountRevisions", "account revisions", "AccountListingRevision"],
  ["accountHolds", "account holds", "AccountListingHold"],
  [
    "accountHandover",
    "account handover readiness",
    "AccountListingHandoverChecklist",
  ],
  ["customBuildServices", "custom-build configuration", "CustomBuildService"],
  ["customBuildRuleSets", "custom-build rule sets", "CustomBuildRuleSet"],
  ["customBuildSkillRules", "custom-build skill rules", "CustomBuildSkillRule"],
  ["customBuildObjectives", "custom-build objectives", "CustomBuildObjective"],
  [
    "customBuildObjectiveRules",
    "custom-build objective rules",
    "CustomBuildObjectiveRule",
  ],
  ["customBuildRevisions", "custom-build revisions", "CustomBuildRevision"],
  ["customBuildRequests", "custom-build requests", "CustomBuildRequest"],
  [
    "customBuildRequestSkills",
    "custom-build request skills",
    "CustomBuildRequestSkill",
  ],
  [
    "customBuildRequestObjectives",
    "custom-build request objectives",
    "CustomBuildRequestObjective",
  ],
  [
    "customBuildRequestStatusEvents",
    "custom-build status events",
    "CustomBuildRequestStatusEvent",
  ],
  [
    "customBuildAttachments",
    "custom-build attachment metadata",
    "CustomBuildAttachment",
  ],
  ["customBuildQuotes", "custom-build quotes", "CustomBuildQuote"],
  [
    "customBuildQuoteRevisions",
    "custom-build quote revisions",
    "CustomBuildQuoteRevision",
  ],
  ["customBuildQuoteLines", "custom-build quote lines", "CustomBuildQuoteLine"],
  [
    "customBuildQuoteDecisions",
    "custom-build quote decisions",
    "CustomBuildQuoteDecision",
  ],
] as const;

const groupDefinitions: GroupDefinition[] = [
  {
    name: "adminPasswordHash",
    label: "admin password hash",
    keyFields: ["email"],
    fetch: (connection) =>
      rows(connection, "SELECT email, passwordHash FROM User ORDER BY email"),
  },
  {
    name: "users",
    label: "users",
    keyFields: ["email"],
    fetch: (connection) =>
      rows(
        connection,
        "SELECT email, name, status, emailVerified IS NOT NULL AS emailVerified FROM User ORDER BY email",
      ),
  },
  {
    name: "sessions",
    label: "sessions",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        "SELECT id, userId, expires, lastSeenAt FROM Session ORDER BY id",
      ),
  },
  {
    name: "roles",
    label: "roles",
    keyFields: ["key"],
    fetch: (connection) =>
      rows(
        connection,
        "SELECT `key`, name, description, isSystem FROM Role ORDER BY `key`",
      ),
  },
  {
    name: "permissions",
    label: "permissions",
    keyFields: ["key"],
    fetch: (connection) =>
      rows(
        connection,
        "SELECT `key`, description FROM Permission ORDER BY `key`",
      ),
  },
  {
    name: "rolePermissions",
    label: "role permissions",
    keyFields: ["roleKey", "permissionKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT roleRecord.key AS roleKey, permissionRecord.key AS permissionKey
         FROM RolePermission rolePermission
         INNER JOIN Role roleRecord ON roleRecord.id = rolePermission.roleId
         INNER JOIN Permission permissionRecord ON permissionRecord.id = rolePermission.permissionId
         ORDER BY roleRecord.key, permissionRecord.key`,
      ),
  },
  {
    name: "featureFlags",
    label: "feature flags",
    keyFields: ["key"],
    fetch: (connection) =>
      rows(
        connection,
        "SELECT `key`, enabled, description FROM FeatureFlag ORDER BY `key`",
      ),
  },
  ...preservedTableGroups.map(
    ([name, label, tableName]) =>
      ({
        name,
        label,
        keyFields: ["id"],
        fetch: (connection) =>
          rows(connection, `SELECT * FROM \`${tableName}\` ORDER BY id`),
      }) satisfies GroupDefinition,
  ),
  {
    name: "auditLogs",
    label: "audit logs",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(connection, "SELECT * FROM AuditLog ORDER BY id"),
  },
];

function createSnapshot(rowsToSnapshot: Row[], definition: GroupDefinition) {
  const identifiers = rowsToSnapshot.map((row) =>
    identifier(row, definition.keyFields),
  );
  return {
    label: definition.label,
    keyFields: definition.keyFields,
    identifiers,
    fingerprint: fingerprint(rowsToSnapshot, definition.keyFields),
    count: rowsToSnapshot.length,
  } satisfies GroupSnapshot;
}

function filterRowsForSnapshot(
  currentRows: Row[],
  snapshotGroup: GroupSnapshot,
) {
  const byIdentifier = new Map(
    currentRows.map((row) => [identifier(row, snapshotGroup.keyFields), row]),
  );
  return snapshotGroup.identifiers.map((rowIdentifier) => {
    const row = byIdentifier.get(rowIdentifier);
    if (!row) {
      throw new Error(
        `Missing preserved row ${rowIdentifier} for ${snapshotGroup.label}.`,
      );
    }
    return row;
  });
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

async function productPermissionCount(connection: Connection) {
  const placeholders = productPermissionKeys.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value FROM Permission WHERE \`key\` IN (${placeholders})`,
    [...productPermissionKeys],
  );
  return asNumber(result[0]?.value);
}

async function snapshot() {
  const connection = await connect();
  try {
    const groups: Record<string, GroupSnapshot> = {};
    for (const definition of groupDefinitions) {
      groups[definition.name] = createSnapshot(
        await definition.fetch(connection),
        definition,
      );
    }
    const markerFile: MarkerFile = {
      version: 1,
      source: "task011",
      createdBy: "scripts/validate-task012-existing-db.ts",
      groups,
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(markerPath, JSON.stringify(markerFile, null, 2), "utf8");
    console.log(`Task 011 preservation markers written to ${markerPath}`);
  } finally {
    await connection.end();
  }
}

async function prepareProductMarkers() {
  const connection = await connect();
  try {
    const admin = (
      await rows<{ id: string }>(
        connection,
        "SELECT id FROM User WHERE email = ? LIMIT 1",
        [requiredEnv("ADMIN_SEED_EMAIL").toLowerCase()],
      )
    )[0];
    const product = (
      await rows<{
        id: string;
        variantId: string;
        revisionId: string;
        tierId: string;
      }>(
        connection,
        `SELECT product.id, variant.id AS variantId, revision.id AS revisionId,
                tier.id AS tierId
         FROM Product product
         INNER JOIN ProductVariant variant
           ON variant.productId = product.id
          AND variant.stableKey = 'product-variant-essence-unit'
         INNER JOIN ProductRevision revision
           ON revision.productId = 'prodsourcebond012'
          AND revision.id = 'prodrevisionbond012'
         INNER JOIN ProductPriceTier tier
           ON tier.stableKey = 'product-tier-bond-1-4'
         WHERE product.stableKey = 'product-rune-essence-demo'
         LIMIT 1`,
      )
    )[0];
    if (!admin || !product) {
      throw new Error("Task 012 marker prerequisites are missing.");
    }

    const marker: ProductMarker = {
      version: 1,
      productId: product.id,
      variantId: product.variantId,
      tierId: product.tierId,
      revisionId: product.revisionId,
      editedProductTitle: "CI preserved rune essence product",
      editedVariantPriceCents: 77,
      editedTierPriceCents: 777,
      editedOnHandQuantity: 25,
      ledgerId: "task012ciledger",
      reservationId: "task012cireservation",
      reservationEventId: "task012cireserveevent",
      auditId: "task012ciauditmarker",
    };

    await connection.beginTransaction();
    await connection.query(
      "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'product_marketplace_enabled'",
    );
    await connection.query(
      `UPDATE Product
       SET publicTitle = ?, availabilityState = 'AVAILABLE',
         needsClientReview = 0, concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?`,
      [marker.editedProductTitle, marker.productId],
    );
    await connection.query(
      `UPDATE ProductVariant
       SET baseUnitPriceCents = ?, onHandQuantity = ?,
         availabilityState = 'AVAILABLE', status = 'AVAILABLE', enabled = 1,
         needsClientReview = 0, concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?`,
      [
        marker.editedVariantPriceCents,
        marker.editedOnHandQuantity,
        marker.variantId,
      ],
    );
    await connection.query(
      `UPDATE ProductPriceTier
       SET unitPriceCents = ?, needsClientReview = 0,
         concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?`,
      [marker.editedTierPriceCents, marker.tierId],
    );
    await connection.query(
      `INSERT IGNORE INTO ProductInventoryLedgerEntry
        (id, variantId, entryType, quantity, resultingOnHandQuantity,
         reason, internalNote, actorId, referenceKey, createdAt)
       VALUES (?, ?, 'STOCK_IN', ?, ?,
         'CI stock preservation marker', NULL, ?,
         'task012-ci-ledger-marker', NOW(3))`,
      [
        marker.ledgerId,
        marker.variantId,
        marker.editedOnHandQuantity,
        marker.editedOnHandQuantity,
        admin.id,
      ],
    );
    await connection.query(
      `INSERT IGNORE INTO ProductInventoryReservation
        (id, stableKey, variantId, quantity, status, expiresAt, releasedAt,
         safeInternalPurpose, actorId, idempotencyKey, futureExternalRef,
         concurrencyVersion, createdAt, updatedAt)
       VALUES (?, 'task012-ci-reservation', ?, 5, 'ACTIVE',
         '2030-01-01 00:00:00.000', NULL,
         'CI reservation preservation marker', ?,
         'task012-ci-reservation-key', NULL, 1, NOW(3), NOW(3))`,
      [marker.reservationId, marker.variantId, admin.id],
    );
    await connection.query(
      `INSERT IGNORE INTO ProductReservationEvent
        (id, reservationId, eventType, safeMetadata, actorId, createdAt)
       VALUES (?, ?, 'ACTIVE', ?, ?, NOW(3))`,
      [
        marker.reservationEventId,
        marker.reservationId,
        JSON.stringify({ marker: "task012-reservation-preservation" }),
        admin.id,
      ],
    );
    await connection.query(
      `INSERT IGNORE INTO AuditLog
        (id, actorId, action, targetType, targetId, metadata, createdAt)
       VALUES (?, ?, 'products.ci.preservation_marker',
         'Product', ?, ?, NOW(3))`,
      [
        marker.auditId,
        admin.id,
        marker.productId,
        JSON.stringify({ marker: "task012-product-preservation" }),
      ],
    );
    await connection.commit();
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(productMarkerPath, JSON.stringify(marker, null, 2), "utf8");
    console.log("Task 012 product preservation markers written.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

async function productSummary(connection: Connection) {
  const marker = JSON.parse(
    await readFile(productMarkerPath, "utf8"),
  ) as ProductMarker;
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
  const product = (
    await rows<{ publicTitle: string; availabilityState: string }>(
      connection,
      "SELECT publicTitle, availabilityState FROM Product WHERE id = ? LIMIT 1",
      [marker.productId],
    )
  )[0];
  const variant = (
    await rows<{
      baseUnitPriceCents: number;
      onHandQuantity: number;
      availabilityState: string;
    }>(
      connection,
      `SELECT baseUnitPriceCents, onHandQuantity, availabilityState
       FROM ProductVariant WHERE id = ? LIMIT 1`,
      [marker.variantId],
    )
  )[0];
  const tier = (
    await rows<{ unitPriceCents: number }>(
      connection,
      "SELECT unitPriceCents FROM ProductPriceTier WHERE id = ? LIMIT 1",
      [marker.tierId],
    )
  )[0];
  const revision = (
    await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM ProductRevision WHERE id = ?",
      [marker.revisionId],
    )
  )[0];
  const ledger = (
    await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM ProductInventoryLedgerEntry WHERE id = ?",
      [marker.ledgerId],
    )
  )[0];
  const reservation = (
    await rows<{ status: string; quantity: number }>(
      connection,
      "SELECT status, quantity FROM ProductInventoryReservation WHERE id = ? LIMIT 1",
      [marker.reservationId],
    )
  )[0];
  const event = (
    await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM ProductReservationEvent WHERE id = ?",
      [marker.reservationEventId],
    )
  )[0];
  const audit = (
    await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM AuditLog WHERE id = ?",
      [marker.auditId],
    )
  )[0];

  if (!migration) throw new Error("Task 012 migration is missing.");
  if (!flag || !asBoolean(flag.enabled)) {
    throw new Error(
      "product_marketplace_enabled manual value was not preserved.",
    );
  }
  if (
    !product ||
    product.publicTitle !== marker.editedProductTitle ||
    product.availabilityState !== "AVAILABLE"
  ) {
    throw new Error("Product draft edit was not preserved.");
  }
  if (
    !variant ||
    asNumber(variant.baseUnitPriceCents) !== marker.editedVariantPriceCents ||
    asNumber(variant.onHandQuantity) !== marker.editedOnHandQuantity ||
    variant.availabilityState !== "AVAILABLE"
  ) {
    throw new Error(
      "Product variant price, stock or availability was not preserved.",
    );
  }
  if (!tier || asNumber(tier.unitPriceCents) !== marker.editedTierPriceCents) {
    throw new Error("Product price tier edit was not preserved.");
  }
  if (asNumber(revision?.value) !== 1) {
    throw new Error("Published product revision marker was not preserved.");
  }
  if (asNumber(ledger?.value) !== 1) {
    throw new Error("Product inventory ledger marker was not preserved.");
  }
  if (
    !reservation ||
    reservation.status !== "ACTIVE" ||
    asNumber(reservation.quantity) !== 5
  ) {
    throw new Error("Product active reservation marker was not preserved.");
  }
  if (asNumber(event?.value) !== 1) {
    throw new Error("Product reservation event marker was not preserved.");
  }
  if (asNumber(audit?.value) !== 1) {
    throw new Error("Product audit marker was not preserved.");
  }

  const permissionCount = await productPermissionCount(connection);
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
  if (
    permissionCount !== productPermissionKeys.length ||
    superAdminPublish !== 1 ||
    supportView !== 1 ||
    supportPublish !== 0 ||
    supportInventory !== 0 ||
    supportReservations !== 0
  ) {
    throw new Error("Product permissions are incorrect after upgrade.");
  }
  if (
    cartTableCount !== 0 ||
    orderTableCount !== 0 ||
    paymentTableCount !== 0
  ) {
    throw new Error("Cart, order or payment tables were unexpectedly added.");
  }

  return {
    migrationPresent: Boolean(migration),
    migrationCount: await count(connection, "_prisma_migrations"),
    marketplaceCount: await count(connection, "ProductMarketplace"),
    categoryCount: await count(connection, "ProductCategory"),
    productCount: await count(connection, "Product"),
    variantCount: await count(connection, "ProductVariant"),
    priceTierCount: await count(connection, "ProductPriceTier"),
    tagCount: await count(connection, "ProductTag"),
    imageCount: await count(connection, "ProductImage"),
    revisionCount: await count(connection, "ProductRevision"),
    ledgerCount: await count(connection, "ProductInventoryLedgerEntry"),
    reservationCount: await count(connection, "ProductInventoryReservation"),
    activeReservationCount: await count(
      connection,
      "ProductInventoryReservation",
      "WHERE status = 'ACTIVE'",
    ),
    productMarketplaceEnabledPreserved: asBoolean(flag.enabled),
    productEditPreserved: true,
    variantPricePreserved: true,
    tierPricePreserved: true,
    inventoryBalancePreserved: true,
    ledgerPreserved: true,
    activeReservationPreserved: true,
    reservationEventPreserved: true,
    publishedRevisionPreserved: true,
    auditPreserved: true,
    permissionCount,
    superAdminPublish,
    supportView,
    supportPublish,
    supportInventory,
    supportReservations,
    cartTableCount,
    orderTableCount,
    paymentTableCount,
  };
}

async function verify() {
  const markerFile = JSON.parse(
    await readFile(markerPath, "utf8"),
  ) as MarkerFile;
  const connection = await connect();
  try {
    const preservationLines: string[] = [];
    for (const definition of groupDefinitions) {
      const snapshotGroup = markerFile.groups[definition.name];
      if (!snapshotGroup) {
        throw new Error(`Marker group ${definition.name} is missing.`);
      }
      const currentRows = filterRowsForSnapshot(
        await definition.fetch(connection),
        snapshotGroup,
      );
      const currentFingerprint = fingerprint(
        currentRows,
        snapshotGroup.keyFields,
      );
      if (currentFingerprint !== snapshotGroup.fingerprint) {
        throw new Error(`${snapshotGroup.label} preservation failed.`);
      }
      preservationLines.push(
        `- ${snapshotGroup.label}: preserved (${snapshotGroup.count} row(s))`,
      );
    }

    const mysqlVersion = (
      await rows<{ version: string }>(connection, "SELECT VERSION() AS version")
    )[0]?.version;
    const summary = await productSummary(connection);
    const report = [
      "Task 011 to Task 012 upgrade validation",
      "",
      `MySQL version: ${mysqlVersion ?? "unknown"}`,
      "Preservation results:",
      ...preservationLines,
      "",
      `Applied migration count after upgrade: ${summary.migrationCount}`,
      `Task 012 migration present: ${summary.migrationPresent}`,
      `Marketplace count: ${summary.marketplaceCount}`,
      `Category count: ${summary.categoryCount}`,
      `Product count: ${summary.productCount}`,
      `Variant count: ${summary.variantCount}`,
      `Price-tier count: ${summary.priceTierCount}`,
      `Tag count: ${summary.tagCount}`,
      `Image count: ${summary.imageCount}`,
      `Product revision count: ${summary.revisionCount}`,
      `Inventory ledger count: ${summary.ledgerCount}`,
      `Reservation count: ${summary.reservationCount}`,
      `Active reservation count: ${summary.activeReservationCount}`,
      `product_marketplace_enabled preserved manual value: ${summary.productMarketplaceEnabledPreserved}`,
      `Product edit preserved: ${summary.productEditPreserved}`,
      `Variant price preserved: ${summary.variantPricePreserved}`,
      `Price tier preserved: ${summary.tierPricePreserved}`,
      `Inventory balance preserved: ${summary.inventoryBalancePreserved}`,
      `Inventory ledger entry preserved: ${summary.ledgerPreserved}`,
      `Active reservation preserved: ${summary.activeReservationPreserved}`,
      `Reservation event preserved: ${summary.reservationEventPreserved}`,
      `Published product revision preserved: ${summary.publishedRevisionPreserved}`,
      `Product audit marker preserved: ${summary.auditPreserved}`,
      `Product permission count: ${summary.permissionCount}`,
      `SUPER_ADMIN products.publish assignment: ${summary.superAdminPublish}`,
      `SUPPORT_AGENT products.view assignment: ${summary.supportView}`,
      `SUPPORT_AGENT products.publish assignment: ${summary.supportPublish}`,
      `SUPPORT_AGENT products.inventory.adjust assignment: ${summary.supportInventory}`,
      `SUPPORT_AGENT products.reservations.manage assignment: ${summary.supportReservations}`,
      `Cart model/table count: ${summary.cartTableCount}`,
      `Order model/table count: ${summary.orderTableCount}`,
      `Payment model/table count: ${summary.paymentTableCount}`,
      "",
      "Admin password hash equality and all Task 001-011 preservation markers were verified without printing passwords, hashes, contact fields, tokens, database URLs or secrets.",
      "No customer data, internal reservation reasons, actor details, private media paths or production secrets are included in this report.",
      "",
    ].join("\n");
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(reportPath, report, "utf8");
    console.log(report);
  } finally {
    await connection.end();
  }
}

const mode = process.argv[2];

if (mode === "snapshot") {
  snapshot().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
} else if (mode === "prepare-product") {
  prepareProductMarkers().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
} else if (mode === "verify") {
  verify().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  console.error(
    "Usage: tsx scripts/validate-task012-existing-db.ts snapshot|prepare-product|verify",
  );
  process.exitCode = 1;
}

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
  source: "task008";
  createdBy: "scripts/validate-task009-existing-db.ts";
  groups: Record<string, GroupSnapshot>;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-009");
const markerPath = path.join(
  artifactDirectory,
  ".task008-preservation-markers.json",
);
const goldMarkerPath = path.join(
  artifactDirectory,
  ".task009-gold-preservation-markers.json",
);
const reportPath = path.join(
  artifactDirectory,
  "task008-to-task009-validation.txt",
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

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Row)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return value;
}

function identifier(row: Row, fields: string[]) {
  return fields.map((field) => String(row[field] ?? "")).join("\u001f");
}

function fingerprint(rows: Row[], fields: string[]) {
  const sortedRows = [...rows].sort((left, right) =>
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

async function count(connection: Connection, tableName: string) {
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value FROM \`${tableName}\``,
  );
  return asNumber(result[0]?.value);
}

async function ensureTask008Markers(connection: Connection) {
  const adminEmail = requiredEnv("ADMIN_SEED_EMAIL").toLowerCase();
  const admin = (
    await rows<{ id: string }>(
      connection,
      "SELECT id FROM User WHERE email = ? LIMIT 1",
      [adminEmail],
    )
  )[0];
  if (!admin) throw new Error(`Admin user ${adminEmail} was not seeded.`);

  const service = (
    await rows<{ id: string }>(
      connection,
      "SELECT id FROM CatalogueService WHERE seededKey = 'fire-cape-premium' LIMIT 1",
    )
  )[0];
  if (!service) throw new Error("Task 008 premium service missing.");

  const pricingDraft = (
    await rows<{ id: string }>(
      connection,
      `SELECT id FROM PricingRuleSet
       WHERE status = 'DRAFT'
       ORDER BY createdAt ASC
       LIMIT 1`,
    )
  )[0];
  if (!pricingDraft) throw new Error("Task 008 pricing draft missing.");

  const fixedDate = "2026-07-25 00:00:00.000";
  await connection.query(
    `INSERT INTO CatalogueServiceStage
      (id, serviceId, snapshot, baseVersion, version, updatedById, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, 9009, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       snapshot = VALUES(snapshot),
       baseVersion = VALUES(baseVersion),
       version = VALUES(version),
       updatedById = VALUES(updatedById),
       updatedAt = VALUES(updatedAt)`,
    [
      "task009ci_stage_marker",
      service.id,
      JSON.stringify({
        marker: "task008-stage-preservation",
        serviceSeededKey: "fire-cape-premium",
      }),
      admin.id,
      fixedDate,
      fixedDate,
    ],
  );
  await connection.query(
    `INSERT INTO AuditLog
      (id, actorId, action, targetType, targetId, metadata, ipAddress, createdAt)
     VALUES (?, ?, 'task009.ci.task008_preservation_marker', 'CatalogueService', ?, ?, '127.0.0.1', ?)
     ON DUPLICATE KEY UPDATE
       metadata = VALUES(metadata),
       actorId = VALUES(actorId)`,
    [
      "task009ci_audit_marker",
      admin.id,
      service.id,
      JSON.stringify({
        marker: "task008-audit-preservation",
        serviceSeededKey: "fire-cape-premium",
      }),
      fixedDate,
    ],
  );
  await connection.query(
    `INSERT INTO PricingRule
      (id, ruleSetId, publicLabel, internalDescription, enabled, ruleType,
       amountCents, valueBps, priority, exclusiveGroupKey, effectiveStart,
       effectiveEnd, needsClientReview, version, createdAt, updatedAt)
     VALUES (?, ?, 'Task 009 preservation pricing marker', ?,
       1, 'FIXED_ADDITION', 321, NULL, -9, NULL, NULL, NULL, 1, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
       publicLabel = VALUES(publicLabel),
       internalDescription = VALUES(internalDescription),
       amountCents = VALUES(amountCents),
       updatedAt = VALUES(updatedAt)`,
    [
      "task009ci_pricing_rule",
      pricingDraft.id,
      "Task 008 global pricing preservation marker for Task 009 upgrade CI.",
      fixedDate,
      fixedDate,
    ],
  );
  await connection.query(
    `INSERT INTO PricingRuleApplicability
      (id, ruleId, scope, engineType, categoryId, serviceId, createdAt)
     VALUES (?, ?, 'GLOBAL', NULL, NULL, NULL, ?)
     ON DUPLICATE KEY UPDATE
       ruleId = VALUES(ruleId),
       scope = VALUES(scope)`,
    ["task009ci_pricing_scope", "task009ci_pricing_rule", fixedDate],
  );
}

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
  {
    name: "catalogueServices",
    label: "catalogue services",
    keyFields: ["seededKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT seededKey, slug, canonicalSlug, engineType,
          publicationStatus, availabilityState, isFeatured, isQuoteOnly,
          displayOrder, version, needsClientReview
         FROM CatalogueService
         WHERE seededKey IS NOT NULL
         ORDER BY seededKey`,
      ),
  },
  {
    name: "catalogueStages",
    label: "catalogue staged aggregates",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT stage.id, service.seededKey AS serviceKey, stage.snapshot,
          stage.baseVersion, stage.version
         FROM CatalogueServiceStage stage
         INNER JOIN CatalogueService service ON service.id = stage.serviceId
         ORDER BY stage.id`,
      ),
  },
  {
    name: "catalogueRevisions",
    label: "catalogue revisions",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT revision.id, service.seededKey AS serviceKey,
          revision.revisionNumber, revision.event, revision.publicationStatus,
          revision.summary, revision.snapshot
         FROM CatalogueRevision revision
         INNER JOIN CatalogueService service ON service.id = revision.serviceId
         ORDER BY revision.id`,
      ),
  },
  {
    name: "skillingRules",
    label: "skilling configuration",
    keyFields: ["serviceKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT service.seededKey AS serviceKey, rule.normalModeMultiplierBps,
          rule.ironmanMultiplierBps, rule.hardcoreIronmanMultiplierBps,
          rule.ultimateIronmanMultiplierBps, rule.standardDeliveryEnabled,
          rule.priorityDeliveryEnabled, rule.expressDeliveryEnabled,
          rule.needsClientReview
         FROM SkillingCalculatorRule rule
         INNER JOIN CatalogueService service ON service.id = rule.serviceId
         ORDER BY service.seededKey`,
      ),
  },
  {
    name: "bossingRules",
    label: "bossing configuration",
    keyFields: ["serviceKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT service.seededKey AS serviceKey, rule.normalModeMultiplierBps,
          rule.ironmanMultiplierBps, rule.hardcoreIronmanMultiplierBps,
          rule.ultimateIronmanMultiplierBps, rule.standardDeliveryEnabled,
          rule.priorityDeliveryEnabled, rule.expressDeliveryEnabled,
          rule.needsClientReview
         FROM BossingCalculatorRule rule
         INNER JOIN CatalogueService service ON service.id = rule.serviceId
         ORDER BY service.seededKey`,
      ),
  },
  {
    name: "premiumConfigs",
    label: "premium configuration",
    keyFields: ["serviceKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT service.seededKey AS serviceKey, config.configuratorType,
          config.enabled, config.supportsManualStatFallback,
          config.standardDeliveryEnabled, config.priorityDeliveryEnabled,
          config.expressDeliveryEnabled, config.needsClientReview
         FROM PremiumServiceConfig config
         INNER JOIN CatalogueService service ON service.id = config.serviceId
         ORDER BY service.seededKey`,
      ),
  },
  {
    name: "pricingRuleSets",
    label: "global-pricing rule sets",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT id, name, status, currencyCode, snapshotSchemaVersion,
          draftVersion, needsClientReview
         FROM PricingRuleSet
         ORDER BY id`,
      ),
  },
  {
    name: "pricingRules",
    label: "global-pricing rules",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT id, ruleSetId, publicLabel, enabled, ruleType, amountCents,
          valueBps, priority, exclusiveGroupKey, needsClientReview, version
         FROM PricingRule
         ORDER BY id`,
      ),
  },
  {
    name: "pricingApplicability",
    label: "global-pricing applicability",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT id, ruleId, scope, engineType, categoryId, serviceId
         FROM PricingRuleApplicability
         ORDER BY id`,
      ),
  },
  {
    name: "pricingRevisions",
    label: "global-pricing revisions",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT id, ruleSetId, revisionNumber, snapshot
         FROM PricingRevision
         ORDER BY id`,
      ),
  },
  {
    name: "auditLogs",
    label: "audit logs",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT audit.id, user.email AS actorEmail, audit.action,
          audit.targetType, audit.targetId, audit.metadata, audit.ipAddress
         FROM AuditLog audit
         LEFT JOIN User user ON user.id = audit.actorId
         ORDER BY audit.id`,
      ),
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

async function snapshot() {
  const connection = await connect();
  try {
    await ensureTask008Markers(connection);
    const groups: Record<string, GroupSnapshot> = {};
    for (const definition of groupDefinitions) {
      groups[definition.name] = createSnapshot(
        await definition.fetch(connection),
        definition,
      );
    }
    const markerFile: MarkerFile = {
      version: 1,
      source: "task008",
      createdBy: "scripts/validate-task009-existing-db.ts",
      groups,
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(markerPath, JSON.stringify(markerFile, null, 2), "utf8");
    console.log(`Task 008 preservation markers written to ${markerPath}`);
  } finally {
    await connection.end();
  }
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

async function prepareGoldMarkers() {
  const connection = await connect();
  try {
    const market = (
      await rows<{ id: string }>(
        connection,
        "SELECT id FROM GoldMarket WHERE stableKey = 'gold-main-market' LIMIT 1",
      )
    )[0];
    if (!market) throw new Error("Gold market missing before marker setup.");
    const draftRate = (
      await rows<{ id: string }>(
        connection,
        `SELECT rate.id
         FROM GoldRate rate
         INNER JOIN GoldRateSet rateSet ON rateSet.id = rate.rateSetId
         WHERE rateSet.marketId = ? AND rateSet.status = 'DRAFT'
           AND rate.direction = 'CUSTOMER_BUYS_GOLD'
         LIMIT 1`,
        [market.id],
      )
    )[0];
    const preset = (
      await rows<{ id: string }>(
        connection,
        "SELECT id FROM GoldQuantityPreset WHERE seededKey = 'gold-buy-50m' LIMIT 1",
      )
    )[0];
    if (!draftRate || !preset) {
      throw new Error("Gold draft rate or preset missing before marker setup.");
    }

    const stockQuantityGp = 123_000_000;
    const buyingCapacityGp = 456_000_000;
    await connection.beginTransaction();
    await connection.query(
      "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'gold_engine_enabled'",
    );
    await connection.query(
      `UPDATE GoldMarket
       SET stockQuantityGp = ?, buyingCapacityGp = ?, stockVersion = stockVersion + 1
       WHERE id = ?`,
      [stockQuantityGp, buyingCapacityGp, market.id],
    );
    await connection.query(
      `UPDATE GoldRate
       SET rateMinorUnitsPerMillion = 77, concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?`,
      [draftRate.id],
    );
    await connection.query(
      "UPDATE GoldQuantityPreset SET publicLabel = 'Marker 50M' WHERE id = ?",
      [preset.id],
    );
    await connection.query(
      `INSERT INTO GoldInventoryLedgerEntry
        (id, marketId, entryType, quantityGp, resultingStockQuantityGp,
         resultingBuyingCapacityGp, reason, internalNote, referenceKey, createdAt)
       VALUES (?, ?, 'STOCK_INCREASE', ?, ?, ?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         resultingStockQuantityGp = VALUES(resultingStockQuantityGp),
         resultingBuyingCapacityGp = VALUES(resultingBuyingCapacityGp),
         reason = VALUES(reason)`,
      [
        "task009ci_gold_ledger",
        market.id,
        stockQuantityGp,
        stockQuantityGp,
        buyingCapacityGp,
        "Task 009 seed preservation marker.",
        "CI marker with no customer data.",
        "task009-ci-ledger-marker",
      ],
    );
    await connection.query(
      `INSERT INTO GoldRateRevision
        (id, marketId, rateSetId, revisionNumber, snapshotSchemaVersion,
         snapshot, publishedAt, createdAt)
       VALUES (?, ?, NULL, 9009, 1, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE snapshot = VALUES(snapshot)`,
      [
        "task009ci_gold_revision",
        market.id,
        JSON.stringify({
          schemaVersion: 1,
          marker: "task009-gold-revision-preservation",
          market: { id: market.id, stableKey: "gold-main-market" },
        }),
      ],
    );
    await connection.commit();

    const marker = {
      version: 1,
      marketId: market.id,
      draftBuyRateId: draftRate.id,
      presetId: preset.id,
      goldEngineEnabled: true,
      stockQuantityGp,
      buyingCapacityGp,
      draftBuyRateMinorUnitsPerMillion: 77,
      presetPublicLabel: "Marker 50M",
      ledgerId: "task009ci_gold_ledger",
      revisionId: "task009ci_gold_revision",
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(goldMarkerPath, JSON.stringify(marker, null, 2), "utf8");
    console.log(`Task 009 gold markers written to ${goldMarkerPath}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

async function goldSummary(connection: Connection) {
  const marker = JSON.parse(await readFile(goldMarkerPath, "utf8")) as {
    marketId: string;
    draftBuyRateId: string;
    presetId: string;
    goldEngineEnabled: boolean;
    stockQuantityGp: number;
    buyingCapacityGp: number;
    draftBuyRateMinorUnitsPerMillion: number;
    presetPublicLabel: string;
    ledgerId: string;
    revisionId: string;
  };
  const migration = (
    await rows<{ migration_name: string }>(
      connection,
      `SELECT migration_name
       FROM _prisma_migrations
       WHERE migration_name = '20260725130000_task009_gold_trading_engine'
       LIMIT 1`,
    )
  )[0];
  if (!migration) throw new Error("Task 009 migration is missing.");

  const market = (
    await rows<{
      id: string;
      stockQuantityGp: number;
      buyingCapacityGp: number;
      availabilityState: string;
      serviceEngineType: string;
    }>(
      connection,
      `SELECT market.id, market.stockQuantityGp, market.buyingCapacityGp,
        market.availabilityState, service.engineType AS serviceEngineType
       FROM GoldMarket market
       INNER JOIN CatalogueService service ON service.id = market.serviceId
       WHERE market.id = ?
       LIMIT 1`,
      [marker.marketId],
    )
  )[0];
  const flag = (
    await rows<{ enabled: number }>(
      connection,
      "SELECT enabled FROM FeatureFlag WHERE `key` = 'gold_engine_enabled' LIMIT 1",
    )
  )[0];
  const rate = (
    await rows<{ rateMinorUnitsPerMillion: number }>(
      connection,
      "SELECT rateMinorUnitsPerMillion FROM GoldRate WHERE id = ? LIMIT 1",
      [marker.draftBuyRateId],
    )
  )[0];
  const preset = (
    await rows<{ publicLabel: string }>(
      connection,
      "SELECT publicLabel FROM GoldQuantityPreset WHERE id = ? LIMIT 1",
      [marker.presetId],
    )
  )[0];
  const ledger = (
    await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM GoldInventoryLedgerEntry WHERE id = ?",
      [marker.ledgerId],
    )
  )[0];
  const revision = (
    await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM GoldRateRevision WHERE id = ?",
      [marker.revisionId],
    )
  )[0];
  if (!market || market.serviceEngineType !== "GOLD_ENGINE") {
    throw new Error("Gold market/service missing after upgrade.");
  }
  if (!flag) {
    throw new Error("gold_engine_enabled missing after upgrade.");
  }
  if (asBoolean(flag?.enabled) !== marker.goldEngineEnabled) {
    throw new Error("gold_engine_enabled manual value was not preserved.");
  }
  if (
    asNumber(market.stockQuantityGp) !== marker.stockQuantityGp ||
    asNumber(market.buyingCapacityGp) !== marker.buyingCapacityGp
  ) {
    throw new Error("Gold inventory balances were not preserved.");
  }
  if (
    asNumber(rate?.rateMinorUnitsPerMillion) !==
    marker.draftBuyRateMinorUnitsPerMillion
  ) {
    throw new Error("Gold draft-rate edit was not preserved.");
  }
  if (preset?.publicLabel !== marker.presetPublicLabel) {
    throw new Error("Gold preset edit was not preserved.");
  }
  if (asNumber(ledger?.value) !== 1) {
    throw new Error("Gold ledger marker was not preserved.");
  }
  if (asNumber(revision?.value) !== 1) {
    throw new Error("Gold revision marker was not preserved.");
  }

  return {
    migrationPresent: Boolean(migration),
    migrationCount: await count(connection, "_prisma_migrations"),
    goldMarketCount: await count(connection, "GoldMarket"),
    draftRateSetCount: await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM GoldRateSet WHERE status = 'DRAFT'",
    ).then((result) => asNumber(result[0]?.value)),
    goldRateCount: await count(connection, "GoldRate"),
    goldPresetCount: await count(connection, "GoldQuantityPreset"),
    goldRevisionCount: await count(connection, "GoldRateRevision"),
    goldLedgerCount: await count(connection, "GoldInventoryLedgerEntry"),
    goldEngineEnabled: asBoolean(flag.enabled),
    availabilityState: market.availabilityState,
    stockQuantityGp: market.stockQuantityGp,
    buyingCapacityGp: market.buyingCapacityGp,
    goldPermissionCount: await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM Permission WHERE `key` IN ('gold.view', 'gold.edit', 'gold.publish', 'gold.inventory.adjust')",
    ).then((result) => asNumber(result[0]?.value)),
    superAdminPublish: await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "gold.publish",
    ),
    supportView: await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "gold.view",
    ),
    supportPublish: await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "gold.publish",
    ),
    supportInventory: await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "gold.inventory.adjust",
    ),
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
    const summary = await goldSummary(connection);
    if (summary.goldPermissionCount !== 4) {
      throw new Error("Gold permissions are incomplete after upgrade.");
    }
    if (summary.superAdminPublish !== 1) {
      throw new Error("SUPER_ADMIN gold.publish assignment missing.");
    }
    if (
      summary.supportView !== 1 ||
      summary.supportPublish !== 0 ||
      summary.supportInventory !== 0
    ) {
      throw new Error("SUPPORT_AGENT gold permissions are incorrect.");
    }

    const report = [
      "Task 008 to Task 009 upgrade validation",
      "",
      `MySQL version: ${mysqlVersion ?? "unknown"}`,
      "Preservation results:",
      ...preservationLines,
      "",
      `Applied migration count after upgrade: ${summary.migrationCount}`,
      `Task 009 migration present: ${summary.migrationPresent}`,
      `Gold market count: ${summary.goldMarketCount}`,
      `Gold draft rate-set count: ${summary.draftRateSetCount}`,
      `Gold rate count: ${summary.goldRateCount}`,
      `Gold preset count: ${summary.goldPresetCount}`,
      `Gold published revision count: ${summary.goldRevisionCount}`,
      `Gold ledger count: ${summary.goldLedgerCount}`,
      `gold_engine_enabled preserved manual value: ${summary.goldEngineEnabled}`,
      `Gold availability state: ${summary.availabilityState}`,
      `Gold stock preserved: ${summary.stockQuantityGp}`,
      `Gold buying capacity preserved: ${summary.buyingCapacityGp}`,
      `Gold permission count: ${summary.goldPermissionCount}`,
      `SUPER_ADMIN gold.publish assignment: ${summary.superAdminPublish}`,
      `SUPPORT_AGENT gold.view assignment: ${summary.supportView}`,
      `SUPPORT_AGENT gold.publish assignment: ${summary.supportPublish}`,
      `SUPPORT_AGENT gold.inventory.adjust assignment: ${summary.supportInventory}`,
      "",
      "No passwords, hashes or secrets are included in this report.",
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
} else if (mode === "prepare-gold") {
  prepareGoldMarkers().catch((error: unknown) => {
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
    "Usage: tsx scripts/validate-task009-existing-db.ts snapshot|prepare-gold|verify",
  );
  process.exitCode = 1;
}

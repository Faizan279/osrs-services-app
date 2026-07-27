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
  source: "task009";
  createdBy: "scripts/validate-task010-existing-db.ts";
  groups: Record<string, GroupSnapshot>;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-010");
const markerPath = path.join(
  artifactDirectory,
  ".task009-preservation-markers.json",
);
const accountMarkerPath = path.join(
  artifactDirectory,
  ".task010-account-preservation-markers.json",
);
const reportPath = path.join(
  artifactDirectory,
  "task009-to-task010-validation.txt",
);

const credentialColumnPattern =
  /(password|login|credential|recoveryAnswer|recoveryQuestion|authenticatorSecret|authenticatorSeed|sessionToken|cookie|bankPinValue|emailAddress|loginEmail)/i;

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
    name: "pricingRevisions",
    label: "global-pricing revisions",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        "SELECT id, ruleSetId, revisionNumber, snapshot FROM PricingRevision ORDER BY id",
      ),
  },
  {
    name: "goldMarkets",
    label: "gold markets",
    keyFields: ["stableKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT stableKey, serviceId, publicName, slug, currencyCode,
          availabilityState, stockQuantityGp, buyingCapacityGp, stockVersion,
          draftVersion, needsClientReview
         FROM GoldMarket
         ORDER BY stableKey`,
      ),
  },
  {
    name: "goldRateSets",
    label: "gold rate sets",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        "SELECT id, marketId, status, version, needsClientReview, concurrencyVersion FROM GoldRateSet ORDER BY id",
      ),
  },
  {
    name: "goldRates",
    label: "gold rates",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT id, rateSetId, direction, rateMinorUnitsPerMillion,
          minimumQuantityGp, maximumQuantityGp, automaticReviewMaximumGp,
          enabled, needsClientReview, concurrencyVersion
         FROM GoldRate
         ORDER BY id`,
      ),
  },
  {
    name: "goldPresets",
    label: "gold quantity presets",
    keyFields: ["seededKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT seededKey, marketId, direction, publicLabel, quantityGp,
          sortOrder, enabled, needsClientReview, concurrencyVersion
         FROM GoldQuantityPreset
         WHERE seededKey IS NOT NULL
         ORDER BY seededKey`,
      ),
  },
  {
    name: "goldLedger",
    label: "gold inventory ledger",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT id, marketId, entryType, quantityGp, resultingStockQuantityGp,
          resultingBuyingCapacityGp, reason, referenceKey
         FROM GoldInventoryLedgerEntry
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

async function credentialColumnMatches(connection: Connection) {
  const columns = await rows<{ tableName: string; columnName: string }>(
    connection,
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME LIKE 'Account%'`,
  );
  return columns
    .filter((column) => credentialColumnPattern.test(column.columnName))
    .map((column) => `${column.tableName}.${column.columnName}`);
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
      source: "task009",
      createdBy: "scripts/validate-task010-existing-db.ts",
      groups,
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(markerPath, JSON.stringify(markerFile, null, 2), "utf8");
    console.log(`Task 009 preservation markers written to ${markerPath}`);
  } finally {
    await connection.end();
  }
}

async function prepareAccountMarkers() {
  const connection = await connect();
  try {
    const adminEmail = requiredEnv("ADMIN_SEED_EMAIL").toLowerCase();
    const admin = (
      await rows<{ id: string }>(
        connection,
        "SELECT id FROM User WHERE email = ? LIMIT 1",
        [adminEmail],
      )
    )[0];
    const listing = (
      await rows<{ id: string; concurrencyVersion: number }>(
        connection,
        "SELECT id, concurrencyVersion FROM AccountListing WHERE stableKey = 'account-main-pvm-ready' LIMIT 1",
      )
    )[0];
    if (!admin || !listing) {
      throw new Error(
        "Account preservation marker setup prerequisites missing.",
      );
    }

    await connection.beginTransaction();
    await connection.query(
      "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'account_marketplace_enabled'",
    );
    await connection.query(
      `UPDATE AccountListing
       SET basePriceCents = 33333, availability = 'HELD',
         needsClientReview = 0, concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?`,
      [listing.id],
    );
    await connection.query(
      `INSERT INTO AccountListingHold
        (id, stableKey, listingId, status, previousAvailability, startsAt,
         expiresAt, reason, createdById, concurrencyVersion, createdAt, updatedAt)
       VALUES (?, ?, ?, 'ACTIVE', 'AVAILABLE', NOW(3),
         '2030-01-01 00:00:00.000', ?, ?, 1, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         status = 'ACTIVE',
         previousAvailability = 'AVAILABLE',
         expiresAt = VALUES(expiresAt),
         reason = VALUES(reason),
         createdById = VALUES(createdById)`,
      [
        "task010ciaccounthold",
        "task010-ci-account-hold",
        listing.id,
        "Task 010 upgrade validation hold with no customer data.",
        admin.id,
      ],
    );
    await connection.query(
      `UPDATE AccountListingHandoverChecklist
       SET readyForFutureHandover = 1,
         handoverInstructionsPrepared = 1,
         readiness = 'READY_FOR_FUTURE_HANDOVER',
         needsClientReview = 0,
         concurrencyVersion = concurrencyVersion + 1
       WHERE listingId = ?`,
      [listing.id],
    );
    await connection.query(
      `INSERT INTO AuditLog
        (id, actorId, action, targetType, targetId, metadata, createdAt)
       VALUES (?, ?, 'task010.ci.account_preservation_marker',
         'AccountListing', ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE actorId = VALUES(actorId), metadata = VALUES(metadata)`,
      [
        "task010ciaccountaudit",
        admin.id,
        listing.id,
        JSON.stringify({ marker: "task010-account-preservation" }),
      ],
    );
    await connection.commit();
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(
      accountMarkerPath,
      JSON.stringify(
        {
          version: 1,
          listingId: listing.id,
          accountMarketplaceEnabled: true,
          basePriceCents: 33333,
          availability: "HELD",
          holdId: "task010ciaccounthold",
          handoverReady: true,
          auditId: "task010ciaccountaudit",
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

async function accountSummary(connection: Connection) {
  const marker = JSON.parse(await readFile(accountMarkerPath, "utf8")) as {
    listingId: string;
    accountMarketplaceEnabled: boolean;
    basePriceCents: number;
    availability: string;
    holdId: string;
    handoverReady: boolean;
    auditId: string;
  };
  const migration = (
    await rows<{ migration_name: string }>(
      connection,
      `SELECT migration_name
       FROM _prisma_migrations
       WHERE migration_name = '20260727150000_task010_account_marketplace'
       LIMIT 1`,
    )
  )[0];
  const flag = (
    await rows<{ enabled: number }>(
      connection,
      "SELECT enabled FROM FeatureFlag WHERE `key` = 'account_marketplace_enabled' LIMIT 1",
    )
  )[0];
  const listing = (
    await rows<{
      basePriceCents: number;
      availability: string;
      serviceEngineType: string;
    }>(
      connection,
      `SELECT listing.basePriceCents, listing.availability,
        service.engineType AS serviceEngineType
       FROM AccountListing listing
       INNER JOIN AccountMarketplace market ON market.id = listing.marketplaceId
       INNER JOIN CatalogueService service ON service.id = market.serviceId
       WHERE listing.id = ?
       LIMIT 1`,
      [marker.listingId],
    )
  )[0];
  const hold = (
    await rows<{ status: string; value: number }>(
      connection,
      "SELECT status, COUNT(*) AS value FROM AccountListingHold WHERE id = ? GROUP BY status",
      [marker.holdId],
    )
  )[0];
  const handover = (
    await rows<{ readyForFutureHandover: number; readiness: string }>(
      connection,
      "SELECT readyForFutureHandover, readiness FROM AccountListingHandoverChecklist WHERE listingId = ? LIMIT 1",
      [marker.listingId],
    )
  )[0];
  const audit = (
    await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM AuditLog WHERE id = ?",
      [marker.auditId],
    )
  )[0];
  const credentialColumns = await credentialColumnMatches(connection);

  if (!migration) throw new Error("Task 010 migration is missing.");
  if (!flag || asBoolean(flag.enabled) !== marker.accountMarketplaceEnabled) {
    throw new Error(
      "account_marketplace_enabled manual value was not preserved.",
    );
  }
  if (!listing || listing.serviceEngineType !== "ACCOUNT_MARKETPLACE") {
    throw new Error("Account listing/service missing after upgrade.");
  }
  if (
    asNumber(listing.basePriceCents) !== marker.basePriceCents ||
    listing.availability !== marker.availability
  ) {
    throw new Error("Account listing edits were not preserved.");
  }
  if (!hold || hold.status !== "ACTIVE" || asNumber(hold.value) !== 1) {
    throw new Error("Active account hold marker was not preserved.");
  }
  if (
    !handover ||
    asBoolean(handover.readyForFutureHandover) !== marker.handoverReady ||
    handover.readiness !== "READY_FOR_FUTURE_HANDOVER"
  ) {
    throw new Error("Account handover readiness marker was not preserved.");
  }
  if (asNumber(audit?.value) !== 1) {
    throw new Error("Account audit marker was not preserved.");
  }
  if (credentialColumns.length > 0) {
    throw new Error(
      `Credential-like account columns detected: ${credentialColumns.join(", ")}`,
    );
  }

  return {
    migrationPresent: Boolean(migration),
    migrationCount: await count(connection, "_prisma_migrations"),
    marketplaceCount: await count(connection, "AccountMarketplace"),
    listingCount: await count(connection, "AccountListing"),
    statCount: await count(connection, "AccountListingStat"),
    unlockCount: await count(connection, "AccountListingUnlock"),
    featureCount: await count(connection, "AccountListingFeature"),
    imageCount: await count(connection, "AccountListingImage"),
    revisionCount: await count(connection, "AccountListingRevision"),
    holdCount: await count(connection, "AccountListingHold"),
    accountMarketplaceEnabled: asBoolean(flag.enabled),
    basePriceCents: listing.basePriceCents,
    availability: listing.availability,
    activeHoldPreserved: hold.status === "ACTIVE",
    handoverReady: asBoolean(handover.readyForFutureHandover),
    accountPermissionCount: await rows<{ value: number }>(
      connection,
      `SELECT COUNT(*) AS value FROM Permission
       WHERE \`key\` IN (
         'accounts.view',
         'accounts.edit',
         'accounts.approve',
         'accounts.publish',
         'accounts.availability.manage',
         'accounts.handover.review'
       )`,
    ).then((result) => asNumber(result[0]?.value)),
    superAdminPublish: await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "accounts.publish",
    ),
    supportView: await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.view",
    ),
    supportPublish: await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.publish",
    ),
    supportApprove: await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.approve",
    ),
    supportAvailability: await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.availability.manage",
    ),
    supportHandover: await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "accounts.handover.review",
    ),
    credentialColumnCount: credentialColumns.length,
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
    const summary = await accountSummary(connection);
    if (
      summary.accountPermissionCount !== 6 ||
      summary.superAdminPublish !== 1 ||
      summary.supportView !== 1 ||
      summary.supportPublish !== 0 ||
      summary.supportApprove !== 0 ||
      summary.supportAvailability !== 0 ||
      summary.supportHandover !== 0
    ) {
      throw new Error("Account permissions are incorrect after upgrade.");
    }

    const report = [
      "Task 009 to Task 010 upgrade validation",
      "",
      `MySQL version: ${mysqlVersion ?? "unknown"}`,
      "Preservation results:",
      ...preservationLines,
      "",
      `Applied migration count after upgrade: ${summary.migrationCount}`,
      `Task 010 migration present: ${summary.migrationPresent}`,
      `Account marketplace count: ${summary.marketplaceCount}`,
      `Account listing count: ${summary.listingCount}`,
      `Account stat count: ${summary.statCount}`,
      `Account unlock count: ${summary.unlockCount}`,
      `Account feature count: ${summary.featureCount}`,
      `Account image count: ${summary.imageCount}`,
      `Account revision count: ${summary.revisionCount}`,
      `Account hold count: ${summary.holdCount}`,
      `account_marketplace_enabled preserved manual value: ${summary.accountMarketplaceEnabled}`,
      `Account listing edited price preserved: ${summary.basePriceCents}`,
      `Account listing availability preserved: ${summary.availability}`,
      `Active account hold preserved: ${summary.activeHoldPreserved}`,
      `Handover readiness preserved: ${summary.handoverReady}`,
      `Account permission count: ${summary.accountPermissionCount}`,
      `SUPER_ADMIN accounts.publish assignment: ${summary.superAdminPublish}`,
      `SUPPORT_AGENT accounts.view assignment: ${summary.supportView}`,
      `SUPPORT_AGENT accounts.publish assignment: ${summary.supportPublish}`,
      `SUPPORT_AGENT accounts.approve assignment: ${summary.supportApprove}`,
      `SUPPORT_AGENT accounts.availability.manage assignment: ${summary.supportAvailability}`,
      `SUPPORT_AGENT accounts.handover.review assignment: ${summary.supportHandover}`,
      `Credential-like account columns detected: ${summary.credentialColumnCount}`,
      "",
      "Password hash equality was verified without printing the hash.",
      "No passwords, hashes, database URLs or secrets are included in this report.",
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
} else if (mode === "prepare-accounts") {
  prepareAccountMarkers().catch((error: unknown) => {
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
    "Usage: tsx scripts/validate-task010-existing-db.ts snapshot|prepare-accounts|verify",
  );
  process.exitCode = 1;
}

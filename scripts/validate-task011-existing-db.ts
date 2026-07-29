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
  source: "task010";
  createdBy: "scripts/validate-task011-existing-db.ts";
  groups: Record<string, GroupSnapshot>;
};

type CustomBuildMarker = {
  version: 1;
  serviceConfigId: string;
  editedMinimumAutomaticEstimateCents: number;
  editedSkillRuleCentsPerMillionXp: number;
  editedObjectiveName: string;
  requestId: string;
  attachmentId: string;
  quoteId: string;
  revisionId: string;
  decisionId: string;
  auditId: string;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-011");
const markerPath = path.join(
  artifactDirectory,
  ".task010-preservation-markers.json",
);
const customBuildMarkerPath = path.join(
  artifactDirectory,
  ".task011-custom-build-preservation-markers.json",
);
const reportPath = path.join(
  artifactDirectory,
  "task010-to-task011-validation.txt",
);
const task011MigrationName = "20260728150000_task011_custom_account_build";
const customBuildPermissionKeys = [
  "custom_builds.view",
  "custom_builds.edit",
  "custom_builds.publish",
  "custom_builds.requests.review",
  "custom_builds.attachments.review",
  "custom_builds.quotes.manage",
] as const;

const credentialColumnPattern =
  /(password|passcode|credential|login|recovery|authenticator|twofactor|two_factor|2fa|backupCode|backup_code|cookie|bankPin|bank_pin|emailPassword|email_password|rawToken|sessionToken)/i;

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

const tableGroups = [
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
  ...tableGroups.map(
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

async function credentialColumnMatches(connection: Connection) {
  const columns = await rows<{ tableName: string; columnName: string }>(
    connection,
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME LIKE 'CustomBuild%'`,
  );
  return columns
    .filter((column) => credentialColumnPattern.test(column.columnName))
    .map((column) => `${column.tableName}.${column.columnName}`);
}

async function customBuildPermissionCount(connection: Connection) {
  const placeholders = customBuildPermissionKeys.map(() => "?").join(", ");
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value FROM Permission WHERE \`key\` IN (${placeholders})`,
    [...customBuildPermissionKeys],
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
      source: "task010",
      createdBy: "scripts/validate-task011-existing-db.ts",
      groups,
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(markerPath, JSON.stringify(markerFile, null, 2), "utf8");
    console.log(`Task 010 preservation markers written to ${markerPath}`);
  } finally {
    await connection.end();
  }
}

async function prepareCustomBuildMarkers() {
  const connection = await connect();
  try {
    const service = (
      await rows<{ id: string }>(
        connection,
        "SELECT id FROM CustomBuildService WHERE stableKey = 'custom-account-build-main' LIMIT 1",
      )
    )[0];
    const revision = (
      await rows<{ id: string }>(
        connection,
        "SELECT id FROM CustomBuildRevision WHERE id = 'custombuildrevision011' LIMIT 1",
      )
    )[0];
    const objective = (
      await rows<{ id: string }>(
        connection,
        "SELECT id FROM CustomBuildObjective WHERE stableKey = 'custom-build:quest:barrows-gloves' LIMIT 1",
      )
    )[0];
    const admin = (
      await rows<{ id: string }>(
        connection,
        "SELECT id FROM User WHERE email = ? LIMIT 1",
        [requiredEnv("ADMIN_SEED_EMAIL").toLowerCase()],
      )
    )[0];
    if (!service || !revision || !objective || !admin) {
      throw new Error("Task 011 marker prerequisites are missing.");
    }

    const marker: CustomBuildMarker = {
      version: 1,
      serviceConfigId: service.id,
      editedMinimumAutomaticEstimateCents: 777,
      editedSkillRuleCentsPerMillionXp: 1777,
      editedObjectiveName: "CI preserved Barrows gloves objective",
      requestId: "task011cirequestmarker",
      attachmentId: "task011ciattachmentmarker",
      quoteId: "task011ciquotemarker",
      revisionId: "task011ciquoterevision",
      decisionId: "task011cidecisionmarker",
      auditId: "task011ciauditmarker",
    };
    const trackingHash = createHash("sha256")
      .update(["task011", "ci", "tracking"].join(":"))
      .digest("hex");
    const idempotencyHash = createHash("sha256")
      .update(["task011", "ci", "idempotency"].join(":"))
      .digest("hex");
    const quoteSnapshot = JSON.stringify({
      schemaVersion: 1,
      quote: {
        publicQuoteNumber: "CQ-20300101-CIMARK",
        revisionNumber: 1,
        currencyCode: "USD",
        expiresAt: "2030-01-01T00:00:00.000Z",
      },
      lines: [
        {
          publicDescription: "CI safe custom build scope",
          quantity: 1,
          unitAmountCents: 32100,
          lineTotalCents: 32100,
          lineType: "SERVICE",
          sortOrder: 10,
        },
      ],
      subtotalCents: 32100,
      adjustmentsCents: 0,
      finalTotalCents: 32100,
      estimatedDeliveryText: "CI validated delivery window",
      includedWorkSummary: "CI safe custom account build scope.",
      exclusions: "No checkout, order, payment or credential handover.",
      customerSafeTerms:
        "Quote acceptance records approval only and creates no payment.",
      createdAt: "2026-07-29T00:00:00.000Z",
    });

    await connection.beginTransaction();
    await connection.query(
      "UPDATE FeatureFlag SET enabled = 1 WHERE `key` = 'custom_account_build_enabled'",
    );
    await connection.query(
      `UPDATE CustomBuildService
       SET minimumAutomaticEstimateCents = ?, needsClientReview = 0,
         concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?`,
      [marker.editedMinimumAutomaticEstimateCents, service.id],
    );
    await connection.query(
      `UPDATE CustomBuildSkillRule
       SET centsPerMillionXp = ?, needsClientReview = 0,
         concurrencyVersion = concurrencyVersion + 1
       WHERE stableKey = 'custom-build:skill:attack:normal'`,
      [marker.editedSkillRuleCentsPerMillionXp],
    );
    await connection.query(
      `UPDATE CustomBuildObjective
       SET publicName = ?, needsClientReview = 0,
         concurrencyVersion = concurrencyVersion + 1
       WHERE id = ?`,
      [marker.editedObjectiveName, objective.id],
    );
    await connection.query(
      `INSERT INTO CustomBuildRequest
        (id, publicRequestNumber, customBuildServiceId, publishedRevisionId,
         status, estimateState, estimateSnapshot, gameMode, displayName, email,
         discordUsername, rsn, customerNotes, contactConsentAt,
         contactConsentPolicyVersion, trackingTokenHash, idempotencyKeyHash,
         submittedAt, updatedAt, concurrencyVersion)
       VALUES (?, 'CB-20300101-CIMARK', ?, ?, 'QUOTE_ACCEPTED', 'AUTOMATIC',
         ?, 'NORMAL', 'CI Customer', 'task011-ci-request@example.test',
         'task011.ci', 'Task011', 'CI safe notes only.', NOW(3),
         'custom-build-request-v1', ?, ?, NOW(3), NOW(3), 7)
       ON DUPLICATE KEY UPDATE
         status = 'QUOTE_ACCEPTED',
         concurrencyVersion = VALUES(concurrencyVersion)`,
      [
        marker.requestId,
        service.id,
        revision.id,
        JSON.stringify({
          schemaVersion: 1,
          estimateState: "AUTOMATIC",
          noOrderCreated: true,
          noPaymentCreated: true,
        }),
        trackingHash,
        idempotencyHash,
      ],
    );
    await connection.query(
      `INSERT INTO CustomBuildRequestSkill
        (id, requestId, skillKey, valueMode, currentLevel, targetLevel,
         currentXp, targetXp, freshStart, sortOrder)
       VALUES ('task011cirequestskill', ?, 'ATTACK', 'LEVEL', 1, 50, 0, 101333, 0, 10)
       ON DUPLICATE KEY UPDATE targetLevel = VALUES(targetLevel)`,
      [marker.requestId],
    );
    await connection.query(
      `INSERT INTO CustomBuildRequestObjective
        (id, requestId, objectiveId, objectiveStableKey, objectiveType,
         publicName, customerAlreadyCompleted, sortOrder)
       VALUES ('task011cirequestobjective', ?, ?, 'custom-build:quest:barrows-gloves',
         'QUEST', ?, 0, 10)
       ON DUPLICATE KEY UPDATE publicName = VALUES(publicName)`,
      [marker.requestId, objective.id, marker.editedObjectiveName],
    );
    await connection.query(
      `INSERT INTO CustomBuildRequestStatusEvent
        (id, requestId, previousStatus, newStatus, publicMessage, internalReason,
         actorId, safeMetadata, createdAt)
       VALUES ('task011cistatusevent', ?, 'QUOTE_SENT', 'QUOTE_ACCEPTED',
         'CI quote accepted. No order or payment has been created.', NULL,
         ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE newStatus = VALUES(newStatus)`,
      [
        marker.requestId,
        admin.id,
        JSON.stringify({ noOrderCreated: true, noPaymentCreated: true }),
      ],
    );
    await connection.query(
      `INSERT INTO CustomBuildAttachment
        (id, stableKey, requestId, originalFilename, storageFilename, storageRoot,
         detectedMime, extension, sizeBytes, sha256, status, scanStatus,
         reviewedAt, reviewedById, uploadedAt, concurrencyVersion)
       VALUES (?, 'task011-ci-attachment-marker', ?, 'ci-safe-metadata.png',
         'ci-safe-metadata.png', '/tmp/osrs-services-task011-private',
         'image/png', '.png', 8, ?, 'QUARANTINED', 'NOT_SCANNED',
         NULL, NULL, NOW(3), 1)
       ON DUPLICATE KEY UPDATE scanStatus = VALUES(scanStatus)`,
      [
        marker.attachmentId,
        marker.requestId,
        createHash("sha256").update("metadata").digest("hex"),
      ],
    );
    await connection.query(
      `INSERT INTO CustomBuildQuote
        (id, publicQuoteNumber, requestId, currencyCode, status,
         currentRevisionNumber, issuedAt, expiresAt, customerMessage,
         privateInternalNote, createdAt, updatedAt, concurrencyVersion)
       VALUES (?, 'CQ-20300101-CIMARK', ?, 'USD', 'ACCEPTED', 1,
         NOW(3), '2030-01-01 00:00:00.000',
         'CI safe customer message.', 'CI private note.', NOW(3), NOW(3), 3)
       ON DUPLICATE KEY UPDATE status = 'ACCEPTED',
         currentRevisionNumber = VALUES(currentRevisionNumber)`,
      [marker.quoteId, marker.requestId],
    );
    await connection.query(
      `INSERT INTO CustomBuildQuoteRevision
        (id, quoteId, revisionNumber, snapshotSchemaVersion, snapshot,
         subtotalCents, adjustmentsCents, finalTotalCents, estimatedDeliveryText,
         includedWorkSummary, exclusions, customerSafeTerms, createdById,
         createdAt, sentAt)
       VALUES (?, ?, 1, 1, ?, 32100, 0, 32100,
         'CI validated delivery window', 'CI safe custom account build scope.',
         'No checkout, order, payment or credential handover.',
         'Quote acceptance records approval only and creates no payment.',
         ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE finalTotalCents = VALUES(finalTotalCents)`,
      [marker.revisionId, marker.quoteId, quoteSnapshot, admin.id],
    );
    await connection.query(
      `INSERT INTO CustomBuildQuoteLine
        (id, revisionId, lineType, publicDescription, quantity, unitAmountCents,
         lineTotalCents, sortOrder)
       VALUES ('task011ciquoteline', ?, 'SERVICE',
         'CI safe custom build scope', 1, 32100, 32100, 10)
       ON DUPLICATE KEY UPDATE lineTotalCents = VALUES(lineTotalCents)`,
      [marker.revisionId],
    );
    await connection.query(
      `INSERT INTO CustomBuildQuoteDecision
        (id, quoteId, revisionId, decision, customerMessage, decidedAt,
         concurrencyKey)
       VALUES (?, ?, ?, 'ACCEPTED',
         'CI safe acceptance marker.', NOW(3), 'task011-ci-decision')
       ON DUPLICATE KEY UPDATE decision = VALUES(decision)`,
      [marker.decisionId, marker.quoteId, marker.revisionId],
    );
    await connection.query(
      `INSERT INTO AuditLog
        (id, actorId, action, targetType, targetId, metadata, createdAt)
       VALUES (?, ?, 'custom_build.ci.preservation_marker',
         'CustomBuildRequest', ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE metadata = VALUES(metadata)`,
      [
        marker.auditId,
        admin.id,
        marker.requestId,
        JSON.stringify({ marker: "task011-custom-build-preservation" }),
      ],
    );
    await connection.commit();
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(
      customBuildMarkerPath,
      JSON.stringify(marker, null, 2),
      "utf8",
    );
    console.log("Task 011 custom-build preservation markers written.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

async function customBuildSummary(connection: Connection) {
  const marker = JSON.parse(
    await readFile(customBuildMarkerPath, "utf8"),
  ) as CustomBuildMarker;
  const migration = (
    await rows<{ migration_name: string }>(
      connection,
      `SELECT migration_name
       FROM _prisma_migrations
       WHERE migration_name = ?
       LIMIT 1`,
      [task011MigrationName],
    )
  )[0];
  const flag = (
    await rows<{ enabled: number }>(
      connection,
      "SELECT enabled FROM FeatureFlag WHERE `key` = 'custom_account_build_enabled' LIMIT 1",
    )
  )[0];
  const service = (
    await rows<{
      minimumAutomaticEstimateCents: number;
      needsClientReview: number;
    }>(
      connection,
      "SELECT minimumAutomaticEstimateCents, needsClientReview FROM CustomBuildService WHERE id = ? LIMIT 1",
      [marker.serviceConfigId],
    )
  )[0];
  const skillRule = (
    await rows<{ centsPerMillionXp: number; needsClientReview: number }>(
      connection,
      "SELECT centsPerMillionXp, needsClientReview FROM CustomBuildSkillRule WHERE stableKey = 'custom-build:skill:attack:normal' LIMIT 1",
    )
  )[0];
  const objective = (
    await rows<{ publicName: string; needsClientReview: number }>(
      connection,
      "SELECT publicName, needsClientReview FROM CustomBuildObjective WHERE stableKey = 'custom-build:quest:barrows-gloves' LIMIT 1",
    )
  )[0];
  const request = (
    await rows<{ status: string; value: number }>(
      connection,
      "SELECT status, COUNT(*) AS value FROM CustomBuildRequest WHERE id = ? GROUP BY status",
      [marker.requestId],
    )
  )[0];
  const attachment = (
    await rows<{ scanStatus: string; value: number }>(
      connection,
      "SELECT scanStatus, COUNT(*) AS value FROM CustomBuildAttachment WHERE id = ? GROUP BY scanStatus",
      [marker.attachmentId],
    )
  )[0];
  const quote = (
    await rows<{ status: string; currentRevisionNumber: number }>(
      connection,
      "SELECT status, currentRevisionNumber FROM CustomBuildQuote WHERE id = ? LIMIT 1",
      [marker.quoteId],
    )
  )[0];
  const revision = (
    await rows<{ finalTotalCents: number }>(
      connection,
      "SELECT finalTotalCents FROM CustomBuildQuoteRevision WHERE id = ? LIMIT 1",
      [marker.revisionId],
    )
  )[0];
  const decision = (
    await rows<{ decision: string }>(
      connection,
      "SELECT decision FROM CustomBuildQuoteDecision WHERE id = ? LIMIT 1",
      [marker.decisionId],
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

  if (!migration) throw new Error("Task 011 migration is missing.");
  if (!flag || !asBoolean(flag.enabled)) {
    throw new Error(
      "custom_account_build_enabled manual value was not preserved.",
    );
  }
  if (
    !service ||
    asNumber(service.minimumAutomaticEstimateCents) !==
      marker.editedMinimumAutomaticEstimateCents ||
    asBoolean(service.needsClientReview) !== false
  ) {
    throw new Error("Custom-build service edits were not preserved.");
  }
  if (
    !skillRule ||
    asNumber(skillRule.centsPerMillionXp) !==
      marker.editedSkillRuleCentsPerMillionXp ||
    asBoolean(skillRule.needsClientReview) !== false
  ) {
    throw new Error("Custom-build skill rule edits were not preserved.");
  }
  if (
    !objective ||
    objective.publicName !== marker.editedObjectiveName ||
    asBoolean(objective.needsClientReview) !== false
  ) {
    throw new Error("Custom-build objective edits were not preserved.");
  }
  if (
    !request ||
    request.status !== "QUOTE_ACCEPTED" ||
    asNumber(request.value) !== 1
  ) {
    throw new Error("Custom-build request marker was not preserved.");
  }
  if (!attachment || attachment.scanStatus !== "NOT_SCANNED") {
    throw new Error("Custom-build attachment metadata was not preserved.");
  }
  if (
    !quote ||
    quote.status !== "ACCEPTED" ||
    quote.currentRevisionNumber !== 1
  ) {
    throw new Error("Custom-build quote marker was not preserved.");
  }
  if (!revision || asNumber(revision.finalTotalCents) !== 32100) {
    throw new Error("Custom-build quote revision marker was not preserved.");
  }
  if (!decision || decision.decision !== "ACCEPTED") {
    throw new Error("Custom-build quote decision marker was not preserved.");
  }
  if (asNumber(audit?.value) !== 1) {
    throw new Error("Custom-build audit marker was not preserved.");
  }
  if (credentialColumns.length > 0) {
    throw new Error(
      `Credential-like custom-build columns detected: ${credentialColumns.join(
        ", ",
      )}`,
    );
  }

  const permissionCount = await customBuildPermissionCount(connection);
  const superAdminPublish = await rolePermissionCount(
    connection,
    "SUPER_ADMIN",
    "custom_builds.publish",
  );
  const supportView = await rolePermissionCount(
    connection,
    "SUPPORT_AGENT",
    "custom_builds.view",
  );
  const supportReview = await rolePermissionCount(
    connection,
    "SUPPORT_AGENT",
    "custom_builds.requests.review",
  );
  const supportPublish = await rolePermissionCount(
    connection,
    "SUPPORT_AGENT",
    "custom_builds.publish",
  );
  const supportQuote = await rolePermissionCount(
    connection,
    "SUPPORT_AGENT",
    "custom_builds.quotes.manage",
  );
  const supportAttachment = await rolePermissionCount(
    connection,
    "SUPPORT_AGENT",
    "custom_builds.attachments.review",
  );

  return {
    migrationPresent: Boolean(migration),
    migrationCount: await count(connection, "_prisma_migrations"),
    customBuildServiceCount: await count(connection, "CustomBuildService"),
    draftRuleSetCount: await rows<{ value: number }>(
      connection,
      "SELECT COUNT(*) AS value FROM CustomBuildRuleSet WHERE status = 'DRAFT'",
    ).then((result) => asNumber(result[0]?.value)),
    revisionCount: await count(connection, "CustomBuildRevision"),
    skillRuleCount: await count(connection, "CustomBuildSkillRule"),
    objectiveCount: await count(connection, "CustomBuildObjective"),
    objectiveRuleCount: await count(connection, "CustomBuildObjectiveRule"),
    requestCount: await count(connection, "CustomBuildRequest"),
    statusEventCount: await count(connection, "CustomBuildRequestStatusEvent"),
    attachmentCount: await count(connection, "CustomBuildAttachment"),
    quoteCount: await count(connection, "CustomBuildQuote"),
    quoteRevisionCount: await count(connection, "CustomBuildQuoteRevision"),
    quoteLineCount: await count(connection, "CustomBuildQuoteLine"),
    customerDecisionCount: await count(connection, "CustomBuildQuoteDecision"),
    customAccountBuildEnabledPreserved: asBoolean(flag.enabled),
    serviceEditPreserved: true,
    skillRuleEditPreserved: true,
    objectiveEditPreserved: true,
    requestPreserved: true,
    attachmentMetadataPreserved: true,
    quoteRevisionPreserved: true,
    customerDecisionPreserved: true,
    auditPreserved: true,
    permissionCount,
    superAdminPublish,
    supportView,
    supportReview,
    supportPublish,
    supportQuote,
    supportAttachment,
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
    const summary = await customBuildSummary(connection);
    if (
      summary.permissionCount !== customBuildPermissionKeys.length ||
      summary.superAdminPublish !== 1 ||
      summary.supportView !== 1 ||
      summary.supportReview !== 1 ||
      summary.supportPublish !== 0 ||
      summary.supportQuote !== 0 ||
      summary.supportAttachment !== 0
    ) {
      throw new Error("Custom-build permissions are incorrect after upgrade.");
    }

    const report = [
      "Task 010 to Task 011 upgrade validation",
      "",
      `MySQL version: ${mysqlVersion ?? "unknown"}`,
      "Preservation results:",
      ...preservationLines,
      "",
      `Applied migration count after upgrade: ${summary.migrationCount}`,
      `Task 011 migration present: ${summary.migrationPresent}`,
      `Custom-build service count: ${summary.customBuildServiceCount}`,
      `Draft rule-set count: ${summary.draftRuleSetCount}`,
      `Published revision count: ${summary.revisionCount}`,
      `Skill-rule count: ${summary.skillRuleCount}`,
      `Objective count: ${summary.objectiveCount}`,
      `Objective-rule count: ${summary.objectiveRuleCount}`,
      `Request count: ${summary.requestCount}`,
      `Status-event count: ${summary.statusEventCount}`,
      `Attachment metadata count: ${summary.attachmentCount}`,
      `Quote count: ${summary.quoteCount}`,
      `Quote-revision count: ${summary.quoteRevisionCount}`,
      `Quote-line count: ${summary.quoteLineCount}`,
      `Customer-decision count: ${summary.customerDecisionCount}`,
      `custom_account_build_enabled preserved manual value: ${summary.customAccountBuildEnabledPreserved}`,
      `Custom-build service edit preserved: ${summary.serviceEditPreserved}`,
      `Custom-build skill-rule edit preserved: ${summary.skillRuleEditPreserved}`,
      `Custom-build objective edit preserved: ${summary.objectiveEditPreserved}`,
      `Custom-build request preserved: ${summary.requestPreserved}`,
      `Custom-build attachment metadata preserved: ${summary.attachmentMetadataPreserved}`,
      `Custom-build quote revision preserved: ${summary.quoteRevisionPreserved}`,
      `Custom-build customer decision preserved: ${summary.customerDecisionPreserved}`,
      `Custom-build audit marker preserved: ${summary.auditPreserved}`,
      `Custom-build permission count: ${summary.permissionCount}`,
      `SUPER_ADMIN custom_builds.publish assignment: ${summary.superAdminPublish}`,
      `SUPPORT_AGENT custom_builds.view assignment: ${summary.supportView}`,
      `SUPPORT_AGENT custom_builds.requests.review assignment: ${summary.supportReview}`,
      `SUPPORT_AGENT custom_builds.publish assignment: ${summary.supportPublish}`,
      `SUPPORT_AGENT custom_builds.attachments.review assignment: ${summary.supportAttachment}`,
      `SUPPORT_AGENT custom_builds.quotes.manage assignment: ${summary.supportQuote}`,
      `Credential-like schema-column count: ${summary.credentialColumnCount}`,
      "",
      "Password hash equality was verified without printing the hash.",
      "No passwords, hashes, emails, Discord usernames, RSNs, tracking tokens, customer notes, attachment filenames, attachment paths, database URLs or secrets are included in this report.",
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
} else if (mode === "prepare-custom-build") {
  prepareCustomBuildMarkers().catch((error: unknown) => {
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
    "Usage: tsx scripts/validate-task011-existing-db.ts snapshot|prepare-custom-build|verify",
  );
  process.exitCode = 1;
}

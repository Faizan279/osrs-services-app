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
  source: "task006";
  createdBy: "scripts/validate-task007-existing-db.ts";
  groups: Record<string, GroupSnapshot>;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-007");
const markerPath = path.join(
  artifactDirectory,
  ".task006-preservation-markers.json",
);
const reportPath = path.join(
  artifactDirectory,
  "task006-to-task007-validation.txt",
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

async function ensureTask006Markers(connection: Connection) {
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
      "SELECT id FROM CatalogueService WHERE seededKey = 'pvm-support' LIMIT 1",
    )
  )[0];
  if (!service) throw new Error("Task 006 pvm-support service is missing.");

  const fixedDate = "2026-07-20 00:00:00.000";
  await connection.query(
    `INSERT INTO CatalogueServiceStage
      (id, serviceId, snapshot, baseVersion, version, updatedById, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, 7007, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       snapshot = VALUES(snapshot),
       baseVersion = VALUES(baseVersion),
       version = VALUES(version),
       updatedById = VALUES(updatedById),
       updatedAt = VALUES(updatedAt)`,
    [
      "task007ci_stage_marker",
      service.id,
      JSON.stringify({
        marker: "task006-stage-preservation",
        serviceSeededKey: "pvm-support",
      }),
      admin.id,
      fixedDate,
      fixedDate,
    ],
  );
  await connection.query(
    `INSERT INTO CatalogueRevision
      (id, serviceId, revisionNumber, event, publicationStatus, summary, snapshot, actorId, createdAt)
     VALUES (?, ?, 7007, 'PUBLISHED', 'PUBLISHED', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       summary = VALUES(summary),
       snapshot = VALUES(snapshot),
       actorId = VALUES(actorId)`,
    [
      "task007ci_revision_marker",
      service.id,
      "Task 006 preservation marker for Task 007 CI upgrade validation.",
      JSON.stringify({
        marker: "task006-revision-preservation",
        serviceSeededKey: "pvm-support",
      }),
      admin.id,
      fixedDate,
    ],
  );
  await connection.query(
    `INSERT INTO AuditLog
      (id, actorId, action, targetType, targetId, metadata, ipAddress, createdAt)
     VALUES (?, ?, 'task007.ci.preservation_marker', 'CatalogueService', ?, ?, '127.0.0.1', ?)
     ON DUPLICATE KEY UPDATE
       metadata = VALUES(metadata),
       actorId = VALUES(actorId)`,
    [
      "task007ci_audit_marker",
      admin.id,
      service.id,
      JSON.stringify({
        marker: "task006-audit-preservation",
        serviceSeededKey: "pvm-support",
      }),
      fixedDate,
    ],
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
        `SELECT seededKey, slug, canonicalSlug, engineType, publicationStatus,
          availabilityState, isFeatured, isQuoteOnly, displayOrder, version,
          needsClientReview
         FROM CatalogueService
         WHERE seededKey IS NOT NULL
         ORDER BY seededKey`,
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
    name: "skillingSkills",
    label: "skilling skill rows",
    keyFields: ["seededKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT seededKey, skillKey, name, enabled, displayOrder, iconKey
         FROM SkillingSkillConfig
         WHERE seededKey IS NOT NULL
         ORDER BY seededKey`,
      ),
  },
  {
    name: "skillingMethods",
    label: "skilling method rows",
    keyFields: ["seededKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT seededKey, slug, name, enabled, minimumLevel, maximumLevel,
          xpPerHour, basePriceCentsPerMillionXp, minimumPriceCents,
          fixedFeeCents, suppliesEnabled, suppliesFeeCents, needsClientReview
         FROM SkillingTrainingMethod
         WHERE seededKey IS NOT NULL
         ORDER BY seededKey`,
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
    name: "bossingBosses",
    label: "bossing bosses",
    keyFields: ["seededKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT seededKey, bossKey, name, enabled, displayOrder, groupLabel,
          iconKey, needsClientReview
         FROM BossingBossConfig
         WHERE seededKey IS NOT NULL
         ORDER BY seededKey`,
      ),
  },
  {
    name: "bossingMethods",
    label: "bossing methods",
    keyFields: ["seededKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT seededKey, slug, name, enabled, priceMode, minimumKillCount,
          maximumKillCount, basePriceCentsPerKill, fixedPackagePriceCents,
          minimumPriceCents, setupFeeCents, suppliesEnabled, suppliesFeeCents,
          customerGearRequired, gearAdjustmentCents, estimatedKillsPerHour,
          needsClientReview
         FROM BossingMethod
         WHERE seededKey IS NOT NULL
         ORDER BY seededKey`,
      ),
  },
  {
    name: "bossingStatRequirements",
    label: "bossing stat requirements",
    keyFields: ["seededKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT seededKey, metricKey, label, requiredLevel, displayOrder,
          verificationMode, needsClientReview
         FROM BossingStatRequirement
         WHERE seededKey IS NOT NULL
         ORDER BY seededKey`,
      ),
  },
  {
    name: "bossingGearRequirements",
    label: "bossing gear requirements",
    keyFields: ["seededKey"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT seededKey, label, isRequired, displayOrder, verificationMode,
          needsClientReview
         FROM BossingGearRequirement
         WHERE seededKey IS NOT NULL
         ORDER BY seededKey`,
      ),
  },
  {
    name: "stagedAggregates",
    label: "staged aggregates",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT stage.id, service.seededKey AS serviceKey, stage.snapshot,
          stage.baseVersion, stage.version, user.email AS updatedByEmail
         FROM CatalogueServiceStage stage
         INNER JOIN CatalogueService service ON service.id = stage.serviceId
         LEFT JOIN User user ON user.id = stage.updatedById
         ORDER BY stage.id`,
      ),
  },
  {
    name: "revisions",
    label: "revisions",
    keyFields: ["id"],
    fetch: (connection) =>
      rows(
        connection,
        `SELECT revision.id, service.seededKey AS serviceKey,
          revision.revisionNumber, revision.event, revision.publicationStatus,
          revision.summary, revision.snapshot, user.email AS actorEmail
         FROM CatalogueRevision revision
         INNER JOIN CatalogueService service ON service.id = revision.serviceId
         LEFT JOIN User user ON user.id = revision.actorId
         ORDER BY revision.id`,
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
    await ensureTask006Markers(connection);
    const groups: Record<string, GroupSnapshot> = {};
    for (const definition of groupDefinitions) {
      groups[definition.name] = createSnapshot(
        await definition.fetch(connection),
        definition,
      );
    }
    const markerFile: MarkerFile = {
      version: 1,
      source: "task006",
      createdBy: "scripts/validate-task007-existing-db.ts",
      groups,
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(markerPath, JSON.stringify(markerFile, null, 2), "utf8");
    console.log(`Task 006 preservation markers written to ${markerPath}`);
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

async function premiumSummary(connection: Connection) {
  const representative = (
    await rows<{
      configuratorType: string;
      supportsManualStatFallback: number;
      standardDeliveryEnabled: number;
      priorityDeliveryEnabled: number;
      expressDeliveryEnabled: number;
    }>(
      connection,
      `SELECT configuratorType, supportsManualStatFallback,
        standardDeliveryEnabled, priorityDeliveryEnabled, expressDeliveryEnabled
       FROM PremiumServiceConfig config
       INNER JOIN CatalogueService service ON service.id = config.serviceId
       WHERE service.seededKey = 'fire-cape-premium'
       LIMIT 1`,
    )
  )[0];
  const flag = (
    await rows<{ enabled: number }>(
      connection,
      "SELECT enabled FROM FeatureFlag WHERE `key` = 'premium_configurator_enabled' LIMIT 1",
    )
  )[0];
  if (!representative) {
    throw new Error("Task 007 representative premium config is missing.");
  }
  if (!flag) throw new Error("premium_configurator_enabled is missing.");
  if (representative.configuratorType !== "FIRE_CAPE") {
    throw new Error("Task 007 representative config is not FIRE_CAPE.");
  }
  if (!asBoolean(representative.supportsManualStatFallback)) {
    throw new Error("Task 007 manual stat fallback was not added.");
  }
  if (!asBoolean(representative.standardDeliveryEnabled)) {
    throw new Error("Task 007 standard delivery should be enabled.");
  }
  if (asBoolean(representative.priorityDeliveryEnabled)) {
    throw new Error("Task 007 priority delivery should be disabled.");
  }
  if (asBoolean(representative.expressDeliveryEnabled)) {
    throw new Error("Task 007 express delivery should be disabled.");
  }
  return {
    migrationCount: await count(connection, "_prisma_migrations"),
    premiumConfigCount: await count(connection, "PremiumServiceConfig"),
    premiumPackageCount: await count(connection, "PremiumPackage"),
    premiumOptionCount: await count(connection, "PremiumOption"),
    requirementGroupCount: await count(connection, "PremiumRequirementGroup"),
    premiumRequirementCount: await count(connection, "PremiumRequirement"),
    premiumFaqCount: await count(connection, "PremiumFaq"),
    featureFlagEnabled: asBoolean(flag.enabled),
    representative,
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
    const summary = await premiumSummary(connection);
    const report = [
      "Task 006 to Task 007 upgrade validation",
      "",
      `MySQL version: ${mysqlVersion ?? "unknown"}`,
      "Preservation results:",
      ...preservationLines,
      "",
      `Applied migration count after upgrade: ${summary.migrationCount}`,
      `Premium config count: ${summary.premiumConfigCount}`,
      `Premium package count: ${summary.premiumPackageCount}`,
      `Premium option count: ${summary.premiumOptionCount}`,
      `Requirement group count: ${summary.requirementGroupCount}`,
      `Premium requirement count: ${summary.premiumRequirementCount}`,
      `Premium FAQ count: ${summary.premiumFaqCount}`,
      `premium_configurator_enabled value: ${summary.featureFlagEnabled}`,
      `Representative configurator type: ${summary.representative.configuratorType}`,
      `supportsManualStatFallback value: ${asBoolean(
        summary.representative.supportsManualStatFallback,
      )}`,
      `Standard delivery enabled: ${asBoolean(
        summary.representative.standardDeliveryEnabled,
      )}`,
      `Priority delivery enabled: ${asBoolean(
        summary.representative.priorityDeliveryEnabled,
      )}`,
      `Express delivery enabled: ${asBoolean(
        summary.representative.expressDeliveryEnabled,
      )}`,
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
} else if (mode === "verify") {
  verify().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  console.error(
    "Usage: tsx scripts/validate-task007-existing-db.ts snapshot|verify",
  );
  process.exitCode = 1;
}

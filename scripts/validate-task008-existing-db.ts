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
  source: "task007";
  createdBy: "scripts/validate-task008-existing-db.ts";
  groups: Record<string, GroupSnapshot>;
};

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-008");
const markerPath = path.join(
  artifactDirectory,
  ".task007-preservation-markers.json",
);
const reportPath = path.join(
  artifactDirectory,
  "task007-to-task008-validation.txt",
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

function parseJson(value: unknown) {
  if (typeof value === "string") return JSON.parse(value) as Row;
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8")) as Row;
  if (value && typeof value === "object") return value as Row;
  throw new Error("Expected a JSON object.");
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

async function ensureTask007Markers(connection: Connection) {
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
  if (!service) throw new Error("Task 007 fire-cape-premium service missing.");

  const fixedDate = "2026-07-23 00:00:00.000";
  await connection.query(
    `INSERT INTO CatalogueServiceStage
      (id, serviceId, snapshot, baseVersion, version, updatedById, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, 8008, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       snapshot = VALUES(snapshot),
       baseVersion = VALUES(baseVersion),
       version = VALUES(version),
       updatedById = VALUES(updatedById),
       updatedAt = VALUES(updatedAt)`,
    [
      "task008ci_stage_marker",
      service.id,
      JSON.stringify({
        marker: "task007-stage-preservation",
        serviceSeededKey: "fire-cape-premium",
      }),
      admin.id,
      fixedDate,
      fixedDate,
    ],
  );
  await connection.query(
    `INSERT INTO CatalogueRevision
      (id, serviceId, revisionNumber, event, publicationStatus, summary, snapshot, actorId, createdAt)
     VALUES (?, ?, 8008, 'PUBLISHED', 'PUBLISHED', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       summary = VALUES(summary),
       snapshot = VALUES(snapshot),
       actorId = VALUES(actorId)`,
    [
      "task008ci_revision_marker",
      service.id,
      "Task 007 preservation marker for Task 008 CI upgrade validation.",
      JSON.stringify({
        marker: "task007-revision-preservation",
        serviceSeededKey: "fire-cape-premium",
      }),
      admin.id,
      fixedDate,
    ],
  );
  await connection.query(
    `INSERT INTO AuditLog
      (id, actorId, action, targetType, targetId, metadata, ipAddress, createdAt)
     VALUES (?, ?, 'task008.ci.preservation_marker', 'CatalogueService', ?, ?, '127.0.0.1', ?)
     ON DUPLICATE KEY UPDATE
       metadata = VALUES(metadata),
       actorId = VALUES(actorId)`,
    [
      "task008ci_audit_marker",
      admin.id,
      service.id,
      JSON.stringify({
        marker: "task007-audit-preservation",
        serviceSeededKey: "fire-cape-premium",
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
        `SELECT seededKey, slug, canonicalSlug, engineType,
          publicationStatus, availabilityState, isFeatured, isQuoteOnly,
          displayOrder, version, needsClientReview
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
    await ensureTask007Markers(connection);
    const groups: Record<string, GroupSnapshot> = {};
    for (const definition of groupDefinitions) {
      groups[definition.name] = createSnapshot(
        await definition.fetch(connection),
        definition,
      );
    }
    const markerFile: MarkerFile = {
      version: 1,
      source: "task007",
      createdBy: "scripts/validate-task008-existing-db.ts",
      groups,
    };
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(markerPath, JSON.stringify(markerFile, null, 2), "utf8");
    console.log(`Task 007 preservation markers written to ${markerPath}`);
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

async function pricingSummary(connection: Connection) {
  const flag = (
    await rows<{ enabled: number }>(
      connection,
      "SELECT enabled FROM FeatureFlag WHERE `key` = 'global_pricing_enabled' LIMIT 1",
    )
  )[0];
  if (!flag)
    throw new Error("global_pricing_enabled is missing after upgrade.");
  if (asBoolean(flag.enabled)) {
    throw new Error(
      "global_pricing_enabled should remain disabled by default.",
    );
  }
  const draft = (
    await rows<{ id: string; draftVersion: number; currencyCode: string }>(
      connection,
      `SELECT id, draftVersion, currencyCode
       FROM PricingRuleSet
       WHERE status = 'DRAFT'
       ORDER BY createdAt ASC
       LIMIT 1`,
    )
  )[0];
  if (!draft) throw new Error("Pricing draft missing after upgrade.");
  const latestRevision = (
    await rows<{ revisionNumber: number; snapshot: unknown }>(
      connection,
      `SELECT revisionNumber, snapshot
       FROM PricingRevision
       ORDER BY revisionNumber DESC, publishedAt DESC
       LIMIT 1`,
    )
  )[0];
  if (!latestRevision) {
    throw new Error("Pricing revision missing after upgrade.");
  }
  const snapshot = parseJson(latestRevision.snapshot);
  if (snapshot.schemaVersion !== 1 || snapshot.ruleSetId !== draft.id) {
    throw new Error("Pricing revision snapshot is invalid after upgrade.");
  }
  if (!Array.isArray(snapshot.rules) || snapshot.rules.length !== 0) {
    throw new Error("Seeded pricing revision should be neutral after upgrade.");
  }
  const pricingPublishAssignments = (
    await rows<{ roleKey: string; value: number }>(
      connection,
      `SELECT roleRecord.key AS roleKey, COUNT(*) AS value
       FROM RolePermission rolePermission
       INNER JOIN Role roleRecord ON roleRecord.id = rolePermission.roleId
       INNER JOIN Permission permissionRecord ON permissionRecord.id = rolePermission.permissionId
       WHERE permissionRecord.key = 'pricing.publish'
       GROUP BY roleRecord.key`,
    )
  ).reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.roleKey] = asNumber(row.value);
    return accumulator;
  }, {});
  if (pricingPublishAssignments.SUPER_ADMIN !== 1) {
    throw new Error("SUPER_ADMIN pricing.publish assignment missing.");
  }
  if (pricingPublishAssignments.SUPPORT_AGENT) {
    throw new Error("SUPPORT_AGENT must not receive pricing.publish.");
  }

  return {
    migrationCount: await count(connection, "_prisma_migrations"),
    pricingRuleSetCount: await count(connection, "PricingRuleSet"),
    pricingRuleCount: await count(connection, "PricingRule"),
    pricingRevisionCount: await count(connection, "PricingRevision"),
    globalPricingEnabled: asBoolean(flag.enabled),
    draftVersion: draft.draftVersion,
    latestRevisionNumber: latestRevision.revisionNumber,
    latestRevisionRuleCount: snapshot.rules.length,
    superAdminPublish: pricingPublishAssignments.SUPER_ADMIN ?? 0,
    supportPublish: pricingPublishAssignments.SUPPORT_AGENT ?? 0,
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
    const summary = await pricingSummary(connection);
    const report = [
      "Task 007 to Task 008 upgrade validation",
      "",
      `MySQL version: ${mysqlVersion ?? "unknown"}`,
      "Preservation results:",
      ...preservationLines,
      "",
      `Applied migration count after upgrade: ${summary.migrationCount}`,
      `Pricing rule set count: ${summary.pricingRuleSetCount}`,
      `Pricing rule count: ${summary.pricingRuleCount}`,
      `Pricing revision count: ${summary.pricingRevisionCount}`,
      `global_pricing_enabled value: ${summary.globalPricingEnabled}`,
      `Draft pricing version: ${summary.draftVersion}`,
      `Latest pricing revision: #${summary.latestRevisionNumber}`,
      `Latest pricing revision rules: ${summary.latestRevisionRuleCount}`,
      `SUPER_ADMIN pricing.publish assignment: ${summary.superAdminPublish}`,
      `SUPPORT_AGENT pricing.publish assignment: ${summary.supportPublish}`,
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
    "Usage: tsx scripts/validate-task008-existing-db.ts snapshot|verify",
  );
  process.exitCode = 1;
}

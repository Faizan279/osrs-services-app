import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import mariadb, { type Connection } from "mariadb";

const outputPath = path.join(
  process.cwd(),
  "artifacts",
  "task-014",
  "task014-fresh-database-validation.txt",
);

const task014Migration = "20260801150000_task014_customer_accounts_dashboard";
const customerPermissionKeys = [
  "customers.view",
  "customers.manage",
  "customers.security.manage",
  "customers.orders.link",
  "customers.notifications.manage",
  "customers.configure",
] as const;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function connectDatabase() {
  return mariadb.createConnection({
    host: requiredEnv("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: requiredEnv("DATABASE_USER"),
    password: requiredEnv("DATABASE_PASSWORD"),
    database: requiredEnv("DATABASE_NAME"),
    allowPublicKeyRetrieval:
      process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === "true",
  });
}

async function rows<T>(
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
  return Number(result[0]?.value ?? 0);
}

async function flagValue(connection: Connection, key: string) {
  const result = await rows<{ enabled: number | boolean }>(
    connection,
    "SELECT enabled FROM FeatureFlag WHERE `key` = ? LIMIT 1",
    [key],
  );
  return Boolean(result[0]?.enabled);
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
     WHERE roleRecord.\`key\` = ? AND permissionRecord.\`key\` = ?`,
    [roleKey, permissionKey],
  );
  return Number(result[0]?.value ?? 0);
}

async function schemaColumnCount(
  connection: Connection,
  regexp: string,
  safeColumnNames: string[] = [],
) {
  const safeColumnPredicate = safeColumnNames.length
    ? `AND LOWER(COLUMN_NAME) NOT IN (${safeColumnNames
        .map(() => "?")
        .join(", ")})`
    : "";
  const result = await rows<{ value: number }>(
    connection,
    `SELECT COUNT(*) AS value
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(COLUMN_NAME) REGEXP ?
       ${safeColumnPredicate}`,
    [regexp, ...safeColumnNames],
  );
  return Number(result[0]?.value ?? 0);
}

async function main() {
  const connection = await connectDatabase();
  try {
    const mysqlVersion = (
      await rows<{ version: string }>(connection, "SELECT VERSION() AS version")
    )[0]?.version;
    const migrationCount = await count(connection, "_prisma_migrations");
    const migrationPresent = await count(
      connection,
      "_prisma_migrations",
      "WHERE migration_name = ?",
      [task014Migration],
    );
    const permissionCount = await count(
      connection,
      "Permission",
      `WHERE \`key\` IN (${customerPermissionKeys.map(() => "?").join(", ")})`,
      [...customerPermissionKeys],
    );
    const superAdminConfigure = await rolePermissionCount(
      connection,
      "SUPER_ADMIN",
      "customers.configure",
    );
    const supportView = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "customers.view",
    );
    const supportManage = await rolePermissionCount(
      connection,
      "SUPPORT_AGENT",
      "customers.manage",
    );

    const counts = {
      staffUsers: await count(
        connection,
        "User",
        "WHERE accountType = 'STAFF'",
      ),
      customerUsers: await count(
        connection,
        "User",
        "WHERE accountType = 'CUSTOMER'",
      ),
      customerProfiles: await count(connection, "CustomerProfile"),
      customerSessions: await count(
        connection,
        "Session",
        "WHERE audience = 'CUSTOMER'",
      ),
      customerSettings: await count(connection, "CustomerAccountSettings"),
      customerOrderLinks: await count(connection, "CustomerOrderLink"),
      authTokens: await count(connection, "CustomerAuthToken"),
      notifications: await count(connection, "CustomerNotification"),
      notificationPreferences: await count(
        connection,
        "CustomerNotificationPreference",
      ),
      securityEvents: await count(connection, "CustomerSecurityEvent"),
      customerStaffRoles: await count(
        connection,
        "UserRole",
        `INNER JOIN User userRecord ON userRecord.id = UserRole.userId
         WHERE userRecord.accountType = 'CUSTOMER'`,
      ),
      customerStaffPermissions: await count(
        connection,
        "RolePermission",
        `INNER JOIN UserRole userRole ON userRole.roleId = RolePermission.roleId
         INNER JOIN User userRecord ON userRecord.id = userRole.userId
         WHERE userRecord.accountType = 'CUSTOMER'`,
      ),
      staffSessionsWithCustomerAudience: await count(
        connection,
        "Session",
        `INNER JOIN User userRecord ON userRecord.id = Session.userId
         WHERE userRecord.accountType = 'STAFF' AND Session.audience = 'CUSTOMER'`,
      ),
      customerSessionsWithStaffAudience: await count(
        connection,
        "Session",
        `INNER JOIN User userRecord ON userRecord.id = Session.userId
         WHERE userRecord.accountType = 'CUSTOMER' AND Session.audience = 'STAFF'`,
      ),
    };

    const customerAccountsFlag = await flagValue(
      connection,
      "customer_accounts_enabled",
    );
    const customerRegistrationFlag = await flagValue(
      connection,
      "customer_registration_enabled",
    );
    const customerDashboardFlag = await flagValue(
      connection,
      "customer_dashboard_enabled",
    );
    const rawTokenColumnCount = await schemaColumnCount(
      connection,
      "(^raw.*token$|^token$|rawsession|rawverification|rawreset|rawclaim)",
    );
    const credentialColumnCount = await schemaColumnCount(
      connection,
      "(runescapepassword|emailpassword|recoveryanswer|authenticatorsecret|bankpin|cardnumber|cvv|credential)",
      ["bankpinresetrequired"],
    );
    const externalProviderConfigurationCount = await count(
      connection,
      "CustomerAccountSettings",
      "WHERE notificationProviderConfigured = 1",
    );

    if (!mysqlVersion) throw new Error("Could not read MySQL version.");
    if (migrationPresent !== 1) throw new Error("Task 014 migration missing.");
    if (counts.customerUsers !== 0 || counts.customerProfiles !== 0) {
      throw new Error("Fresh normal seed created customer accounts.");
    }
    if (
      counts.customerSessions !== 0 ||
      counts.customerOrderLinks !== 0 ||
      counts.authTokens !== 0 ||
      counts.notifications !== 0
    ) {
      throw new Error("Fresh normal seed created customer transactional data.");
    }
    if (counts.customerSettings !== 1) {
      throw new Error("Customer account settings seed is missing.");
    }
    if (
      customerAccountsFlag ||
      customerRegistrationFlag ||
      customerDashboardFlag
    ) {
      throw new Error("Customer feature flags must default disabled.");
    }
    if (permissionCount !== customerPermissionKeys.length) {
      throw new Error("Customer permissions are missing.");
    }
    if (superAdminConfigure !== 1 || supportView !== 1 || supportManage !== 0) {
      throw new Error("Customer role defaults are unsafe.");
    }
    if (
      counts.customerStaffRoles !== 0 ||
      counts.customerStaffPermissions !== 0 ||
      counts.staffSessionsWithCustomerAudience !== 0 ||
      counts.customerSessionsWithStaffAudience !== 0 ||
      rawTokenColumnCount !== 0 ||
      credentialColumnCount !== 0 ||
      externalProviderConfigurationCount !== 0
    ) {
      throw new Error(
        "Customer account isolation or privacy validation failed.",
      );
    }

    const report = [
      "Task 014 fresh database validation",
      "",
      `MySQL version: ${mysqlVersion}`,
      `Applied migration count: ${migrationCount}`,
      `Task 014 migration present: ${migrationPresent === 1}`,
      `Staff-user count: ${counts.staffUsers}`,
      `Customer-user count: ${counts.customerUsers}`,
      `Customer-profile count: ${counts.customerProfiles}`,
      `Customer-session count: ${counts.customerSessions}`,
      `Customer-account-settings count: ${counts.customerSettings}`,
      `Customer-order-link count: ${counts.customerOrderLinks}`,
      `Auth-token count: ${counts.authTokens}`,
      `Customer-notification count: ${counts.notifications}`,
      `Notification-preference count: ${counts.notificationPreferences}`,
      `Customer-security-event count: ${counts.securityEvents}`,
      `customer_accounts_enabled value: ${customerAccountsFlag}`,
      `customer_registration_enabled value: ${customerRegistrationFlag}`,
      `customer_dashboard_enabled value: ${customerDashboardFlag}`,
      `Customer permission count: ${permissionCount}`,
      `CUSTOMER users with staff roles count: ${counts.customerStaffRoles}`,
      `CUSTOMER users with staff permissions count: ${counts.customerStaffPermissions}`,
      `STAFF sessions with customer audience count: ${counts.staffSessionsWithCustomerAudience}`,
      `CUSTOMER sessions with staff audience count: ${counts.customerSessionsWithStaffAudience}`,
      `Raw-token schema-column count: ${rawTokenColumnCount}`,
      `Credential-like schema-column count: ${credentialColumnCount}`,
      `External-provider configuration count: ${externalProviderConfigurationCount}`,
      `SUPER_ADMIN customers.configure assignment: ${superAdminConfigure}`,
      `SUPPORT_AGENT customers.view assignment: ${supportView}`,
      `SUPPORT_AGENT customers.manage assignment: ${supportManage}`,
      "",
      "No emails, names, Discord usernames, RSNs, password hashes, token hashes, database URLs, full IP addresses or secrets are included in this report.",
      "",
    ].join("\n");

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, report, "utf8");
    console.log(report);
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import { describe, expect, it } from "vitest";

import {
  seedDatabase,
  type AdminSeedConfiguration,
  type SeedClient,
} from "../../prisma/seed-core";

type FakeState = {
  permissions: Map<string, { id: string; description: string }>;
  roles: Map<string, { id: string; name: string; description: string }>;
  rolePermissions: Set<string>;
  featureFlags: Map<string, { description: string; enabled: boolean }>;
  users: Map<
    string,
    { id: string; name: string; passwordHash: string; emailVerified: Date }
  >;
  userRoles: Set<string>;
};

function createFakeSeedClient() {
  const state: FakeState = {
    permissions: new Map(),
    roles: new Map(),
    rolePermissions: new Set(),
    featureFlags: new Map(),
    users: new Map(),
    userRoles: new Set(),
  };

  const client: SeedClient = {
    permission: {
      async upsert(args) {
        const existing = state.permissions.get(args.where.key);
        if (existing) {
          existing.description = args.update.description;
          return { id: existing.id };
        }
        const record = {
          id: `permission:${args.create.key}`,
          description: args.create.description,
        };
        state.permissions.set(args.create.key, record);
        return { id: record.id };
      },
    },
    role: {
      async upsert(args) {
        const existing = state.roles.get(args.where.key);
        if (existing) {
          existing.name = args.update.name;
          existing.description = args.update.description;
          return { id: existing.id };
        }
        const record = {
          id: `role:${args.create.key}`,
          name: args.create.name,
          description: args.create.description,
        };
        state.roles.set(args.create.key, record);
        return { id: record.id };
      },
      async findUniqueOrThrow(args) {
        const role = state.roles.get(args.where.key);
        if (!role) throw new Error(`Missing role: ${args.where.key}`);
        return { id: role.id };
      },
    },
    rolePermission: {
      async createMany(args) {
        for (const assignment of args.data) {
          state.rolePermissions.add(
            `${assignment.roleId}:${assignment.permissionId}`,
          );
        }
        return { count: args.data.length };
      },
    },
    featureFlag: {
      async upsert(args) {
        const existing = state.featureFlags.get(args.where.key);
        if (existing) {
          existing.description = args.update.description;
          return existing;
        }
        const record = {
          description: args.create.description,
          enabled: args.create.enabled,
        };
        state.featureFlags.set(args.create.key, record);
        return record;
      },
    },
    user: {
      async upsert(args) {
        const existing = state.users.get(args.where.email);
        if (existing) {
          if (args.update.passwordHash) {
            existing.passwordHash = args.update.passwordHash;
          }
          return { id: existing.id };
        }
        const record = {
          id: `user:${args.create.email}`,
          name: args.create.name,
          passwordHash: args.create.passwordHash,
          emailVerified: args.create.emailVerified,
        };
        state.users.set(args.create.email, record);
        return { id: record.id };
      },
    },
    userRole: {
      async upsert(args) {
        state.userRoles.add(`${args.create.userId}:${args.create.roleId}`);
        return args.create;
      },
    },
  };

  return { client, state };
}

const initialAdmin: AdminSeedConfiguration = {
  email: "admin@example.com",
  password: "initial-password",
  name: "Seeded Administrator",
  resetPassword: false,
};

const hashPassword = async (password: string) => `hash:${password}`;

describe("database seed idempotence", () => {
  it("preserves live flags, permission assignments, and the admin password", async () => {
    const { client, state } = createFakeSeedClient();
    await seedDatabase(client, initialAdmin, hashPassword);

    const paypalFlag = state.featureFlags.get("payments.paypal")!;
    paypalFlag.enabled = true;
    const skillingFlag = state.featureFlags.get("skilling_calculator_enabled")!;
    expect(skillingFlag.enabled).toBe(false);
    skillingFlag.enabled = true;
    const bossingFlag = state.featureFlags.get("bossing_calculator_enabled")!;
    expect(bossingFlag.enabled).toBe(false);
    bossingFlag.enabled = true;
    const premiumFlag = state.featureFlags.get("premium_configurator_enabled")!;
    expect(premiumFlag.enabled).toBe(false);
    premiumFlag.enabled = true;
    const globalPricingFlag = state.featureFlags.get("global_pricing_enabled")!;
    expect(globalPricingFlag.enabled).toBe(false);
    globalPricingFlag.enabled = true;

    const editor = state.roles.get("EDITOR")!;
    const manualPermission = state.permissions.get("orders.view")!;
    const manualAssignment = `${editor.id}:${manualPermission.id}`;
    state.rolePermissions.add(manualAssignment);

    const defaultPermission = state.permissions.get("products.view")!;
    const missingDefaultAssignment = `${editor.id}:${defaultPermission.id}`;
    state.rolePermissions.delete(missingDefaultAssignment);

    const administrator = state.users.get("admin@example.com")!;
    const originalPasswordHash = administrator.passwordHash;

    await seedDatabase(
      client,
      { ...initialAdmin, password: "replacement-password" },
      hashPassword,
    );

    expect(paypalFlag.enabled).toBe(true);
    expect(skillingFlag.enabled).toBe(true);
    expect(bossingFlag.enabled).toBe(true);
    expect(premiumFlag.enabled).toBe(true);
    expect(globalPricingFlag.enabled).toBe(true);
    expect(state.rolePermissions.has(manualAssignment)).toBe(true);
    expect(state.rolePermissions.has(missingDefaultAssignment)).toBe(true);
    const superAdmin = state.roles.get("SUPER_ADMIN")!;
    const supportAgent = state.roles.get("SUPPORT_AGENT")!;
    const pricingPublish = state.permissions.get("pricing.publish")!;
    expect(
      state.rolePermissions.has(`${superAdmin.id}:${pricingPublish.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${pricingPublish.id}`),
    ).toBe(false);
    expect(administrator.passwordHash).toBe(originalPasswordHash);
  });

  it("resets the administrator password only when explicitly enabled", async () => {
    const { client, state } = createFakeSeedClient();
    await seedDatabase(client, initialAdmin, hashPassword);

    await seedDatabase(
      client,
      {
        ...initialAdmin,
        password: "deliberate-replacement",
        resetPassword: true,
      },
      hashPassword,
    );

    expect(state.users.get("admin@example.com")!.passwordHash).toBe(
      "hash:deliberate-replacement",
    );
  });
});

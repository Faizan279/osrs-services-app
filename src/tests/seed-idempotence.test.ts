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
    {
      id: string;
      name: string;
      passwordHash: string;
      emailVerified: Date;
      accountType: "STAFF";
    }
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
          accountType: args.create.accountType,
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
    const goldFlag = state.featureFlags.get("gold_engine_enabled")!;
    expect(goldFlag.enabled).toBe(false);
    goldFlag.enabled = true;
    const accountsFlag = state.featureFlags.get("account_marketplace_enabled")!;
    expect(accountsFlag.enabled).toBe(false);
    accountsFlag.enabled = true;
    const customBuildFlag = state.featureFlags.get(
      "custom_account_build_enabled",
    )!;
    expect(customBuildFlag.enabled).toBe(false);
    customBuildFlag.enabled = true;
    const productMarketplaceFlag = state.featureFlags.get(
      "product_marketplace_enabled",
    )!;
    expect(productMarketplaceFlag.enabled).toBe(false);
    productMarketplaceFlag.enabled = true;
    const cartFlag = state.featureFlags.get("cart_enabled")!;
    expect(cartFlag.enabled).toBe(false);
    cartFlag.enabled = true;
    const guestCheckoutFlag = state.featureFlags.get("guest_checkout_enabled")!;
    expect(guestCheckoutFlag.enabled).toBe(false);
    guestCheckoutFlag.enabled = true;
    const customerAccountsFlag = state.featureFlags.get(
      "customer_accounts_enabled",
    )!;
    expect(customerAccountsFlag.enabled).toBe(false);
    customerAccountsFlag.enabled = true;
    const customerRegistrationFlag = state.featureFlags.get(
      "customer_registration_enabled",
    )!;
    expect(customerRegistrationFlag.enabled).toBe(false);
    customerRegistrationFlag.enabled = true;
    const customerDashboardFlag = state.featureFlags.get(
      "customer_dashboard_enabled",
    )!;
    expect(customerDashboardFlag.enabled).toBe(false);
    customerDashboardFlag.enabled = true;

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
    expect(goldFlag.enabled).toBe(true);
    expect(accountsFlag.enabled).toBe(true);
    expect(customBuildFlag.enabled).toBe(true);
    expect(productMarketplaceFlag.enabled).toBe(true);
    expect(cartFlag.enabled).toBe(true);
    expect(guestCheckoutFlag.enabled).toBe(true);
    expect(customerAccountsFlag.enabled).toBe(true);
    expect(customerRegistrationFlag.enabled).toBe(true);
    expect(customerDashboardFlag.enabled).toBe(true);
    expect(state.rolePermissions.has(manualAssignment)).toBe(true);
    expect(state.rolePermissions.has(missingDefaultAssignment)).toBe(true);
    const superAdmin = state.roles.get("SUPER_ADMIN")!;
    const supportAgent = state.roles.get("SUPPORT_AGENT")!;
    const pricingPublish = state.permissions.get("pricing.publish")!;
    const goldView = state.permissions.get("gold.view")!;
    const goldPublish = state.permissions.get("gold.publish")!;
    const goldInventoryAdjust = state.permissions.get("gold.inventory.adjust")!;
    const accountsView = state.permissions.get("accounts.view")!;
    const accountsPublish = state.permissions.get("accounts.publish")!;
    const accountsApprove = state.permissions.get("accounts.approve")!;
    const accountsAvailabilityManage = state.permissions.get(
      "accounts.availability.manage",
    )!;
    const accountsHandoverReview = state.permissions.get(
      "accounts.handover.review",
    )!;
    const customBuildsView = state.permissions.get("custom_builds.view")!;
    const customBuildsEdit = state.permissions.get("custom_builds.edit")!;
    const customBuildsPublish = state.permissions.get("custom_builds.publish")!;
    const customBuildsRequestsReview = state.permissions.get(
      "custom_builds.requests.review",
    )!;
    const customBuildsAttachmentsReview = state.permissions.get(
      "custom_builds.attachments.review",
    )!;
    const customBuildsQuotesManage = state.permissions.get(
      "custom_builds.quotes.manage",
    )!;
    const productsPublish = state.permissions.get("products.publish")!;
    const productsInventoryAdjust = state.permissions.get(
      "products.inventory.adjust",
    )!;
    const productsReservationsManage = state.permissions.get(
      "products.reservations.manage",
    )!;
    const productsMediaManage = state.permissions.get("products.media.manage")!;
    const ordersStatusManage = state.permissions.get("orders.status.manage")!;
    const ordersPaymentReview = state.permissions.get("orders.payment.review")!;
    const ordersCancel = state.permissions.get("orders.cancel")!;
    const checkoutConfigure = state.permissions.get("checkout.configure")!;
    const customersView = state.permissions.get("customers.view")!;
    const customersManage = state.permissions.get("customers.manage")!;
    const customersSecurityManage = state.permissions.get(
      "customers.security.manage",
    )!;
    const customersOrdersLink = state.permissions.get("customers.orders.link")!;
    const customersConfigure = state.permissions.get("customers.configure")!;
    expect(
      state.rolePermissions.has(`${superAdmin.id}:${pricingPublish.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${superAdmin.id}:${accountsPublish.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${superAdmin.id}:${customBuildsPublish.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(
        `${superAdmin.id}:${customBuildsQuotesManage.id}`,
      ),
    ).toBe(true);
    expect(
      state.rolePermissions.has(
        `${superAdmin.id}:${productsInventoryAdjust.id}`,
      ),
    ).toBe(true);
    expect(
      state.rolePermissions.has(
        `${superAdmin.id}:${productsReservationsManage.id}`,
      ),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${editor.id}:${productsPublish.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${editor.id}:${productsMediaManage.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${superAdmin.id}:${ordersPaymentReview.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${superAdmin.id}:${checkoutConfigure.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${superAdmin.id}:${customersView.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${superAdmin.id}:${customersManage.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${pricingPublish.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${defaultPermission.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${productsPublish.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(
        `${supportAgent.id}:${productsInventoryAdjust.id}`,
      ),
    ).toBe(false);
    expect(
      state.rolePermissions.has(
        `${supportAgent.id}:${productsReservationsManage.id}`,
      ),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${ordersStatusManage.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${ordersPaymentReview.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${ordersCancel.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${checkoutConfigure.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${customersView.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${customersManage.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(
        `${supportAgent.id}:${customersSecurityManage.id}`,
      ),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${customersOrdersLink.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${customersConfigure.id}`),
    ).toBe(false);
    expect(state.rolePermissions.has(`${supportAgent.id}:${goldView.id}`)).toBe(
      true,
    );
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${goldPublish.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${goldInventoryAdjust.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${accountsView.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${accountsPublish.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${accountsApprove.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(
        `${supportAgent.id}:${accountsAvailabilityManage.id}`,
      ),
    ).toBe(false);
    expect(
      state.rolePermissions.has(
        `${supportAgent.id}:${accountsHandoverReview.id}`,
      ),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${customBuildsView.id}`),
    ).toBe(true);
    expect(
      state.rolePermissions.has(
        `${supportAgent.id}:${customBuildsRequestsReview.id}`,
      ),
    ).toBe(true);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${customBuildsEdit.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(`${supportAgent.id}:${customBuildsPublish.id}`),
    ).toBe(false);
    expect(
      state.rolePermissions.has(
        `${supportAgent.id}:${customBuildsAttachmentsReview.id}`,
      ),
    ).toBe(false);
    expect(
      state.rolePermissions.has(
        `${supportAgent.id}:${customBuildsQuotesManage.id}`,
      ),
    ).toBe(false);
    expect(administrator.passwordHash).toBe(originalPasswordHash);
    expect(administrator.accountType).toBe("STAFF");
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

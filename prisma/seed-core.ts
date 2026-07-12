import {
  allPermissionKeys,
  permissionDescriptions,
  permissions,
  type PermissionKey,
} from "../src/lib/auth/permissions";

export type SeedClient = {
  permission: {
    upsert(args: {
      where: { key: string };
      create: { key: string; description: string };
      update: { description: string };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  role: {
    upsert(args: {
      where: { key: string };
      create: { key: string; name: string; description: string };
      update: { name: string; description: string };
      select: { id: true };
    }): Promise<{ id: string }>;
    findUniqueOrThrow(args: {
      where: { key: string };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  rolePermission: {
    createMany(args: {
      data: Array<{ roleId: string; permissionId: string }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  featureFlag: {
    upsert(args: {
      where: { key: string };
      create: { key: string; description: string; enabled: boolean };
      update: { description: string };
    }): Promise<unknown>;
  };
  user: {
    upsert(args: {
      where: { email: string };
      create: {
        email: string;
        name: string;
        passwordHash: string;
        emailVerified: Date;
      };
      update: { passwordHash?: string };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  userRole: {
    upsert(args: {
      where: { userId_roleId: { userId: string; roleId: string } };
      create: { userId: string; roleId: string };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
};

export type AdminSeedConfiguration = {
  email?: string;
  password?: string;
  name: string;
  resetPassword: boolean;
};

export type PasswordHasher = (password: string) => Promise<string>;

export const defaultRoles: Array<{
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}> = [
  {
    key: "SUPER_ADMIN",
    name: "Super Administrator",
    description: "Full platform administration.",
    permissions: allPermissionKeys,
  },
  {
    key: "EDITOR",
    name: "Editor",
    description: "Content and catalogue publishing without sensitive settings.",
    permissions: [
      permissions.adminAccess,
      permissions.designSystemView,
      permissions.productsView,
      permissions.productsEdit,
    ],
  },
  {
    key: "SUPPORT_AGENT",
    name: "Support Agent",
    description:
      "Customer and order context required for support conversations.",
    permissions: [
      permissions.adminAccess,
      permissions.designSystemView,
      permissions.ordersView,
      permissions.ordersUpdate,
      permissions.chatRespond,
    ],
  },
];

export const defaultFeatureFlags = [
  ["payments.paypal", "PayPal provider activation", false],
  ["payments.apple_pay", "Apple Pay provider activation", false],
  ["payments.google_pay", "Google Pay provider activation", false],
  ["payments.cards", "Credit and debit card provider activation", false],
  ["payments.payoneer", "Payoneer provider activation", false],
  ["payments.crypto", "Cryptocurrency provider activation", false],
  ["payments.osrs_gp", "OSRS GP payment activation", false],
  ["delivery.priority", "Priority delivery option", false],
  ["delivery.express", "Express delivery option", false],
  ["catalogue_card_engine_enabled", "Reusable catalogue card engine", true],
  ["rsn_eligibility_enabled", "Public RSN eligibility checks", false],
  [
    "skilling_calculator_enabled",
    "Public skilling calculator estimates",
    false,
  ],
  [
    "bossing_calculator_enabled",
    "Public bossing and PvM calculator estimates",
    false,
  ],
] as const;

export async function seedDatabase(
  prisma: SeedClient,
  admin: AdminSeedConfiguration,
  hashPassword: PasswordHasher,
) {
  const permissionRecords = new Map<string, { id: string }>();
  for (const key of allPermissionKeys) {
    const record = await prisma.permission.upsert({
      where: { key },
      create: { key, description: permissionDescriptions[key] },
      update: { description: permissionDescriptions[key] },
      select: { id: true },
    });
    permissionRecords.set(key, record);
  }

  for (const roleDefinition of defaultRoles) {
    const role = await prisma.role.upsert({
      where: { key: roleDefinition.key },
      create: {
        key: roleDefinition.key,
        name: roleDefinition.name,
        description: roleDefinition.description,
      },
      update: {
        name: roleDefinition.name,
        description: roleDefinition.description,
      },
      select: { id: true },
    });

    await prisma.rolePermission.createMany({
      data: roleDefinition.permissions.map((key) => ({
        roleId: role.id,
        permissionId: permissionRecords.get(key)!.id,
      })),
      skipDuplicates: true,
    });
  }

  for (const [key, description, enabled] of defaultFeatureFlags) {
    await prisma.featureFlag.upsert({
      where: { key },
      create: { key, description, enabled },
      update: { description },
    });
  }

  if (admin.email && admin.password) {
    const email = admin.email.toLowerCase();
    const passwordHash = await hashPassword(admin.password);
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: admin.name,
        passwordHash,
        emailVerified: new Date(),
      },
      update: admin.resetPassword ? { passwordHash } : {},
      select: { id: true },
    });
    const superAdmin = await prisma.role.findUniqueOrThrow({
      where: { key: "SUPER_ADMIN" },
      select: { id: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: superAdmin.id } },
      create: { userId: user.id, roleId: superAdmin.id },
      update: {},
    });
  }
}

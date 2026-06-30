import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import argon2 from "argon2";
import { z } from "zod";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  allPermissionKeys,
  permissionDescriptions,
  permissions,
  type PermissionKey,
} from "../src/lib/auth/permissions";

const seedEnvironmentSchema = z
  .object({
    DATABASE_HOST: z.string().default("127.0.0.1"),
    DATABASE_PORT: z.coerce.number().int().positive().default(3306),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
    DATABASE_NAME: z.string().min(1),
    DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL: z.stringbool().default(false),
    ADMIN_SEED_EMAIL: z.string().email().optional().or(z.literal("")),
    ADMIN_SEED_PASSWORD: z.string().min(12).optional().or(z.literal("")),
    ADMIN_SEED_NAME: z.string().min(1).default("Local Super Admin"),
  })
  .superRefine((value, context) => {
    const hasEmail = Boolean(value.ADMIN_SEED_EMAIL);
    const hasPassword = Boolean(value.ADMIN_SEED_PASSWORD);
    if (hasEmail !== hasPassword) {
      context.addIssue({
        code: "custom",
        message:
          "ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be provided together.",
      });
    }
  });

const env = seedEnvironmentSchema.parse(process.env);
const adapter = new PrismaMariaDb({
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  user: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  allowPublicKeyRetrieval: env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL,
  connectionLimit: 2,
});
const prisma = new PrismaClient({ adapter });

const roles: Array<{
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

const featureFlags = [
  ["payments.paypal", "PayPal provider activation"],
  ["payments.apple_pay", "Apple Pay provider activation"],
  ["payments.google_pay", "Google Pay provider activation"],
  ["payments.cards", "Credit and debit card provider activation"],
  ["payments.payoneer", "Payoneer provider activation"],
  ["payments.crypto", "Cryptocurrency provider activation"],
  ["payments.osrs_gp", "OSRS GP payment activation"],
  ["delivery.priority", "Priority delivery option"],
  ["delivery.express", "Express delivery option"],
] as const;

async function main() {
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

  for (const roleDefinition of roles) {
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

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: roleDefinition.permissions.map((key) => ({
        roleId: role.id,
        permissionId: permissionRecords.get(key)!.id,
      })),
    });
  }

  for (const [key, description] of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key },
      create: { key, description, enabled: false },
      update: { description, enabled: false },
    });
  }

  if (env.ADMIN_SEED_EMAIL && env.ADMIN_SEED_PASSWORD) {
    const passwordHash = await argon2.hash(env.ADMIN_SEED_PASSWORD, {
      type: argon2.argon2id,
    });
    const user = await prisma.user.upsert({
      where: { email: env.ADMIN_SEED_EMAIL.toLowerCase() },
      create: {
        email: env.ADMIN_SEED_EMAIL.toLowerCase(),
        name: env.ADMIN_SEED_NAME,
        passwordHash,
        emailVerified: new Date(),
      },
      update: { name: env.ADMIN_SEED_NAME, passwordHash, status: "ACTIVE" },
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

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

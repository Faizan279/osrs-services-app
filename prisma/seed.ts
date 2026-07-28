import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import argon2 from "argon2";
import { z } from "zod";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedAccountMarketplace } from "./account-seed";
import { seedCatalogue, type CatalogueSeedClient } from "./catalogue-seed";
import { seedGold } from "./gold-seed";
import { seedPricing } from "./pricing-seed";
import { seedDatabase, type SeedClient } from "./seed-core";

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
    ADMIN_SEED_RESET_PASSWORD: z.stringbool().default(false),
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
    if (value.ADMIN_SEED_RESET_PASSWORD && (!hasEmail || !hasPassword)) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_SEED_RESET_PASSWORD"],
        message:
          "ADMIN_SEED_RESET_PASSWORD requires ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD.",
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

async function main() {
  await seedDatabase(
    prisma as unknown as SeedClient,
    {
      email: env.ADMIN_SEED_EMAIL || undefined,
      password: env.ADMIN_SEED_PASSWORD || undefined,
      name: env.ADMIN_SEED_NAME,
      resetPassword: env.ADMIN_SEED_RESET_PASSWORD,
    },
    (password) => argon2.hash(password, { type: argon2.argon2id }),
  );
  await seedCatalogue(prisma as unknown as CatalogueSeedClient);
  await seedPricing(prisma);
  await seedGold(prisma);
  await seedAccountMarketplace(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

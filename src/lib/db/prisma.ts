import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { createRuntimePrismaClient } from "@/lib/db/runtime";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return createRuntimePrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

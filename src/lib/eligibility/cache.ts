import "server-only";

import { createHmac } from "node:crypto";

import { env } from "@/lib/env";
import {
  publicStatsProfileSchema,
  type PublicStatsProfile,
} from "@/lib/eligibility/profile";
import { prisma } from "@/lib/db/prisma";

type CacheStore = Pick<typeof prisma.rsnLookupCache, "findUnique" | "upsert">;

export function privateLookupKey(value: string) {
  return createHmac("sha256", env.ELIGIBILITY_HMAC_SECRET)
    .update(value.toLowerCase())
    .digest("hex");
}

export async function readRsnCache(
  normalizedRsn: string,
  provider: string,
  store: CacheStore = prisma.rsnLookupCache,
) {
  const lookupKey = privateLookupKey(normalizedRsn);
  const record = await store.findUnique({
    where: { lookupKey_provider: { lookupKey, provider } },
  });
  if (!record || record.expiresAt <= new Date()) return null;
  if (record.status === "NOT_FOUND") return { status: "NOT_FOUND" as const };
  const parsed = publicStatsProfileSchema.safeParse(record.payload);
  if (!parsed.success) return null;
  return { status: "FOUND" as const, profile: parsed.data };
}

export async function writeRsnCache(
  normalizedRsn: string,
  provider: string,
  result:
    { status: "FOUND"; profile: PublicStatsProfile } | { status: "NOT_FOUND" },
  store: CacheStore = prisma.rsnLookupCache,
) {
  const now = new Date();
  const seconds =
    result.status === "FOUND"
      ? env.RSN_CACHE_TTL_SECONDS
      : env.RSN_NEGATIVE_CACHE_TTL_SECONDS;
  const lookupKey = privateLookupKey(normalizedRsn);
  await store.upsert({
    where: { lookupKey_provider: { lookupKey, provider } },
    create: {
      lookupKey,
      provider,
      status: result.status,
      payload: result.status === "FOUND" ? result.profile : undefined,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + seconds * 1000),
    },
    update: {
      status: result.status,
      payload: result.status === "FOUND" ? result.profile : undefined,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + seconds * 1000),
    },
  });
}

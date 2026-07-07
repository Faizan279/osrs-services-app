import "server-only";

import { readRsnCache, writeRsnCache } from "@/lib/eligibility/cache";
import {
  RsnNotFoundError,
  type RsnStatsProvider,
} from "@/lib/eligibility/provider";

type CacheAdapter = {
  read: typeof readRsnCache;
  write: typeof writeRsnCache;
};

export async function lookupPublicStats(
  normalizedRsn: string,
  provider: RsnStatsProvider,
  cache: CacheAdapter = { read: readRsnCache, write: writeRsnCache },
) {
  const cached = await cache.read(normalizedRsn, provider.id);
  if (cached?.status === "NOT_FOUND") throw new RsnNotFoundError();
  if (cached?.status === "FOUND") {
    return { profile: cached.profile, cached: true };
  }
  try {
    const profile = await provider.lookup(normalizedRsn);
    await cache
      .write(normalizedRsn, provider.id, { status: "FOUND", profile })
      .catch(() => undefined);
    return { profile, cached: false };
  } catch (error) {
    if (error instanceof RsnNotFoundError) {
      await cache
        .write(normalizedRsn, provider.id, { status: "NOT_FOUND" })
        .catch(() => undefined);
    }
    throw error;
  }
}

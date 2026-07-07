import { describe, expect, it, vi } from "vitest";

import { readRsnCache, writeRsnCache } from "@/lib/eligibility/cache";
import { lookupPublicStats } from "@/lib/eligibility/lookup";
import type { PublicStatsProfile } from "@/lib/eligibility/profile";
import { consumePublicLookupLimit } from "@/lib/eligibility/rate-limit";

const profile: PublicStatsProfile = {
  normalizedRsn: "Sample User",
  displayName: null,
  fetchedAt: "2026-07-06T00:00:00.000Z",
  provider: "fixture",
  totalLevel: 1000,
  totalXp: 5_000_000,
  skillLevels: { attack: 70 },
  skillXp: { attack: 800_000 },
  activityScores: {},
};

describe("eligibility cache", () => {
  it("uses a valid cache hit without calling the provider", async () => {
    const provider = { id: "fixture", lookup: vi.fn() };
    const result = await lookupPublicStats("Sample User", provider, {
      read: vi.fn().mockResolvedValue({ status: "FOUND", profile }),
      write: vi.fn(),
    });
    expect(result.cached).toBe(true);
    expect(provider.lookup).not.toHaveBeenCalled();
  });

  it("refreshes after a miss and ignores corrupt or expired payloads", async () => {
    const store = {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({
          status: "FOUND",
          expiresAt: new Date(Date.now() + 60_000),
          payload: { broken: true },
        })
        .mockResolvedValueOnce({
          status: "FOUND",
          expiresAt: new Date(Date.now() - 1),
          payload: profile,
        }),
      upsert: vi.fn(),
    };
    expect(
      await readRsnCache("Sample User", "fixture", store as never),
    ).toBeNull();
    expect(
      await readRsnCache("Sample User", "fixture", store as never),
    ).toBeNull();
  });

  it("uses a shorter expiry for not-found results", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const store = { findUnique: vi.fn(), upsert };
    await writeRsnCache(
      "Sample User",
      "fixture",
      { status: "NOT_FOUND" },
      store as never,
    );
    const negative = upsert.mock.calls[0]![0].create;
    upsert.mockClear();
    await writeRsnCache(
      "Sample User",
      "fixture",
      { status: "FOUND", profile },
      store as never,
    );
    const positive = upsert.mock.calls[0]![0].create;
    expect(
      negative.expiresAt.getTime() - negative.fetchedAt.getTime(),
    ).toBeLessThan(positive.expiresAt.getTime() - positive.fetchedAt.getTime());
  });
});

describe("database-backed public rate limit", () => {
  it("blocks excess requests and stores only an HMAC identity", async () => {
    let count = 0;
    const upsert = vi.fn(async (args) => ({
      count: args.create ? ++count : ++count,
    }));
    const store = {
      upsert,
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    };
    const results = [];
    for (let index = 0; index < 9; index += 1) {
      results.push(
        await consumePublicLookupLimit(
          "ip:203.0.113.10",
          new Date("2026-07-06T00:00:01Z"),
          store as never,
        ),
      );
    }
    expect(results.slice(0, 8).every(Boolean)).toBe(true);
    expect(results[8]).toBe(false);
    const serialized = JSON.stringify(upsert.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("203.0.113.10");
    expect(serialized).toMatch(/[a-f0-9]{64}/);
  });
});

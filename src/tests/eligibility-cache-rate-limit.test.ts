import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readRsnCache, writeRsnCache } from "@/lib/eligibility/cache";
import { lookupPublicStats } from "@/lib/eligibility/lookup";
import type { PublicStatsProfile } from "@/lib/eligibility/profile";
import {
  consumePublicLookupLimit,
  createPublicClientToken,
  PUBLIC_CLIENT_COOKIE,
  requestIdentity,
} from "@/lib/eligibility/rate-limit";
import { env } from "@/lib/env";

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

afterEach(() => {
  env.RSN_TRUST_PROXY_IP_HEADER = false;
});

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
  it("uses distinct opaque cookie identities for separate same-UA clients", () => {
    const headers = {
      "user-agent": "same-browser",
      "accept-language": "en-US,en;q=0.9",
    };
    const first = requestIdentity(
      new NextRequest("https://example.test/api/catalogue/eligibility", {
        headers,
      }),
    );
    const second = requestIdentity(
      new NextRequest("https://example.test/api/catalogue/eligibility", {
        headers,
      }),
    );
    expect(first.identity).not.toBe(second.identity);
    expect(first.setCookie?.name).toBe(PUBLIC_CLIENT_COOKIE);
    expect(second.setCookie?.name).toBe(PUBLIC_CLIENT_COOKIE);
  });

  it("keeps the same bucket when a valid public client cookie returns", () => {
    const token = createPublicClientToken();
    const first = requestIdentity(
      new NextRequest("https://example.test/api/catalogue/eligibility", {
        headers: { cookie: `${PUBLIC_CLIENT_COOKIE}=${token}` },
      }),
    );
    const second = requestIdentity(
      new NextRequest("https://example.test/api/catalogue/eligibility", {
        headers: { cookie: `${PUBLIC_CLIENT_COOKIE}=${token}` },
      }),
    );
    expect(first.identity).toBe(`client:${token}`);
    expect(second.identity).toBe(first.identity);
    expect(first.setCookie).toBeNull();
  });

  it("ignores malformed trusted IP header values", () => {
    env.RSN_TRUST_PROXY_IP_HEADER = true;
    const token = createPublicClientToken();
    const identity = requestIdentity(
      new NextRequest("https://example.test/api/catalogue/eligibility", {
        headers: {
          cookie: `${PUBLIC_CLIENT_COOKIE}=${token}`,
          "x-real-ip": "203.0.113.10, 198.51.100.4",
        },
      }),
    );
    expect(identity.identity).toBe(`client:${token}`);
  });

  it("combines a valid trusted IP with the anonymous cookie identity", () => {
    env.RSN_TRUST_PROXY_IP_HEADER = true;
    const token = createPublicClientToken();
    const identity = requestIdentity(
      new NextRequest("https://example.test/api/catalogue/eligibility", {
        headers: {
          cookie: `${PUBLIC_CLIENT_COOKIE}=${token}`,
          "x-real-ip": "203.0.113.10",
        },
      }),
    );
    expect(identity.identity).toBe(`client:${token}:ip:203.0.113.10`);
  });

  it("ignores x-real-ip when the trusted header flag is disabled", () => {
    const token = createPublicClientToken();
    const identity = requestIdentity(
      new NextRequest("https://example.test/api/catalogue/eligibility", {
        headers: {
          cookie: `${PUBLIC_CLIENT_COOKIE}=${token}`,
          "x-real-ip": "203.0.113.10",
        },
      }),
    );
    expect(identity.identity).toBe(`client:${token}`);
  });

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
    const token = createPublicClientToken();
    const identity = `client:${token}:ip:203.0.113.10`;
    for (let index = 0; index < 9; index += 1) {
      results.push(
        await consumePublicLookupLimit(
          identity,
          new Date("2026-07-06T00:00:01Z"),
          store as never,
        ),
      );
    }
    expect(results.slice(0, 8).every(Boolean)).toBe(true);
    expect(results[8]).toBe(false);
    const serialized = JSON.stringify(upsert.mock.calls[0]?.[0]);
    expect(serialized).not.toContain("203.0.113.10");
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain("client:");
    expect(serialized).toMatch(/[a-f0-9]{64}/);
  });
});

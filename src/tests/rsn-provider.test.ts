import { afterEach, describe, expect, it, vi } from "vitest";

import { skillMetricNames } from "@/lib/eligibility/metrics";
import {
  parseOfficialHiscores,
  RsnProviderDataError,
} from "@/lib/eligibility/provider-parser";
import {
  configuredRsnProvider,
  DevelopmentFixtureProvider,
  OfficialOsrsHiscoresProvider,
  RsnNotFoundError,
  RsnProviderUnavailableError,
} from "@/lib/eligibility/provider";
import { env, environmentSchema } from "@/lib/env";

function validFixture(extra: string[] = []) {
  return [
    "1,1610,42000000",
    ...skillMetricNames.map(() => "1,70,800000"),
    ...extra,
  ].join("\n");
}

afterEach(() => {
  vi.unstubAllGlobals();
  env.NODE_ENV = "test";
  env.RSN_DEVELOPMENT_FIXTURE = false;
});

describe("official hiscores parser", () => {
  it("normalizes a valid deterministic response", () => {
    const profile = parseOfficialHiscores(
      validFixture(),
      "Sample User",
      new Date("2026-07-06T00:00:00Z"),
    );
    expect(profile.totalLevel).toBe(1610);
    expect(profile.skillLevels.attack).toBe(70);
    expect(profile.provider).toBe("official-osrs-hiscores");
  });

  it.each([
    "",
    "1,100,200",
    `${validFixture().split("\n").slice(0, 10).join("\n")}`,
  ])("rejects empty or truncated content", (fixture) =>
    expect(() => parseOfficialHiscores(fixture, "Sample User")).toThrow(
      RsnProviderDataError,
    ),
  );

  it("rejects invalid numeric content", () => {
    const fixture = validFixture().replace("1,70,800000", "1,seventy,800000");
    expect(() => parseOfficialHiscores(fixture, "Sample User")).toThrow(
      RsnProviderDataError,
    );
  });

  it("rejects unsafe integer content before profile evaluation", () => {
    const fixture = validFixture().replace(
      "1,1610,42000000",
      "1,1610,9007199254740992",
    );
    expect(() => parseOfficialHiscores(fixture, "Sample User")).toThrow(
      RsnProviderDataError,
    );
  });

  it("accepts validated additional activity lines", () => {
    expect(
      parseOfficialHiscores(validFixture(["2,150"]), "Sample User").totalXp,
    ).toBe(42_000_000);
  });
});

describe("RSN provider environment safety", () => {
  it("rejects the development fixture flag for production startup", () => {
    const result = environmentSchema.safeParse({
      ...process.env,
      NODE_ENV: "production",
      RSN_DEVELOPMENT_FIXTURE: "true",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["RSN_DEVELOPMENT_FIXTURE"]);
    }
  });

  it("defensively refuses the development fixture in production", () => {
    env.NODE_ENV = "production";
    env.RSN_DEVELOPMENT_FIXTURE = true;
    expect(configuredRsnProvider()).toBeInstanceOf(
      OfficialOsrsHiscoresProvider,
    );

    env.NODE_ENV = "test";
    expect(configuredRsnProvider()).toBeInstanceOf(DevelopmentFixtureProvider);
  });
});

describe("official hiscores provider safety", () => {
  it("distinguishes not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404 })),
    );
    await expect(
      new OfficialOsrsHiscoresProvider().lookup("Missing User"),
    ).rejects.toBeInstanceOf(RsnNotFoundError);
  });

  it("maps provider unavailability to a safe typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    await expect(
      new OfficialOsrsHiscoresProvider().lookup("Sample User"),
    ).rejects.toBeInstanceOf(RsnProviderUnavailableError);
  });

  it("rejects oversized declared responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(validFixture(), {
          headers: { "content-length": "70000" },
        }),
      ),
    );
    await expect(
      new OfficialOsrsHiscoresProvider().lookup("Sample User"),
    ).rejects.toBeInstanceOf(RsnProviderDataError);
  });

  it("times out without exposing raw fetch errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(new Error("raw timeout")),
            ),
          ),
      ),
    );
    const lookup = expect(
      new OfficialOsrsHiscoresProvider().lookup("Sample User"),
    ).rejects.toBeInstanceOf(RsnProviderUnavailableError);
    await vi.advanceTimersByTimeAsync(501);
    await lookup;
    vi.useRealTimers();
  });
});

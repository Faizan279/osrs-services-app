import "server-only";

import { env } from "@/lib/env";
import { skillMetricNames } from "@/lib/eligibility/metrics";
import type { PublicStatsProfile } from "@/lib/eligibility/profile";
import {
  parseOfficialHiscores,
  RsnProviderDataError,
} from "@/lib/eligibility/provider-parser";

export {
  parseOfficialHiscores,
  RsnProviderDataError,
} from "@/lib/eligibility/provider-parser";

export class RsnNotFoundError extends Error {}
export class RsnProviderUnavailableError extends Error {}

export interface RsnStatsProvider {
  readonly id: string;
  lookup(normalizedRsn: string): Promise<PublicStatsProfile>;
}

const MAX_RESPONSE_BYTES = 64 * 1024;

export class OfficialOsrsHiscoresProvider implements RsnStatsProvider {
  readonly id = "official-osrs-hiscores";

  async lookup(normalizedRsn: string) {
    const url = new URL(
      "https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws",
    );
    url.searchParams.set("player", normalizedRsn);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.RSN_PROVIDER_TIMEOUT_MS,
    );
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
        headers: { Accept: "text/plain" },
      });
      if (response.status === 404) throw new RsnNotFoundError();
      if (!response.ok) throw new RsnProviderUnavailableError();
      const declaredSize = Number(response.headers.get("content-length") ?? 0);
      if (declaredSize > MAX_RESPONSE_BYTES) throw new RsnProviderDataError();
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_RESPONSE_BYTES)
        throw new RsnProviderDataError();
      return parseOfficialHiscores(
        new TextDecoder().decode(bytes),
        normalizedRsn,
      );
    } catch (error) {
      if (
        error instanceof RsnNotFoundError ||
        error instanceof RsnProviderDataError ||
        error instanceof RsnProviderUnavailableError
      ) {
        throw error;
      }
      throw new RsnProviderUnavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class DevelopmentFixtureProvider implements RsnStatsProvider {
  readonly id = "development-fixture";
  async lookup(normalizedRsn: string): Promise<PublicStatsProfile> {
    const skillLevels = Object.fromEntries(
      skillMetricNames.map((skill) => [skill, 70]),
    );
    const skillXp = Object.fromEntries(
      skillMetricNames.map((skill) => [skill, 800_000]),
    );
    return {
      normalizedRsn,
      displayName: "Sample Adventurer",
      fetchedAt: new Date().toISOString(),
      provider: this.id,
      totalLevel: 1610,
      totalXp: 42_000_000,
      skillLevels,
      skillXp,
      activityScores: {},
    };
  }
}

export function configuredRsnProvider(): RsnStatsProvider {
  if (env.NODE_ENV !== "production" && env.RSN_DEVELOPMENT_FIXTURE) {
    return new DevelopmentFixtureProvider();
  }
  return new OfficialOsrsHiscoresProvider();
}

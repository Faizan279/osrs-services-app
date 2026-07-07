import { skillMetricNames } from "@/lib/eligibility/metrics";
import type { PublicStatsProfile } from "@/lib/eligibility/profile";

export class RsnProviderDataError extends Error {}

const REQUIRED_LINES = skillMetricNames.length + 1;

function numericFields(line: string, minimum: number) {
  const values = line.split(",");
  if (
    values.length < minimum ||
    values.some((value) => !/^-?\d+$/.test(value))
  ) {
    throw new RsnProviderDataError(
      "Public statistics returned an unexpected format.",
    );
  }
  return values.map(Number);
}

export function parseOfficialHiscores(
  text: string,
  normalizedRsn: string,
  fetchedAt = new Date(),
): PublicStatsProfile {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < REQUIRED_LINES) {
    throw new RsnProviderDataError("Public statistics were incomplete.");
  }
  const overall = numericFields(lines[0]!, 3);
  const skillLevels: Record<string, number> = {};
  const skillXp: Record<string, number> = {};
  skillMetricNames.forEach((skill, index) => {
    const values = numericFields(lines[index + 1]!, 3);
    if (values[1]! < 0 || values[2]! < 0) {
      throw new RsnProviderDataError(
        "Public statistics contained invalid values.",
      );
    }
    skillLevels[skill] = values[1]!;
    skillXp[skill] = values[2]!;
  });
  for (const line of lines.slice(REQUIRED_LINES)) numericFields(line, 2);
  if (overall[1]! < 0 || overall[2]! < 0) {
    throw new RsnProviderDataError(
      "Public statistics contained invalid totals.",
    );
  }
  return {
    normalizedRsn,
    displayName: null,
    fetchedAt: fetchedAt.toISOString(),
    provider: "official-osrs-hiscores",
    totalLevel: overall[1]!,
    totalXp: overall[2]!,
    skillLevels,
    skillXp,
    activityScores: {},
  };
}

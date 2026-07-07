import { z } from "zod";

const publicStatsInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const publicStatsProfileSchema = z.object({
  normalizedRsn: z.string().min(1).max(12),
  displayName: z.string().min(1).max(12).nullable(),
  fetchedAt: z.iso.datetime(),
  provider: z.string().min(1).max(80),
  totalLevel: publicStatsInteger,
  totalXp: publicStatsInteger,
  skillLevels: z.record(z.string(), publicStatsInteger),
  skillXp: z.record(z.string(), publicStatsInteger),
  activityScores: z.record(
    z.string(),
    z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  ),
});

export type PublicStatsProfile = z.infer<typeof publicStatsProfileSchema>;

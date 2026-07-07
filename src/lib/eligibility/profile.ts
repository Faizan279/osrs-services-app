import { z } from "zod";

export const publicStatsProfileSchema = z.object({
  normalizedRsn: z.string().min(1).max(12),
  displayName: z.string().min(1).max(12).nullable(),
  fetchedAt: z.iso.datetime(),
  provider: z.string().min(1).max(80),
  totalLevel: z.number().int().min(0),
  totalXp: z.number().int().min(0),
  skillLevels: z.record(z.string(), z.number().int().min(0)),
  skillXp: z.record(z.string(), z.number().int().min(0)),
  activityScores: z.record(z.string(), z.number().int()),
});

export type PublicStatsProfile = z.infer<typeof publicStatsProfileSchema>;

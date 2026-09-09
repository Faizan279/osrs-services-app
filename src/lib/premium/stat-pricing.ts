import { z } from "zod";

export const premiumStatPricingSchema = z.preprocess(
  (value) => value ?? [],
  z
    .array(
      z.object({
        metricKey: z.enum([
          "skill.ranged.level",
          "skill.magic.level",
          "skill.defence.level",
          "skill.prayer.level",
        ]),
        minimumLevel: z.number().int().min(1).max(99),
        maximumLevel: z.number().int().min(1).max(99),
        adjustmentCents: z.number().int().min(0).max(100_000_000),
        label: z.string().trim().min(2).max(120),
      }),
    )
    .max(40)
    .superRefine((bands, context) => {
      bands.forEach((band, index) => {
        if (
          band.maximumLevel < band.minimumLevel ||
          bands
            .slice(0, index)
            .some(
              (other) =>
                other.metricKey === band.metricKey &&
                other.minimumLevel <= band.maximumLevel &&
                band.minimumLevel <= other.maximumLevel,
            )
        ) {
          context.addIssue({
            code: "custom",
            path: [index],
            message:
              "Stat bands must have valid, non-overlapping level ranges per stat.",
          });
        }
      });
    }),
);

export function premiumStatPriceLines(
  configuration: unknown,
  stats: Array<{ metricKey: string; value: number }> = [],
) {
  const bands = premiumStatPricingSchema.parse(configuration);
  const metrics = new Set(bands.map((band) => band.metricKey));
  for (const metric of metrics) {
    const values = stats.filter((stat) => stat.metricKey === metric);
    const stat = values[0];
    if (
      values.length !== 1 ||
      !stat ||
      !Number.isInteger(stat.value) ||
      stat.value < 1 ||
      stat.value > 99
    ) {
      throw new Error(
        `Enter a valid ${metric.split(".")[1]} level to calculate this service.`,
      );
    }
  }
  return bands.flatMap((band) => {
    const value = stats.find(
      (stat) => stat.metricKey === band.metricKey,
    )?.value;
    return value != null &&
      value >= band.minimumLevel &&
      value <= band.maximumLevel
      ? [{ label: band.label, amountCents: band.adjustmentCents }]
      : [];
  });
}

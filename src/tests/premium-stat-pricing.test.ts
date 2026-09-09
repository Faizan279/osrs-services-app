import { describe, expect, it } from "vitest";
import {
  premiumStatPriceLines,
  premiumStatPricingSchema,
} from "@/lib/premium/stat-pricing";

const band = {
  metricKey: "skill.ranged.level",
  minimumLevel: 70,
  maximumLevel: 89,
  adjustmentCents: 2500,
  label: "Ranged 70–89",
};
describe("Admin premium stat bands", () => {
  it("leaves existing prices unchanged when unconfigured", () => {
    expect(premiumStatPriceLines(null)).toEqual([]);
  });
  it("applies only matching inclusive ranges", () => {
    for (const value of [70, 80, 89])
      expect(
        premiumStatPriceLines([band], [{ metricKey: band.metricKey, value }])[0]
          ?.amountCents,
      ).toBe(2500);
    expect(
      premiumStatPriceLines([band], [{ metricKey: band.metricKey, value: 99 }]),
    ).toEqual([]);
  });
  it("requires valid, unique values for every configured metric", () => {
    for (const stats of [
      [],
      [{ metricKey: band.metricKey, value: 0 }],
      [{ metricKey: band.metricKey, value: 100 }],
      [
        { metricKey: band.metricKey, value: 80 },
        { metricKey: band.metricKey, value: 99 },
      ],
    ]) {
      expect(() => premiumStatPriceLines([band], stats)).toThrow(
        /valid ranged level/,
      );
    }
  });
  it("rejects reversed and overlapping ranges, negative fees and unknown metrics", () => {
    for (const bands of [
      [band, { ...band, minimumLevel: 89, maximumLevel: 99 }],
      [{ ...band, maximumLevel: 60 }],
      [{ ...band, adjustmentCents: -1 }],
      [{ ...band, metricKey: "password" }],
    ]) {
      expect(premiumStatPricingSchema.safeParse(bands).success).toBe(false);
    }
  });
});

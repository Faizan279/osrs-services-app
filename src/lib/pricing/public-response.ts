import type {
  AppliedPricingResult,
  PriceSnapshotV1,
  PricingLine,
} from "@/lib/pricing/engine";

function publicLine({ label, amountCents }: PricingLine) {
  return { label, amountCents };
}

function publicLines(lines: PricingLine[]) {
  return lines.map(publicLine);
}

function publicSnapshot(snapshot: PriceSnapshotV1 | null) {
  if (!snapshot) return null;
  return {
    ...snapshot,
    basePricingLines: publicLines(snapshot.basePricingLines),
    globalAdjustmentLines: publicLines(snapshot.globalAdjustmentLines),
    minimumMaximumAdjustmentLines: publicLines(
      snapshot.minimumMaximumAdjustmentLines,
    ),
  };
}

export function publicPricingPayload(result: AppliedPricingResult) {
  return {
    lineItems: publicLines(result.lineItems),
    globalAdjustmentLines: publicLines(result.globalAdjustmentLines),
    minimumMaximumAdjustmentLines: publicLines(
      result.minimumMaximumAdjustmentLines,
    ),
    pricingRevision: result.pricingRevision,
    priceSnapshot: publicSnapshot(result.priceSnapshot),
    estimatedTotalCents: result.estimatedTotalCents,
    estimatedTotal: result.estimatedTotal,
  };
}

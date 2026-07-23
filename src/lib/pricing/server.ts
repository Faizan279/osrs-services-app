import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  applyGlobalPricing,
  normalizePublishedPricingRevision,
  unchangedPricingResult,
  type AppliedPricingResult,
  type PricingRuleSnapshot,
  type PricingSource,
  type PublishedPricingRevisionSnapshotV1,
} from "@/lib/pricing/engine";

export const GLOBAL_PRICING_FEATURE_FLAG = "global_pricing_enabled";
export const DEFAULT_PRICING_RULE_SET_NAME = "Global pricing";

type PricingRuleWithApplicability = Prisma.PricingRuleGetPayload<{
  include: { applicability: true };
}>;

export function pricingRuleSnapshot(
  rule: PricingRuleWithApplicability,
): PricingRuleSnapshot {
  return {
    id: rule.id,
    publicLabel: rule.publicLabel,
    enabled: rule.enabled,
    ruleType: rule.ruleType,
    amountCents: rule.amountCents,
    valueBps: rule.valueBps,
    priority: rule.priority,
    exclusiveGroupKey: rule.exclusiveGroupKey,
    effectiveStart: rule.effectiveStart?.toISOString() ?? null,
    effectiveEnd: rule.effectiveEnd?.toISOString() ?? null,
    applicability: rule.applicability.map((item) => ({
      scope: item.scope,
      engineType: item.engineType,
      categoryId: item.categoryId,
      serviceId: item.serviceId,
    })),
  };
}

export function publishedRevisionSnapshot({
  ruleSetId,
  revisionId,
  revisionNumber,
  currencyCode,
  publishedAt,
  rules,
}: {
  ruleSetId: string;
  revisionId: string;
  revisionNumber: number;
  currencyCode: string;
  publishedAt: Date;
  rules: PricingRuleWithApplicability[];
}): PublishedPricingRevisionSnapshotV1 {
  return normalizePublishedPricingRevision({
    schemaVersion: 1,
    ruleSetId,
    revisionId,
    revisionNumber,
    currencyCode,
    publishedAt: publishedAt.toISOString(),
    rules: rules.map(pricingRuleSnapshot),
  });
}

export async function loadLatestPublishedPricingRevision() {
  const revision = await prisma.pricingRevision.findFirst({
    orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
    select: { snapshot: true },
  });
  if (!revision) return null;
  return normalizePublishedPricingRevision(revision.snapshot);
}

export async function applyPublishedPricingIfEnabled({
  source,
  now = new Date(),
}: {
  source: PricingSource;
  now?: Date;
}): Promise<AppliedPricingResult> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: GLOBAL_PRICING_FEATURE_FLAG },
    select: { enabled: true },
  });
  if (!flag?.enabled) return unchangedPricingResult(source);
  const revision = await loadLatestPublishedPricingRevision();
  if (!revision) return unchangedPricingResult(source);
  return applyGlobalPricing({ source, revision, now });
}

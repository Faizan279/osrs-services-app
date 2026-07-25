import type { PrismaClient } from "../src/generated/prisma/client";
import {
  PRICING_REVISION_SCHEMA_VERSION,
  type PublishedPricingRevisionSnapshotV1,
} from "../src/lib/pricing/engine";

const SEEDED_PRICING_REVISION_ID = "seededpricingrevisionv1";
const SEEDED_PRICING_RULE_SET_ID = "globalpricingdraftseed";
const SEEDED_PRICING_PUBLISHED_AT = new Date("2026-07-23T00:00:00.000Z");
const DEFAULT_PRICING_RULE_SET_NAME = "Global pricing";

export async function seedPricing(prisma: PrismaClient) {
  let draft = await prisma.pricingRuleSet.findFirst({
    where: { status: "DRAFT" },
    orderBy: { createdAt: "asc" },
  });

  if (!draft) {
    draft = await prisma.pricingRuleSet.create({
      data: {
        id: SEEDED_PRICING_RULE_SET_ID,
        name: DEFAULT_PRICING_RULE_SET_NAME,
        description:
          "Draft global pricing rules. Published revisions are immutable.",
        status: "DRAFT",
        currencyCode: "USD",
        needsClientReview: true,
        internalNotes:
          "Seeded neutral draft. Add rules and publish when ready.",
      },
    });
  }

  const existingRevision = await prisma.pricingRevision.findFirst({
    where: { ruleSetId: draft.id },
    select: { id: true },
  });
  if (existingRevision) return;

  const snapshot: PublishedPricingRevisionSnapshotV1 = {
    schemaVersion: PRICING_REVISION_SCHEMA_VERSION,
    ruleSetId: draft.id,
    revisionId: SEEDED_PRICING_REVISION_ID,
    revisionNumber: 1,
    currencyCode: draft.currencyCode,
    publishedAt: SEEDED_PRICING_PUBLISHED_AT.toISOString(),
    rules: [],
  };

  await prisma.pricingRevision.create({
    data: {
      id: SEEDED_PRICING_REVISION_ID,
      ruleSetId: draft.id,
      revisionNumber: 1,
      snapshot,
      publishedAt: SEEDED_PRICING_PUBLISHED_AT,
    },
  });
}

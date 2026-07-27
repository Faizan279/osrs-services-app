import { z } from "zod";

import type { CatalogueGameMode } from "@/generated/prisma/client";
import {
  ACCOUNT_LISTING_REVISION_SCHEMA_VERSION,
  ACCOUNT_LISTING_SNAPSHOT_SCHEMA_VERSION,
  accountListingApprovalStatuses,
  accountListingAvailabilities,
  accountListingStatuses,
} from "@/lib/accounts/constants";
import { formatCents, type PricingLine } from "@/lib/pricing/engine";

const SUPPORTED_CURRENCY = "USD";
const MAX_MONEY_CENTS = 100_000_000;

const gameModeSchema = z.enum([
  "NORMAL",
  "IRONMAN",
  "HARDCORE_IRONMAN",
  "ULTIMATE_IRONMAN",
]) as z.ZodType<CatalogueGameMode>;

const publicStatSchema = z.object({
  stableKey: z.string().min(1).max(160),
  statKey: z.string().min(1).max(80),
  publicLabel: z.string().min(1).max(120),
  value: z.number().int().min(0).max(10_000),
  maximumValue: z.number().int().min(0).max(10_000).nullable(),
  statGroup: z.string().min(1).max(120),
  sortOrder: z.number().int(),
});

const publicUnlockSchema = z.object({
  stableKey: z.string().min(1).max(160),
  unlockKey: z.string().min(1).max(100),
  publicLabel: z.string().min(1).max(160),
  description: z.string().max(20_000).nullable(),
  unlockType: z.string().min(1).max(80),
  sortOrder: z.number().int(),
});

const publicFeatureSchema = z.object({
  stableKey: z.string().min(1).max(160),
  featureKey: z.string().min(1).max(100),
  publicLabel: z.string().min(1).max(160),
  description: z.string().max(20_000).nullable(),
  sortOrder: z.number().int(),
});

const publicImageSchema = z.object({
  stableKey: z.string().min(1).max(160),
  imageType: z.string().min(1).max(80),
  assetPath: z.string().min(1).max(500),
  altText: z.string().min(1).max(240),
  caption: z.string().max(240).nullable(),
  sortOrder: z.number().int(),
});

export class AccountMarketplaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountMarketplaceValidationError";
  }
}

export type PublicAccountStat = z.infer<typeof publicStatSchema>;
export type PublicAccountUnlock = z.infer<typeof publicUnlockSchema>;
export type PublicAccountFeature = z.infer<typeof publicFeatureSchema>;
export type PublicAccountImage = z.infer<typeof publicImageSchema>;

export type PublishedAccountListingRevisionSnapshotV1 = {
  schemaVersion: typeof ACCOUNT_LISTING_REVISION_SCHEMA_VERSION;
  marketplace: {
    id: string;
    stableKey: string;
    slug: string;
    serviceId: string;
    serviceSlug: string;
    categoryId: string;
    categorySlug: string | null;
    publicName: string;
    currencyCode: string;
  };
  listing: {
    id: string;
    stableKey: string;
    slug: string;
    publicTitle: string;
    shortDescription: string;
    fullDescription: string;
    gameMode: CatalogueGameMode;
    currencyCode: string;
    basePriceCents: number;
    combatLevel: number | null;
    totalLevel: number | null;
    questPoints: number | null;
    accountAgeLabel: string | null;
    membershipStateLabel: string | null;
    publicBadgeText: string | null;
    secureHandoverLabel: string;
  };
  revision: {
    id: string;
    revisionNumber: number;
    publishedAt: string;
  };
  stats: PublicAccountStat[];
  unlocks: PublicAccountUnlock[];
  features: PublicAccountFeature[];
  images: PublicAccountImage[];
};

export type AccountListingSnapshotV1 = {
  schemaVersion: typeof ACCOUNT_LISTING_SNAPSHOT_SCHEMA_VERSION;
  marketplace: {
    stableKey: string;
    slug: string;
    serviceId: string;
    serviceSlug: string;
    categoryId: string;
    categorySlug: string | null;
  };
  listing: {
    stableKey: string;
    slug: string;
    publicTitle: string;
    gameMode: CatalogueGameMode;
  };
  currency: string;
  basePriceCents: number;
  basePricingLines: PricingLine[];
  globalPricingAdjustmentLines: PricingLine[];
  finalEstimatedTotalCents: number;
  publishedListingRevision: {
    id: string;
    revisionNumber: number;
  };
  publishedGlobalPricingRevision: {
    id: string;
    revisionNumber: number;
  } | null;
  availabilityState: (typeof accountListingAvailabilities)[number];
  listingValidity: {
    approvalStatus: (typeof accountListingApprovalStatuses)[number];
    publicationStatus: (typeof accountListingStatuses)[number];
    isApprovedPublished: boolean;
  };
  selectedPublicStats: PublicAccountStat[];
  selectedPublicUnlockReferences: string[];
  selectedPublicFeatureReferences: string[];
  coverImageReference: string | null;
  generatedAt: string;
  repricingRequired: boolean;
  availabilityRecheckRequired: boolean;
};

export type AccountEstimateResult = {
  currency: string;
  lineItems: PricingLine[];
  basePriceCents: number;
  estimatedTotalCents: number;
  estimatedTotal: string;
  availabilityState: (typeof accountListingAvailabilities)[number];
  availabilityMessage: string;
  finalPriceNote: string;
  snapshot: AccountListingSnapshotV1;
};

const revisionSchema: z.ZodType<PublishedAccountListingRevisionSnapshotV1> =
  z.object({
    schemaVersion: z.literal(ACCOUNT_LISTING_REVISION_SCHEMA_VERSION),
    marketplace: z.object({
      id: z.string().min(1).max(30),
      stableKey: z.string().min(1).max(120),
      slug: z.string().min(1).max(180),
      serviceId: z.string().min(1).max(30),
      serviceSlug: z.string().min(1).max(180),
      categoryId: z.string().min(1).max(30),
      categorySlug: z.string().max(180).nullable(),
      publicName: z.string().min(1).max(160),
      currencyCode: z.string().length(3),
    }),
    listing: z.object({
      id: z.string().min(1).max(30),
      stableKey: z.string().min(1).max(120),
      slug: z.string().min(1).max(180),
      publicTitle: z.string().min(1).max(180),
      shortDescription: z.string().min(1).max(500),
      fullDescription: z.string().min(1),
      gameMode: gameModeSchema,
      currencyCode: z.string().length(3),
      basePriceCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
      combatLevel: z.number().int().min(0).max(2277).nullable(),
      totalLevel: z.number().int().min(0).max(2277).nullable(),
      questPoints: z.number().int().min(0).max(400).nullable(),
      accountAgeLabel: z.string().max(120).nullable(),
      membershipStateLabel: z.string().max(120).nullable(),
      publicBadgeText: z.string().max(120).nullable(),
      secureHandoverLabel: z.string().min(1).max(160),
    }),
    revision: z.object({
      id: z.string().min(1).max(30),
      revisionNumber: z.number().int().min(1),
      publishedAt: z.iso.datetime(),
    }),
    stats: z.array(publicStatSchema),
    unlocks: z.array(publicUnlockSchema),
    features: z.array(publicFeatureSchema),
    images: z.array(publicImageSchema),
  });

const estimateSnapshotSchema: z.ZodType<AccountListingSnapshotV1> = z.object({
  schemaVersion: z.literal(ACCOUNT_LISTING_SNAPSHOT_SCHEMA_VERSION),
  marketplace: z.object({
    stableKey: z.string().min(1).max(120),
    slug: z.string().min(1).max(180),
    serviceId: z.string().min(1).max(30),
    serviceSlug: z.string().min(1).max(180),
    categoryId: z.string().min(1).max(30),
    categorySlug: z.string().max(180).nullable(),
  }),
  listing: z.object({
    stableKey: z.string().min(1).max(120),
    slug: z.string().min(1).max(180),
    publicTitle: z.string().min(1).max(180),
    gameMode: gameModeSchema,
  }),
  currency: z.string().length(3),
  basePriceCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
  basePricingLines: z.array(
    z.object({
      label: z.string().min(1).max(160),
      amountCents: z.number().int().min(-MAX_MONEY_CENTS).max(MAX_MONEY_CENTS),
      ruleId: z.string().max(30).optional(),
    }),
  ),
  globalPricingAdjustmentLines: z.array(
    z.object({
      label: z.string().min(1).max(160),
      amountCents: z.number().int().min(-MAX_MONEY_CENTS).max(MAX_MONEY_CENTS),
      ruleId: z.string().max(30).optional(),
    }),
  ),
  finalEstimatedTotalCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
  publishedListingRevision: z.object({
    id: z.string().min(1).max(30),
    revisionNumber: z.number().int().min(1),
  }),
  publishedGlobalPricingRevision: z
    .object({
      id: z.string().min(1).max(30),
      revisionNumber: z.number().int().min(1),
    })
    .nullable(),
  availabilityState: z.enum(accountListingAvailabilities),
  listingValidity: z.object({
    approvalStatus: z.enum(accountListingApprovalStatuses),
    publicationStatus: z.enum(accountListingStatuses),
    isApprovedPublished: z.boolean(),
  }),
  selectedPublicStats: z.array(publicStatSchema),
  selectedPublicUnlockReferences: z.array(z.string().min(1).max(160)),
  selectedPublicFeatureReferences: z.array(z.string().min(1).max(160)),
  coverImageReference: z.string().max(500).nullable(),
  generatedAt: z.iso.datetime(),
  repricingRequired: z.boolean(),
  availabilityRecheckRequired: z.boolean(),
});

function assertSafeMoney(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_CENTS) {
    throw new AccountMarketplaceValidationError(
      `${label} must be a safe whole-cent value.`,
    );
  }
}

export function normalizePublishedAccountListingRevision(
  value: unknown,
): PublishedAccountListingRevisionSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new AccountMarketplaceValidationError(
      "Account listing revision snapshot is malformed.",
    );
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new AccountMarketplaceValidationError(
      "Unknown account listing revision snapshot schema version.",
    );
  }
  const parsed = revisionSchema.safeParse(value);
  if (!parsed.success) {
    throw new AccountMarketplaceValidationError(
      "Account listing revision snapshot is malformed.",
    );
  }
  return parsed.data;
}

export function normalizeAccountListingSnapshot(
  value: unknown,
): AccountListingSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new AccountMarketplaceValidationError(
      "Account listing snapshot is malformed.",
    );
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new AccountMarketplaceValidationError(
      "Unknown account listing snapshot schema version.",
    );
  }
  const parsed = estimateSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new AccountMarketplaceValidationError(
      "Account listing snapshot is malformed.",
    );
  }
  return parsed.data;
}

export function accountListingRevisionSnapshot({
  marketplace,
  listing,
  revisionId,
  revisionNumber,
  publishedAt,
  stats,
  unlocks,
  features,
  images,
}: {
  marketplace: PublishedAccountListingRevisionSnapshotV1["marketplace"];
  listing: PublishedAccountListingRevisionSnapshotV1["listing"];
  revisionId: string;
  revisionNumber: number;
  publishedAt: Date;
  stats: PublicAccountStat[];
  unlocks: PublicAccountUnlock[];
  features: PublicAccountFeature[];
  images: PublicAccountImage[];
}) {
  return normalizePublishedAccountListingRevision({
    schemaVersion: ACCOUNT_LISTING_REVISION_SCHEMA_VERSION,
    marketplace,
    listing,
    revision: {
      id: revisionId,
      revisionNumber,
      publishedAt: publishedAt.toISOString(),
    },
    stats,
    unlocks,
    features,
    images,
  });
}

function availabilityMessage(
  availability: (typeof accountListingAvailabilities)[number],
) {
  if (availability === "AVAILABLE") {
    return "Available for support review. This estimate does not reserve the account.";
  }
  if (availability === "HELD") {
    return "This account is temporarily held by staff and is not available.";
  }
  if (availability === "SOLD") {
    return "This account is marked sold and is not available.";
  }
  return "This account is currently unavailable.";
}

export function calculateAccountListingEstimate({
  revision,
  availability,
  approvalStatus,
  publicationStatus,
  now = new Date(),
}: {
  revision: PublishedAccountListingRevisionSnapshotV1;
  availability: (typeof accountListingAvailabilities)[number];
  approvalStatus: (typeof accountListingApprovalStatuses)[number];
  publicationStatus: (typeof accountListingStatuses)[number];
  now?: Date;
}): AccountEstimateResult {
  const publishedRevision = normalizePublishedAccountListingRevision(revision);
  if (publishedRevision.listing.currencyCode !== SUPPORTED_CURRENCY) {
    throw new AccountMarketplaceValidationError(
      "Unsupported account listing currency.",
    );
  }
  assertSafeMoney(publishedRevision.listing.basePriceCents, "Listing price");
  const isApprovedPublished =
    approvalStatus === "APPROVED" && publicationStatus === "PUBLISHED";
  if (!isApprovedPublished) {
    throw new AccountMarketplaceValidationError(
      "This account listing is not approved and published.",
    );
  }
  if (availability !== "AVAILABLE") {
    throw new AccountMarketplaceValidationError(
      availabilityMessage(availability),
    );
  }

  const basePricingLines = [
    {
      label: "Account listing base price",
      amountCents: publishedRevision.listing.basePriceCents,
    },
  ];
  const coverImage =
    publishedRevision.images.find(
      (image) => image.imageType === "COVER" && image.assetPath,
    ) ?? publishedRevision.images[0];

  const snapshot = normalizeAccountListingSnapshot({
    schemaVersion: ACCOUNT_LISTING_SNAPSHOT_SCHEMA_VERSION,
    marketplace: {
      stableKey: publishedRevision.marketplace.stableKey,
      slug: publishedRevision.marketplace.slug,
      serviceId: publishedRevision.marketplace.serviceId,
      serviceSlug: publishedRevision.marketplace.serviceSlug,
      categoryId: publishedRevision.marketplace.categoryId,
      categorySlug: publishedRevision.marketplace.categorySlug,
    },
    listing: {
      stableKey: publishedRevision.listing.stableKey,
      slug: publishedRevision.listing.slug,
      publicTitle: publishedRevision.listing.publicTitle,
      gameMode: publishedRevision.listing.gameMode,
    },
    currency: publishedRevision.listing.currencyCode,
    basePriceCents: publishedRevision.listing.basePriceCents,
    basePricingLines,
    globalPricingAdjustmentLines: [],
    finalEstimatedTotalCents: publishedRevision.listing.basePriceCents,
    publishedListingRevision: {
      id: publishedRevision.revision.id,
      revisionNumber: publishedRevision.revision.revisionNumber,
    },
    publishedGlobalPricingRevision: null,
    availabilityState: availability,
    listingValidity: {
      approvalStatus,
      publicationStatus,
      isApprovedPublished,
    },
    selectedPublicStats: publishedRevision.stats,
    selectedPublicUnlockReferences: publishedRevision.unlocks.map(
      (unlock) => unlock.stableKey,
    ),
    selectedPublicFeatureReferences: publishedRevision.features.map(
      (feature) => feature.stableKey,
    ),
    coverImageReference: coverImage?.assetPath ?? null,
    generatedAt: now.toISOString(),
    repricingRequired: false,
    availabilityRecheckRequired: true,
  });

  return {
    currency: publishedRevision.listing.currencyCode,
    lineItems: basePricingLines,
    basePriceCents: publishedRevision.listing.basePriceCents,
    estimatedTotalCents: publishedRevision.listing.basePriceCents,
    estimatedTotal: formatCents(
      publishedRevision.listing.basePriceCents,
      publishedRevision.listing.currencyCode,
    ),
    availabilityState: availability,
    availabilityMessage: availabilityMessage(availability),
    finalPriceNote:
      "Final availability and price are rechecked by staff before checkout.",
    snapshot,
  };
}

export function withAccountGlobalPricing(
  estimate: AccountEstimateResult,
  pricing: {
    globalAdjustmentLines: PricingLine[];
    minimumMaximumAdjustmentLines: PricingLine[];
    estimatedTotalCents: number;
    estimatedTotal: string;
    pricingRevision: { id: string; revisionNumber: number } | null;
  },
) {
  const globalPricingAdjustmentLines = [
    ...pricing.globalAdjustmentLines,
    ...pricing.minimumMaximumAdjustmentLines,
  ];
  const snapshot = normalizeAccountListingSnapshot({
    ...estimate.snapshot,
    globalPricingAdjustmentLines,
    finalEstimatedTotalCents: pricing.estimatedTotalCents,
    publishedGlobalPricingRevision: pricing.pricingRevision,
  });
  return {
    ...estimate,
    lineItems: [
      ...estimate.lineItems,
      ...pricing.globalAdjustmentLines,
      ...pricing.minimumMaximumAdjustmentLines,
    ],
    estimatedTotalCents: pricing.estimatedTotalCents,
    estimatedTotal: pricing.estimatedTotal,
    snapshot,
  } satisfies AccountEstimateResult;
}

export function safeAccountJson<T>(value: T) {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    ),
  ) as T;
}

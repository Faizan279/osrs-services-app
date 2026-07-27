import "server-only";

import { randomBytes } from "node:crypto";

import { z, ZodError } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import {
  accountHandoverReadinessStates,
  accountImageTypes,
  accountListingAvailabilities,
  accountStatTypes,
  accountUnlockTypes,
} from "@/lib/accounts/constants";
import {
  AccountMarketplaceValidationError,
  accountListingRevisionSnapshot,
  normalizePublishedAccountListingRevision,
  safeAccountJson,
  type PublicAccountFeature,
  type PublicAccountImage,
  type PublicAccountStat,
  type PublicAccountUnlock,
} from "@/lib/accounts/estimate";
import { catalogueGameModes } from "@/lib/catalogue/constants";
import { prisma } from "@/lib/db/prisma";

export class AccountMarketplaceConflictError extends Error {}
export class AccountMarketplaceTransitionError extends Error {}

const credentialFieldPattern =
  /(password|login|credential|recovery|authenticator|token|cookie|bankpin|bank_pin|emailaddress|email_address)$/i;

const optionalText = (maximum: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text || null;
  }, z.string().max(maximum).nullable());

const optionalInteger = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text ? Number(text) : null;
}, z.number().int().min(0).max(100_000).nullable());

const safeSlug = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe slug.");

const safeKey = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Use a stable public key.");

const safeAssetPath = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(
    /^\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif|gif)$/i,
    "Use an approved repository-relative public image path.",
  )
  .refine((value) => !value.includes(".."), "Image paths cannot traverse.");

export const accountListingInputSchema = z.object({
  listingId: z.string().min(1).max(30).optional(),
  marketplaceId: z.string().min(1).max(30),
  publicTitle: z.string().trim().min(3).max(180),
  slug: safeSlug,
  shortDescription: z.string().trim().min(12).max(500),
  fullDescription: z.string().trim().min(20).max(50_000),
  internalReferenceCode: z.string().trim().min(3).max(120),
  currencyCode: z.literal("USD"),
  basePriceCents: z.coerce.number().int().min(1).max(100_000_000),
  gameMode: z.enum(catalogueGameModes),
  combatLevel: optionalInteger,
  totalLevel: optionalInteger,
  questPoints: optionalInteger,
  accountAgeLabel: optionalText(120),
  membershipStateLabel: optionalText(120),
  availability: z.enum(accountListingAvailabilities),
  isFeatured: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  publicBadgeText: optionalText(120),
  needsClientReview: z.boolean(),
});

export const accountStatInputSchema = z.object({
  listingId: z.string().min(1).max(30),
  statId: z.string().min(1).max(30).optional(),
  statKey: safeKey,
  publicLabel: z.string().trim().min(1).max(120),
  value: z.coerce.number().int().min(0).max(10_000),
  maximumValue: optionalInteger,
  statType: z.enum(accountStatTypes),
  statGroup: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  isPublic: z.boolean(),
  needsClientReview: z.boolean(),
});

export const accountUnlockInputSchema = z.object({
  listingId: z.string().min(1).max(30),
  unlockId: z.string().min(1).max(30).optional(),
  unlockKey: safeKey,
  publicLabel: z.string().trim().min(1).max(160),
  description: optionalText(20_000),
  unlockType: z.enum(accountUnlockTypes),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  isPublic: z.boolean(),
  filterable: z.boolean(),
  needsClientReview: z.boolean(),
});

export const accountFeatureInputSchema = z.object({
  listingId: z.string().min(1).max(30),
  featureId: z.string().min(1).max(30).optional(),
  featureKey: safeKey,
  publicLabel: z.string().trim().min(1).max(160),
  description: optionalText(20_000),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  isPublic: z.boolean(),
  filterable: z.boolean(),
  needsClientReview: z.boolean(),
});

export const accountImageInputSchema = z.object({
  listingId: z.string().min(1).max(30),
  imageId: z.string().min(1).max(30).optional(),
  imageType: z.enum(accountImageTypes),
  assetPath: safeAssetPath,
  altText: z.string().trim().min(3).max(240),
  caption: optionalText(240),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  isPublic: z.boolean(),
  needsClientReview: z.boolean(),
});

export const accountAvailabilityInputSchema = z.object({
  listingId: z.string().min(1).max(30),
  availability: z.enum(accountListingAvailabilities),
  reason: z.string().trim().min(3).max(240),
});

export const accountHoldInputSchema = z.object({
  listingId: z.string().min(1).max(30),
  expiresAt: z.coerce.date(),
  reason: z.string().trim().min(3).max(240),
});

export const accountHandoverInputSchema = z.object({
  listingId: z.string().min(1).max(30),
  listingSecurityReviewed: z.boolean(),
  emailTransferRequired: z.boolean(),
  recoveryReviewRequired: z.boolean(),
  authenticatorResetRequired: z.boolean(),
  bankPinResetRequired: z.boolean(),
  previousSessionsReviewRequired: z.boolean(),
  handoverInstructionsPrepared: z.boolean(),
  ownershipEvidenceReviewed: z.boolean(),
  readyForFutureHandover: z.boolean(),
  finalAdminApprovalRequired: z.boolean(),
  readiness: z.enum(accountHandoverReadinessStates),
  needsClientReview: z.boolean(),
});

type AccountListingInput = z.infer<typeof accountListingInputSchema>;
type AccountStatInput = z.infer<typeof accountStatInputSchema>;
type AccountUnlockInput = z.infer<typeof accountUnlockInputSchema>;
type AccountFeatureInput = z.infer<typeof accountFeatureInputSchema>;
type AccountImageInput = z.infer<typeof accountImageInputSchema>;
type AccountAvailabilityInput = z.infer<typeof accountAvailabilityInputSchema>;
type AccountHoldInput = z.infer<typeof accountHoldInputSchema>;
type AccountHandoverInput = z.infer<typeof accountHandoverInputSchema>;

function stableId() {
  return randomBytes(12).toString("hex");
}

function stableKey(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

function json(value: unknown) {
  return safeAccountJson(value) as Prisma.InputJsonValue;
}

function auditMetadata(value: Record<string, unknown>) {
  return json(value);
}

export function assertNoCredentialFields(record: Record<string, unknown>) {
  for (const key of Object.keys(record)) {
    if (credentialFieldPattern.test(key)) {
      throw new AccountMarketplaceValidationError(
        "Credential-like fields are not accepted for account listings.",
      );
    }
  }
}

export async function getAccountsAdminOverview() {
  const [marketplaces, listings, published, holds, review, flag, activity] =
    await Promise.all([
      prisma.accountMarketplace.count(),
      prisma.accountListing.count(),
      prisma.accountListing.count({
        where: { publicationStatus: "PUBLISHED" },
      }),
      prisma.accountListingHold.count({ where: { status: "ACTIVE" } }),
      prisma.accountListing.count({ where: { needsClientReview: true } }),
      prisma.featureFlag.findUnique({
        where: { key: "account_marketplace_enabled" },
        select: { enabled: true },
      }),
      prisma.auditLog.findMany({
        where: { action: { startsWith: "accounts." } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true, email: true } } },
      }),
    ]);
  return {
    marketplaces,
    listings,
    published,
    activeHolds: holds,
    needsReview: review,
    accountMarketplaceEnabled: Boolean(flag?.enabled),
    activity,
  };
}

export async function getAccountMarketplaceAdmin() {
  return prisma.accountMarketplace.findFirst({
    include: { service: { include: { category: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAccountAdminListings() {
  return prisma.accountListing.findMany({
    orderBy: [{ updatedAt: "desc" }, { publicTitle: "asc" }],
    include: {
      marketplace: { select: { publicName: true } },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        take: 1,
      },
      holds: {
        where: { status: "ACTIVE" },
        orderBy: { expiresAt: "asc" },
        take: 1,
      },
    },
  });
}

export async function getAccountListingAdmin(listingId: string) {
  return prisma.accountListing.findUnique({
    where: { id: listingId },
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      stats: { orderBy: [{ sortOrder: "asc" }, { publicLabel: "asc" }] },
      unlocks: { orderBy: [{ sortOrder: "asc" }, { publicLabel: "asc" }] },
      features: { orderBy: [{ sortOrder: "asc" }, { publicLabel: "asc" }] },
      images: { orderBy: [{ imageType: "asc" }, { sortOrder: "asc" }] },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        include: { publishedBy: { select: { name: true, email: true } } },
      },
      holds: {
        orderBy: [{ createdAt: "desc" }],
        include: {
          createdBy: { select: { name: true, email: true } },
          releasedBy: { select: { name: true, email: true } },
        },
      },
      handoverChecklist: true,
    },
  });
}

async function latestRevisionNumber(
  transaction: Prisma.TransactionClient,
  listingId: string,
) {
  const latest = await transaction.accountListingRevision.findFirst({
    where: { listingId },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });
  return latest?.revisionNumber ?? 0;
}

export async function saveAccountListing({
  input,
  actorId,
  expectedVersion,
}: {
  input: AccountListingInput;
  actorId: string;
  expectedVersion?: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const data = {
      marketplaceId: input.marketplaceId,
      publicTitle: input.publicTitle,
      slug: input.slug,
      shortDescription: input.shortDescription,
      fullDescription: input.fullDescription,
      internalReferenceCode: input.internalReferenceCode,
      currencyCode: input.currencyCode,
      basePriceCents: input.basePriceCents,
      gameMode: input.gameMode,
      combatLevel: input.combatLevel,
      totalLevel: input.totalLevel,
      questPoints: input.questPoints,
      accountAgeLabel: input.accountAgeLabel,
      membershipStateLabel: input.membershipStateLabel,
      availability: input.availability,
      isFeatured: input.isFeatured,
      sortOrder: input.sortOrder,
      publicBadgeText: input.publicBadgeText,
      needsClientReview: input.needsClientReview,
    };
    let listingId = input.listingId;
    if (listingId) {
      const updated = await transaction.accountListing.updateMany({
        where: { id: listingId, concurrencyVersion: expectedVersion },
        data: { ...data, concurrencyVersion: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new AccountMarketplaceConflictError(
          "This listing changed after the editor opened. Reload before saving.",
        );
      }
    } else {
      const created = await transaction.accountListing.create({
        data: {
          id: stableId(),
          stableKey: stableKey("acct-listing"),
          ...data,
          publicationStatus: "DRAFT",
          approvalStatus: "PENDING_REVIEW",
          handoverChecklist: { create: { id: stableId() } },
        },
        select: { id: true },
      });
      listingId = created.id;
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: input.listingId
          ? "accounts.listing.updated"
          : "accounts.listing.created",
        targetType: "AccountListing",
        targetId: listingId,
        metadata: auditMetadata({
          marketplaceId: input.marketplaceId,
          availability: input.availability,
          needsClientReview: input.needsClientReview,
        }),
      },
    });
    return { id: listingId! };
  });
}

export async function saveAccountStat({
  input,
  actorId,
  expectedVersion,
}: {
  input: AccountStatInput;
  actorId: string;
  expectedVersion?: number;
}) {
  return saveChild({
    model: "accountListingStat",
    kind: "stat",
    actionBase: "accounts.stat",
    input,
    actorId,
    expectedVersion,
    idKey: "statId",
    keyField: "statKey",
    data: {
      listingId: input.listingId,
      statKey: input.statKey,
      publicLabel: input.publicLabel,
      value: input.value,
      maximumValue: input.maximumValue,
      statType: input.statType,
      statGroup: input.statGroup,
      sortOrder: input.sortOrder,
      isPublic: input.isPublic,
      needsClientReview: input.needsClientReview,
    },
  });
}

export async function saveAccountUnlock({
  input,
  actorId,
  expectedVersion,
}: {
  input: AccountUnlockInput;
  actorId: string;
  expectedVersion?: number;
}) {
  return saveChild({
    model: "accountListingUnlock",
    kind: "unlock",
    actionBase: "accounts.unlock",
    input,
    actorId,
    expectedVersion,
    idKey: "unlockId",
    keyField: "unlockKey",
    data: {
      listingId: input.listingId,
      unlockKey: input.unlockKey,
      publicLabel: input.publicLabel,
      description: input.description,
      unlockType: input.unlockType,
      sortOrder: input.sortOrder,
      isPublic: input.isPublic,
      filterable: input.filterable,
      needsClientReview: input.needsClientReview,
    },
  });
}

export async function saveAccountFeature({
  input,
  actorId,
  expectedVersion,
}: {
  input: AccountFeatureInput;
  actorId: string;
  expectedVersion?: number;
}) {
  return saveChild({
    model: "accountListingFeature",
    kind: "feature",
    actionBase: "accounts.feature",
    input,
    actorId,
    expectedVersion,
    idKey: "featureId",
    keyField: "featureKey",
    data: {
      listingId: input.listingId,
      featureKey: input.featureKey,
      publicLabel: input.publicLabel,
      description: input.description,
      sortOrder: input.sortOrder,
      isPublic: input.isPublic,
      filterable: input.filterable,
      needsClientReview: input.needsClientReview,
    },
  });
}

export async function saveAccountImage({
  input,
  actorId,
  expectedVersion,
}: {
  input: AccountImageInput;
  actorId: string;
  expectedVersion?: number;
}) {
  return saveChild({
    model: "accountListingImage",
    kind: "image",
    actionBase: "accounts.image",
    input,
    actorId,
    expectedVersion,
    idKey: "imageId",
    keyField: "assetPath",
    data: {
      listingId: input.listingId,
      imageType: input.imageType,
      assetPath: input.assetPath,
      altText: input.altText,
      caption: input.caption,
      sortOrder: input.sortOrder,
      isPublic: input.isPublic,
      needsClientReview: input.needsClientReview,
    },
  });
}

async function saveChild({
  model,
  kind,
  actionBase,
  input,
  actorId,
  expectedVersion,
  idKey,
  keyField,
  data,
}: {
  model:
    | "accountListingStat"
    | "accountListingUnlock"
    | "accountListingFeature"
    | "accountListingImage";
  kind: string;
  actionBase: string;
  input: Record<string, unknown> & { listingId: string };
  actorId: string;
  expectedVersion?: number;
  idKey: string;
  keyField: string;
  data: Record<string, unknown>;
}) {
  return prisma.$transaction(async (transaction) => {
    const delegate = transaction[model] as unknown as {
      updateMany(args: unknown): Promise<{ count: number }>;
      create(args: {
        data: Record<string, unknown>;
        select: { id: true };
      }): Promise<{ id: string }>;
    };
    const existingId = input[idKey] as string | undefined;
    let id = existingId;
    if (existingId) {
      const updated = await delegate.updateMany({
        where: {
          id: existingId,
          listingId: input.listingId,
          concurrencyVersion: expectedVersion,
        },
        data: { ...data, concurrencyVersion: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new AccountMarketplaceConflictError(
          `This ${kind} changed after the editor opened. Reload before saving.`,
        );
      }
    } else {
      const created = await delegate.create({
        data: {
          id: stableId(),
          stableKey: stableKey(`acct-${kind}`),
          ...data,
        },
        select: { id: true },
      });
      id = created.id;
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: `${actionBase}.${existingId ? "updated" : "created"}`,
        targetType: "AccountListing",
        targetId: input.listingId,
        metadata: auditMetadata({
          id,
          key: input[keyField] ?? null,
        }),
      },
    });
    return { id: id! };
  });
}

export async function approveAccountListing({
  listingId,
  actorId,
  expectedVersion,
}: {
  listingId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return setApproval({
    listingId,
    actorId,
    expectedVersion,
    approvalStatus: "APPROVED",
    rejectionReason: null,
  });
}

export async function rejectAccountListing({
  listingId,
  actorId,
  expectedVersion,
  reason,
}: {
  listingId: string;
  actorId: string;
  expectedVersion: number;
  reason: string;
}) {
  return setApproval({
    listingId,
    actorId,
    expectedVersion,
    approvalStatus: "REJECTED",
    rejectionReason: reason.slice(0, 20_000),
  });
}

async function setApproval({
  listingId,
  actorId,
  expectedVersion,
  approvalStatus,
  rejectionReason,
}: {
  listingId: string;
  actorId: string;
  expectedVersion: number;
  approvalStatus: "APPROVED" | "REJECTED";
  rejectionReason: string | null;
}) {
  const updated = await prisma.accountListing.updateMany({
    where: { id: listingId, concurrencyVersion: expectedVersion },
    data: {
      approvalStatus,
      rejectionReason,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new AccountMarketplaceConflictError(
      "This listing changed after the review page loaded. Reload before continuing.",
    );
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action:
        approvalStatus === "APPROVED"
          ? "accounts.listing.approved"
          : "accounts.listing.rejected",
      targetType: "AccountListing",
      targetId: listingId,
      metadata: auditMetadata({ approvalStatus }),
    },
  });
}

async function snapshotFromListing({
  transaction,
  listingId,
  revisionId,
  revisionNumber,
  publishedAt,
}: {
  transaction: Prisma.TransactionClient;
  listingId: string;
  revisionId: string;
  revisionNumber: number;
  publishedAt: Date;
}) {
  const listing = await transaction.accountListing.findUniqueOrThrow({
    where: { id: listingId },
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      stats: { where: { isPublic: true }, orderBy: [{ sortOrder: "asc" }] },
      unlocks: {
        where: { isPublic: true },
        orderBy: [{ sortOrder: "asc" }],
      },
      features: {
        where: { isPublic: true },
        orderBy: [{ sortOrder: "asc" }],
      },
      images: {
        where: { isPublic: true },
        orderBy: [{ imageType: "asc" }, { sortOrder: "asc" }],
      },
      handoverChecklist: true,
    },
  });
  if (listing.approvalStatus !== "APPROVED") {
    throw new AccountMarketplaceTransitionError(
      "Approve the listing before publishing.",
    );
  }
  if (listing.basePriceCents <= 0 || listing.currencyCode !== "USD") {
    throw new AccountMarketplaceTransitionError(
      "A valid USD price is required before publishing.",
    );
  }
  return accountListingRevisionSnapshot({
    marketplace: {
      id: listing.marketplace.id,
      stableKey: listing.marketplace.stableKey,
      slug: listing.marketplace.slug,
      serviceId: listing.marketplace.serviceId,
      serviceSlug: listing.marketplace.service.slug,
      categoryId: listing.marketplace.service.categoryId,
      categorySlug: listing.marketplace.service.category.slug,
      publicName: listing.marketplace.publicName,
      currencyCode: listing.marketplace.currencyCode,
    },
    listing: {
      id: listing.id,
      stableKey: listing.stableKey,
      slug: listing.slug,
      publicTitle: listing.publicTitle,
      shortDescription: listing.shortDescription,
      fullDescription: listing.fullDescription,
      gameMode: listing.gameMode,
      currencyCode: listing.currencyCode,
      basePriceCents: listing.basePriceCents,
      combatLevel: listing.combatLevel,
      totalLevel: listing.totalLevel,
      questPoints: listing.questPoints,
      accountAgeLabel: listing.accountAgeLabel,
      membershipStateLabel: listing.membershipStateLabel,
      publicBadgeText: listing.publicBadgeText,
      secureHandoverLabel:
        listing.handoverChecklist?.readyForFutureHandover === true
          ? "Secure handover process available"
          : "Secure handover process reviewed by support",
    },
    revisionId,
    revisionNumber,
    publishedAt,
    stats: listing.stats.map((stat) => ({
      stableKey: stat.stableKey,
      statKey: stat.statKey,
      publicLabel: stat.publicLabel,
      value: stat.value,
      maximumValue: stat.maximumValue,
      statGroup: stat.statGroup,
      sortOrder: stat.sortOrder,
    })) satisfies PublicAccountStat[],
    unlocks: listing.unlocks.map((unlock) => ({
      stableKey: unlock.stableKey,
      unlockKey: unlock.unlockKey,
      publicLabel: unlock.publicLabel,
      description: unlock.description,
      unlockType: unlock.unlockType,
      sortOrder: unlock.sortOrder,
    })) satisfies PublicAccountUnlock[],
    features: listing.features.map((feature) => ({
      stableKey: feature.stableKey,
      featureKey: feature.featureKey,
      publicLabel: feature.publicLabel,
      description: feature.description,
      sortOrder: feature.sortOrder,
    })) satisfies PublicAccountFeature[],
    images: listing.images.map((image) => ({
      stableKey: image.stableKey,
      imageType: image.imageType,
      assetPath: image.assetPath,
      altText: image.altText,
      caption: image.caption,
      sortOrder: image.sortOrder,
    })) satisfies PublicAccountImage[],
  });
}

export async function publishAccountListing({
  listingId,
  actorId,
  expectedVersion,
}: {
  listingId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.accountListing.updateMany({
      where: {
        id: listingId,
        concurrencyVersion: expectedVersion,
        approvalStatus: "APPROVED",
      },
      data: {
        publicationStatus: "PUBLISHED",
        publishedAt: new Date(),
        archivedAt: null,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      throw new AccountMarketplaceConflictError(
        "The listing changed or is not approved. Reload before publishing.",
      );
    }
    const revisionId = stableId();
    const revisionNumber =
      (await latestRevisionNumber(transaction, listingId)) + 1;
    const publishedAt = new Date();
    const snapshot = await snapshotFromListing({
      transaction,
      listingId,
      revisionId,
      revisionNumber,
      publishedAt,
    });
    await transaction.accountListingRevision.create({
      data: {
        id: revisionId,
        listingId,
        revisionNumber,
        snapshotSchemaVersion: 1,
        snapshot: json(snapshot),
        publishedAt,
        publishedById: actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "accounts.listing.published",
        targetType: "AccountListing",
        targetId: listingId,
        metadata: auditMetadata({ revisionId, revisionNumber }),
      },
    });
    return { revisionId, revisionNumber };
  });
}

async function replaceDraftFromRevision({
  transaction,
  listingId,
  revisionId,
}: {
  transaction: Prisma.TransactionClient;
  listingId: string;
  revisionId?: string;
}) {
  const revision = revisionId
    ? await transaction.accountListingRevision.findFirst({
        where: { id: revisionId, listingId },
        select: { snapshot: true },
      })
    : await transaction.accountListingRevision.findFirst({
        where: { listingId },
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        select: { snapshot: true },
      });
  if (!revision) {
    throw new AccountMarketplaceTransitionError(
      "No published listing revision is available.",
    );
  }
  const snapshot = normalizePublishedAccountListingRevision(revision.snapshot);
  await transaction.accountListing.update({
    where: { id: listingId },
    data: {
      publicTitle: snapshot.listing.publicTitle,
      slug: snapshot.listing.slug,
      shortDescription: snapshot.listing.shortDescription,
      fullDescription: snapshot.listing.fullDescription,
      currencyCode: snapshot.listing.currencyCode,
      basePriceCents: snapshot.listing.basePriceCents,
      gameMode: snapshot.listing.gameMode,
      combatLevel: snapshot.listing.combatLevel,
      totalLevel: snapshot.listing.totalLevel,
      questPoints: snapshot.listing.questPoints,
      accountAgeLabel: snapshot.listing.accountAgeLabel,
      membershipStateLabel: snapshot.listing.membershipStateLabel,
      publicBadgeText: snapshot.listing.publicBadgeText,
      concurrencyVersion: { increment: 1 },
    },
  });
  await transaction.accountListingStat.deleteMany({ where: { listingId } });
  await transaction.accountListingUnlock.deleteMany({ where: { listingId } });
  await transaction.accountListingFeature.deleteMany({ where: { listingId } });
  await transaction.accountListingImage.deleteMany({ where: { listingId } });
  if (snapshot.stats.length) {
    await transaction.accountListingStat.createMany({
      data: snapshot.stats.map((stat) => ({
        id: stableId(),
        stableKey: stat.stableKey,
        listingId,
        statKey: stat.statKey,
        publicLabel: stat.publicLabel,
        value: stat.value,
        maximumValue: stat.maximumValue,
        statGroup: stat.statGroup,
        sortOrder: stat.sortOrder,
        isPublic: true,
        needsClientReview: true,
      })),
    });
  }
  if (snapshot.unlocks.length) {
    await transaction.accountListingUnlock.createMany({
      data: snapshot.unlocks.map((unlock) => ({
        id: stableId(),
        stableKey: unlock.stableKey,
        listingId,
        unlockKey: unlock.unlockKey,
        publicLabel: unlock.publicLabel,
        description: unlock.description,
        unlockType: unlock.unlockType as never,
        sortOrder: unlock.sortOrder,
        isPublic: true,
        filterable: true,
        needsClientReview: true,
      })),
    });
  }
  if (snapshot.features.length) {
    await transaction.accountListingFeature.createMany({
      data: snapshot.features.map((feature) => ({
        id: stableId(),
        stableKey: feature.stableKey,
        listingId,
        featureKey: feature.featureKey,
        publicLabel: feature.publicLabel,
        description: feature.description,
        sortOrder: feature.sortOrder,
        isPublic: true,
        filterable: true,
        needsClientReview: true,
      })),
    });
  }
  if (snapshot.images.length) {
    await transaction.accountListingImage.createMany({
      data: snapshot.images.map((image) => ({
        id: stableId(),
        stableKey: image.stableKey,
        listingId,
        imageType: image.imageType as never,
        assetPath: image.assetPath,
        altText: image.altText,
        caption: image.caption,
        sortOrder: image.sortOrder,
        isPublic: true,
        needsClientReview: true,
      })),
    });
  }
}

export async function discardAccountListingDraft({
  listingId,
  actorId,
  expectedVersion,
}: {
  listingId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.accountListing.updateMany({
      where: { id: listingId, concurrencyVersion: expectedVersion },
      data: { concurrencyVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw new AccountMarketplaceConflictError(
        "The listing changed after this page loaded. Reload before discarding.",
      );
    }
    await replaceDraftFromRevision({ transaction, listingId });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "accounts.listing.draft_discarded",
        targetType: "AccountListing",
        targetId: listingId,
        metadata: auditMetadata({ restoredLatestRevision: true }),
      },
    });
  });
}

export async function restoreAccountListingRevision({
  listingId,
  revisionId,
  actorId,
  expectedVersion,
}: {
  listingId: string;
  revisionId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.accountListing.updateMany({
      where: { id: listingId, concurrencyVersion: expectedVersion },
      data: { concurrencyVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw new AccountMarketplaceConflictError(
        "The listing changed after this page loaded. Reload before restoring.",
      );
    }
    await replaceDraftFromRevision({ transaction, listingId, revisionId });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "accounts.listing.revision_restored",
        targetType: "AccountListingRevision",
        targetId: revisionId,
        metadata: auditMetadata({ listingId }),
      },
    });
  });
}

export async function changeAccountAvailability({
  input,
  actorId,
  expectedVersion,
}: {
  input: AccountAvailabilityInput;
  actorId: string;
  expectedVersion: number;
}) {
  const updated = await prisma.accountListing.updateMany({
    where: { id: input.listingId, concurrencyVersion: expectedVersion },
    data: {
      availability: input.availability,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new AccountMarketplaceConflictError(
      "Availability changed after the page loaded. Reload before continuing.",
    );
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "accounts.availability.changed",
      targetType: "AccountListing",
      targetId: input.listingId,
      metadata: auditMetadata({
        availability: input.availability,
        reason: input.reason,
      }),
    },
  });
}

export async function createAccountHold({
  input,
  actorId,
  expectedVersion,
  now = new Date(),
}: {
  input: AccountHoldInput;
  actorId: string;
  expectedVersion: number;
  now?: Date;
}) {
  return prisma.$transaction(async (transaction) => {
    if (input.expiresAt <= now) {
      throw new AccountMarketplaceTransitionError(
        "Hold expiry must be in the future.",
      );
    }
    const existing = await transaction.accountListingHold.findFirst({
      where: { listingId: input.listingId, status: "ACTIVE" },
      select: { id: true },
    });
    if (existing) {
      throw new AccountMarketplaceTransitionError(
        "This listing already has an active hold.",
      );
    }
    const listing = await transaction.accountListing.findUnique({
      where: { id: input.listingId },
      select: { availability: true },
    });
    if (!listing || listing.availability !== "AVAILABLE") {
      throw new AccountMarketplaceTransitionError(
        "Only available listings can be held.",
      );
    }
    const updated = await transaction.accountListing.updateMany({
      where: {
        id: input.listingId,
        availability: "AVAILABLE",
        concurrencyVersion: expectedVersion,
      },
      data: {
        availability: "HELD",
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new AccountMarketplaceConflictError(
        "The listing changed before the hold could be created.",
      );
    }
    const hold = await transaction.accountListingHold.create({
      data: {
        id: stableId(),
        stableKey: stableKey("acct-hold"),
        listingId: input.listingId,
        status: "ACTIVE",
        previousAvailability: "AVAILABLE",
        startsAt: now,
        expiresAt: input.expiresAt,
        reason: input.reason,
        createdById: actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "accounts.hold.created",
        targetType: "AccountListing",
        targetId: input.listingId,
        metadata: auditMetadata({
          holdId: hold.id,
          expiresAt: input.expiresAt.toISOString(),
        }),
      },
    });
    return hold;
  });
}

export async function releaseAccountHold({
  holdId,
  listingId,
  actorId,
  expectedHoldVersion,
  now = new Date(),
}: {
  holdId: string;
  listingId: string;
  actorId: string;
  expectedHoldVersion: number;
  now?: Date;
}) {
  return prisma.$transaction(async (transaction) => {
    const hold = await transaction.accountListingHold.findFirst({
      where: {
        id: holdId,
        listingId,
        status: "ACTIVE",
        concurrencyVersion: expectedHoldVersion,
      },
    });
    if (!hold) {
      throw new AccountMarketplaceConflictError(
        "The hold changed after the page loaded. Reload before releasing.",
      );
    }
    await transaction.accountListingHold.update({
      where: { id: holdId },
      data: {
        status: "RELEASED",
        releasedAt: now,
        releasedById: actorId,
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.accountListing.updateMany({
      where: { id: listingId, availability: "HELD" },
      data: { availability: hold.previousAvailability },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "accounts.hold.released",
        targetType: "AccountListingHold",
        targetId: holdId,
        metadata: auditMetadata({ listingId }),
      },
    });
  });
}

export async function expireAccountHolds({
  actorId,
  now = new Date(),
}: {
  actorId: string;
  now?: Date;
}) {
  const holds = await prisma.accountListingHold.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
  });
  for (const hold of holds) {
    await prisma.$transaction(async (transaction) => {
      await transaction.accountListingHold.updateMany({
        where: { id: hold.id, status: "ACTIVE" },
        data: {
          status: "EXPIRED",
          releasedAt: now,
          releasedById: actorId,
          concurrencyVersion: { increment: 1 },
        },
      });
      await transaction.accountListing.updateMany({
        where: { id: hold.listingId, availability: "HELD" },
        data: { availability: hold.previousAvailability },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "accounts.hold.expired",
          targetType: "AccountListingHold",
          targetId: hold.id,
          metadata: auditMetadata({ listingId: hold.listingId }),
        },
      });
    });
  }
  return holds.length;
}

export async function markAccountListingSold({
  listingId,
  actorId,
  expectedVersion,
}: {
  listingId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.accountListing.updateMany({
      where: { id: listingId, concurrencyVersion: expectedVersion },
      data: {
        availability: "SOLD",
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new AccountMarketplaceConflictError(
        "The listing changed after the page loaded. Reload before marking sold.",
      );
    }
    await transaction.accountListingHold.updateMany({
      where: { listingId, status: "ACTIVE" },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
        releasedById: actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "accounts.listing.marked_sold",
        targetType: "AccountListing",
        targetId: listingId,
        metadata: auditMetadata({
          noOrderCreated: true,
          noPaymentCreated: true,
        }),
      },
    });
  });
}

export async function reopenAccountListing({
  listingId,
  actorId,
  expectedVersion,
}: {
  listingId: string;
  actorId: string;
  expectedVersion: number;
}) {
  const updated = await prisma.accountListing.updateMany({
    where: {
      id: listingId,
      availability: "SOLD",
      concurrencyVersion: expectedVersion,
    },
    data: {
      availability: "AVAILABLE",
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new AccountMarketplaceConflictError(
      "Only a currently sold listing can be reopened with this action.",
    );
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "accounts.listing.reopened",
      targetType: "AccountListing",
      targetId: listingId,
      metadata: auditMetadata({ privilegedAction: true }),
    },
  });
}

export async function updateAccountHandoverChecklist({
  input,
  actorId,
  expectedVersion,
}: {
  input: AccountHandoverInput;
  actorId: string;
  expectedVersion: number;
}) {
  const updated = await prisma.accountListingHandoverChecklist.updateMany({
    where: { listingId: input.listingId, concurrencyVersion: expectedVersion },
    data: {
      listingSecurityReviewed: input.listingSecurityReviewed,
      emailTransferRequired: input.emailTransferRequired,
      recoveryReviewRequired: input.recoveryReviewRequired,
      authenticatorResetRequired: input.authenticatorResetRequired,
      bankPinResetRequired: input.bankPinResetRequired,
      previousSessionsReviewRequired: input.previousSessionsReviewRequired,
      handoverInstructionsPrepared: input.handoverInstructionsPrepared,
      ownershipEvidenceReviewed: input.ownershipEvidenceReviewed,
      readyForFutureHandover: input.readyForFutureHandover,
      finalAdminApprovalRequired: input.finalAdminApprovalRequired,
      readiness: input.readiness,
      needsClientReview: input.needsClientReview,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new AccountMarketplaceConflictError(
      "The handover checklist changed after this page loaded. Reload before saving.",
    );
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "accounts.handover.updated",
      targetType: "AccountListing",
      targetId: input.listingId,
      metadata: auditMetadata({
        readiness: input.readiness,
        readyForFutureHandover: input.readyForFutureHandover,
      }),
    },
  });
}

export function accountActionErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the submitted values.";
  }
  if (
    error instanceof AccountMarketplaceConflictError ||
    error instanceof AccountMarketplaceTransitionError ||
    error instanceof AccountMarketplaceValidationError
  ) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "P2002")
      return "That account marketplace record already exists.";
    if (code === "P2003") {
      return "This account marketplace record is still referenced and cannot be removed.";
    }
    if (code === "P2025")
      return "This account marketplace record no longer exists.";
  }
  console.error("[accounts:action]", {
    errorName: error instanceof Error ? error.name : typeof error,
  });
  return "The account marketplace action could not be completed. Please try again.";
}

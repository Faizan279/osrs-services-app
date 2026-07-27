import "server-only";

import { randomBytes } from "node:crypto";

import { z, ZodError } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  goldAvailabilityStates,
  goldInventoryEntryTypes,
  goldSecureServicePricingModes,
  goldTradeDirections,
} from "@/lib/gold/constants";
import {
  GoldValidationError,
  goldRateRevisionSnapshot,
  normalizePublishedGoldRateRevision,
  parseGoldQuantity,
  safeGoldJson,
  type GoldMarketEstimateConfig,
  type GoldRateConfig,
} from "@/lib/gold/estimate";

export class GoldConflictError extends Error {}
export class GoldTransitionError extends Error {}

const optionalText = (maximum: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text || null;
  }, z.string().max(maximum).nullable());

const dateInput = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text ? new Date(text) : null;
}, z.date().nullable());

const positiveQuantityInput = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((value, context) => {
    try {
      return parseGoldQuantity(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof GoldValidationError
            ? error.message
            : "Quantity is invalid.",
      });
      return z.NEVER;
    }
  });

const bpsInput = z.coerce.number().int().min(0).max(100_000);
const minorUnitsInput = z.coerce.number().int().min(0).max(100_000_000);

export const goldMarketInputSchema = z
  .object({
    marketId: z.string().min(1).max(30),
    publicName: z.string().trim().min(2).max(160),
    description: z.string().trim().min(20).max(50_000),
    availabilityState: z.enum(goldAvailabilityStates),
    publicTradeInstructions: z.string().trim().min(20).max(50_000),
    internalInstructions: optionalText(50_000),
    rsnRequired: z.boolean(),
    secureServiceEnabled: z.boolean(),
    secureServicePricingMode: z.enum(goldSecureServicePricingModes),
    secureServiceFixedMinorUnits: minorUnitsInput,
    secureServiceBps: bpsInput,
    secureServiceCustomerBuys: z.boolean(),
    secureServiceCustomerSells: z.boolean(),
    quoteValidityMinutes: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 60),
    needsClientReview: z.boolean(),
  })
  .superRefine((input, context) => {
    if (
      input.secureServiceEnabled &&
      input.secureServicePricingMode === "FIXED_MINOR_UNITS" &&
      input.secureServiceFixedMinorUnits <= 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["secureServiceFixedMinorUnits"],
        message: "Fixed secure-service pricing needs a positive amount.",
      });
    }
    if (
      input.secureServiceEnabled &&
      input.secureServicePricingMode === "BASIS_POINTS" &&
      input.secureServiceBps <= 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["secureServiceBps"],
        message:
          "Percentage secure-service pricing needs positive basis points.",
      });
    }
  });

export const goldRateInputSchema = z
  .object({
    marketId: z.string().min(1).max(30),
    direction: z.enum(goldTradeDirections),
    rateMinorUnitsPerMillion: z.coerce.number().int().min(1).max(100_000_000),
    minimumQuantity: positiveQuantityInput,
    maximumQuantity: positiveQuantityInput,
    automaticReviewMaximum: positiveQuantityInput,
    effectiveStart: dateInput,
    effectiveEnd: dateInput,
    enabled: z.boolean(),
    needsClientReview: z.boolean(),
  })
  .superRefine((input, context) => {
    if (!input.effectiveStart) {
      context.addIssue({
        code: "custom",
        path: ["effectiveStart"],
        message: "Effective start is required.",
      });
    }
    if (input.maximumQuantity < input.minimumQuantity) {
      context.addIssue({
        code: "custom",
        path: ["maximumQuantity"],
        message: "Maximum quantity cannot be lower than minimum quantity.",
      });
    }
    if (
      input.automaticReviewMaximum < input.minimumQuantity ||
      input.automaticReviewMaximum > input.maximumQuantity
    ) {
      context.addIssue({
        code: "custom",
        path: ["automaticReviewMaximum"],
        message: "Automatic-review maximum must fit inside rate limits.",
      });
    }
    if (
      input.effectiveStart &&
      input.effectiveEnd &&
      input.effectiveEnd <= input.effectiveStart
    ) {
      context.addIssue({
        code: "custom",
        path: ["effectiveEnd"],
        message: "Effective end must be later than effective start.",
      });
    }
  });

export const goldPresetInputSchema = z.object({
  marketId: z.string().min(1).max(30),
  direction: z.enum(goldTradeDirections),
  publicLabel: z.string().trim().min(1).max(80),
  quantity: positiveQuantityInput,
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  enabled: z.boolean(),
  needsClientReview: z.boolean(),
});

export const goldInventoryAdjustmentInputSchema = z.object({
  marketId: z.string().min(1).max(30),
  entryType: z.enum(goldInventoryEntryTypes),
  quantity: positiveQuantityInput,
  reason: z.string().trim().min(3).max(240),
  internalNote: optionalText(20_000),
  referenceKey: optionalText(160),
});

type GoldMarketInput = z.infer<typeof goldMarketInputSchema>;
type GoldRateInput = z.infer<typeof goldRateInputSchema>;
type GoldPresetInput = z.infer<typeof goldPresetInputSchema>;
type GoldInventoryAdjustmentInput = z.infer<
  typeof goldInventoryAdjustmentInputSchema
>;

function stableId() {
  return randomBytes(12).toString("hex");
}

function auditMetadata(value: Record<string, unknown>) {
  return safeGoldJson(value) as Prisma.InputJsonValue;
}

function jsonSnapshot(value: unknown) {
  return safeGoldJson(value) as Prisma.InputJsonValue;
}

function marketEstimateConfig(
  market: Prisma.GoldMarketGetPayload<{
    include: { service: { include: { category: true } } };
  }>,
): GoldMarketEstimateConfig {
  return {
    id: market.id,
    stableKey: market.stableKey,
    serviceId: market.serviceId,
    serviceSlug: market.service.slug,
    categoryId: market.service.categoryId,
    categorySlug: market.service.category.slug,
    publicName: market.publicName,
    slug: market.slug,
    currencyCode: market.currencyCode,
    availabilityState: market.availabilityState,
    publicTradeInstructions: market.publicTradeInstructions,
    rsnRequired: market.rsnRequired,
    secureServiceEnabled: market.secureServiceEnabled,
    secureServicePricingMode: market.secureServicePricingMode,
    secureServiceFixedMinorUnits: market.secureServiceFixedMinorUnits,
    secureServiceBps: market.secureServiceBps,
    secureServiceCustomerBuys: market.secureServiceCustomerBuys,
    secureServiceCustomerSells: market.secureServiceCustomerSells,
    quoteValidityMinutes: market.quoteValidityMinutes,
    stockQuantityGp: market.stockQuantityGp.toString(),
    buyingCapacityGp: market.buyingCapacityGp.toString(),
  };
}

function rateConfig(rate: {
  direction: GoldRateInput["direction"];
  rateMinorUnitsPerMillion: number;
  minimumQuantityGp: bigint;
  maximumQuantityGp: bigint;
  automaticReviewMaximumGp: bigint;
  effectiveStart: Date;
  effectiveEnd: Date | null;
  enabled: boolean;
}): GoldRateConfig {
  return {
    direction: rate.direction,
    rateMinorUnitsPerMillion: rate.rateMinorUnitsPerMillion,
    minimumQuantityGp: rate.minimumQuantityGp.toString(),
    maximumQuantityGp: rate.maximumQuantityGp.toString(),
    automaticReviewMaximumGp: rate.automaticReviewMaximumGp.toString(),
    effectiveStart: rate.effectiveStart.toISOString(),
    effectiveEnd: rate.effectiveEnd?.toISOString() ?? null,
    enabled: rate.enabled,
  };
}

export async function ensureDraftGoldRateSet(
  transaction: Prisma.TransactionClient,
  marketId: string,
) {
  const existing = await transaction.goldRateSet.findFirst({
    where: { marketId, status: "DRAFT" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return transaction.goldRateSet.create({
    data: {
      marketId,
      status: "DRAFT",
      internalNotes:
        "Seed-safe draft created because the gold rate draft was missing.",
      needsClientReview: true,
    },
  });
}

async function claimRateDraft(
  transaction: Prisma.TransactionClient,
  marketId: string,
  expectedVersion: number,
  data: Prisma.GoldRateSetUncheckedUpdateManyInput = {},
) {
  const draft = await ensureDraftGoldRateSet(transaction, marketId);
  const claimed = await transaction.goldRateSet.updateMany({
    where: {
      id: draft.id,
      marketId,
      status: "DRAFT",
      concurrencyVersion: expectedVersion,
    },
    data: {
      ...data,
      concurrencyVersion: { increment: 1 },
      version: { increment: 1 },
    },
  });
  if (claimed.count !== 1) {
    throw new GoldConflictError(
      "The gold draft changed after this page loaded. Reload before continuing.",
    );
  }
  return { ...draft, concurrencyVersion: expectedVersion + 1 };
}

async function latestRevisionNumber(
  transaction: Prisma.TransactionClient,
  marketId: string,
) {
  const latest = await transaction.goldRateRevision.findFirst({
    where: { marketId },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });
  return latest?.revisionNumber ?? 0;
}

export async function getGoldAdminOverview() {
  const [
    markets,
    draftRateSets,
    publishedRevisions,
    ledgerEntries,
    flag,
    activity,
  ] = await Promise.all([
    prisma.goldMarket.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { service: { include: { category: true } } },
    }),
    prisma.goldRateSet.count({ where: { status: "DRAFT" } }),
    prisma.goldRateRevision.count(),
    prisma.goldInventoryLedgerEntry.count(),
    prisma.featureFlag.findUnique({
      where: { key: "gold_engine_enabled" },
      select: { enabled: true },
    }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: "gold." } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);
  return {
    markets,
    draftRateSets,
    publishedRevisions,
    ledgerEntries,
    goldEngineEnabled: Boolean(flag?.enabled),
    activity,
  };
}

export async function getGoldMarketAdmin(marketId: string) {
  const market = await prisma.goldMarket.findUnique({
    where: { id: marketId },
    include: {
      service: { include: { category: true } },
      rateSets: {
        where: { status: "DRAFT" },
        orderBy: { createdAt: "asc" },
        take: 1,
        include: {
          rates: { orderBy: { direction: "asc" } },
        },
      },
      quantityPresets: {
        orderBy: [
          { direction: "asc" },
          { sortOrder: "asc" },
          { publicLabel: "asc" },
        ],
      },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        include: { publishedBy: { select: { name: true, email: true } } },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { actor: { select: { name: true, email: true } } },
      },
    },
  });
  if (!market) return null;
  return {
    ...market,
    draftRateSet: market.rateSets[0] ?? null,
    latestRevision: market.revisions[0] ?? null,
  };
}

export async function saveGoldMarket({
  input,
  actorId,
  expectedVersion,
}: {
  input: GoldMarketInput;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.goldMarket.findUnique({
      where: { id: input.marketId },
    });
    if (!previous) throw new GoldTransitionError("Gold market not found.");
    const updated = await transaction.goldMarket.updateMany({
      where: { id: input.marketId, draftVersion: expectedVersion },
      data: {
        publicName: input.publicName,
        description: input.description,
        availabilityState: input.availabilityState,
        publicTradeInstructions: input.publicTradeInstructions,
        internalInstructions: input.internalInstructions,
        rsnRequired: input.rsnRequired,
        secureServiceEnabled: input.secureServiceEnabled,
        secureServicePricingMode: input.secureServiceEnabled
          ? input.secureServicePricingMode
          : "DISABLED",
        secureServiceFixedMinorUnits:
          input.secureServicePricingMode === "FIXED_MINOR_UNITS"
            ? input.secureServiceFixedMinorUnits
            : 0,
        secureServiceBps:
          input.secureServicePricingMode === "BASIS_POINTS"
            ? input.secureServiceBps
            : 0,
        secureServiceCustomerBuys: input.secureServiceCustomerBuys,
        secureServiceCustomerSells: input.secureServiceCustomerSells,
        quoteValidityMinutes: input.quoteValidityMinutes,
        needsClientReview: input.needsClientReview,
        draftVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new GoldConflictError(
        "This gold market changed after the editor opened. Reload before saving.",
      );
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action:
          previous.availabilityState !== input.availabilityState
            ? "gold.availability.changed"
            : previous.publicTradeInstructions !== input.publicTradeInstructions
              ? "gold.trade_instructions.changed"
              : previous.secureServiceEnabled !== input.secureServiceEnabled ||
                  previous.secureServicePricingMode !==
                    input.secureServicePricingMode
                ? "gold.secure_service.changed"
                : "gold.market.updated",
        targetType: "GoldMarket",
        targetId: input.marketId,
        metadata: auditMetadata({
          availabilityState: input.availabilityState,
          rsnRequired: input.rsnRequired,
          secureServiceEnabled: input.secureServiceEnabled,
        }),
      },
    });
  });
}

export async function saveGoldRate({
  input,
  actorId,
  expectedDraftVersion,
}: {
  input: GoldRateInput;
  actorId: string;
  expectedDraftVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const claimed = await claimRateDraft(
      transaction,
      input.marketId,
      expectedDraftVersion,
    );
    const data = {
      direction: input.direction,
      rateMinorUnitsPerMillion: input.rateMinorUnitsPerMillion,
      minimumQuantityGp: input.minimumQuantity,
      maximumQuantityGp: input.maximumQuantity,
      automaticReviewMaximumGp: input.automaticReviewMaximum,
      effectiveStart: input.effectiveStart!,
      effectiveEnd: input.effectiveEnd,
      enabled: input.enabled,
      needsClientReview: input.needsClientReview,
      concurrencyVersion: { increment: 1 },
    };
    const previous = await transaction.goldRate.findUnique({
      where: {
        rateSetId_direction: {
          rateSetId: claimed.id,
          direction: input.direction,
        },
      },
    });
    const saved = previous
      ? await transaction.goldRate.update({
          where: { id: previous.id },
          data,
        })
      : await transaction.goldRate.create({
          data: {
            id: stableId(),
            rateSetId: claimed.id,
            ...data,
            concurrencyVersion: 1,
          },
        });
    await transaction.auditLog.create({
      data: {
        actorId,
        action:
          input.direction === "CUSTOMER_BUYS_GOLD"
            ? "gold.buy_rate.updated"
            : "gold.sell_rate.updated",
        targetType: "GoldRate",
        targetId: saved.id,
        metadata: auditMetadata({
          marketId: input.marketId,
          direction: input.direction,
          draftVersion: expectedDraftVersion + 1,
          enabled: input.enabled,
        }),
      },
    });
    return saved;
  });
}

export async function saveGoldPreset({
  input,
  actorId,
  presetId,
  expectedPresetVersion,
}: {
  input: GoldPresetInput;
  actorId: string;
  presetId?: string;
  expectedPresetVersion?: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const market = await transaction.goldMarket.findUnique({
      where: { id: input.marketId },
      select: { id: true },
    });
    if (!market) throw new GoldTransitionError("Gold market not found.");
    const data = {
      marketId: input.marketId,
      direction: input.direction,
      publicLabel: input.publicLabel,
      quantityGp: input.quantity,
      sortOrder: input.sortOrder,
      enabled: input.enabled,
      needsClientReview: input.needsClientReview,
    };
    let id = presetId;
    if (presetId) {
      const updated = await transaction.goldQuantityPreset.updateMany({
        where: {
          id: presetId,
          marketId: input.marketId,
          concurrencyVersion: expectedPresetVersion,
        },
        data: { ...data, concurrencyVersion: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new GoldConflictError(
          "This preset changed after the editor opened. Reload before saving.",
        );
      }
    } else {
      const created = await transaction.goldQuantityPreset.create({
        data: { id: stableId(), ...data },
      });
      id = created.id;
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: presetId
          ? input.enabled
            ? "gold.quantity_preset.updated"
            : "gold.quantity_preset.disabled"
          : "gold.quantity_preset.created",
        targetType: "GoldQuantityPreset",
        targetId: id,
        metadata: auditMetadata({
          marketId: input.marketId,
          direction: input.direction,
          quantityGp: input.quantity.toString(),
          enabled: input.enabled,
        }),
      },
    });
    return { id: id! };
  });
}

async function publishedSnapshotFromDraft({
  transaction,
  marketId,
  revisionId,
  revisionNumber,
  publishedAt,
}: {
  transaction: Prisma.TransactionClient;
  marketId: string;
  revisionId: string;
  revisionNumber: number;
  publishedAt: Date;
}) {
  const draft = await transaction.goldRateSet.findFirstOrThrow({
    where: { marketId, status: "DRAFT" },
    include: {
      rates: { orderBy: { direction: "asc" } },
      market: { include: { service: { include: { category: true } } } },
    },
  });
  const rates = draft.rates.map(rateConfig);
  const directions = new Set(rates.map((rate) => rate.direction));
  for (const direction of goldTradeDirections) {
    if (!directions.has(direction)) {
      throw new GoldTransitionError(
        "Both customer-buy and customer-sell rates are required before publishing.",
      );
    }
  }
  return {
    draft,
    snapshot: goldRateRevisionSnapshot({
      market: marketEstimateConfig(draft.market),
      revisionId,
      revisionNumber,
      publishedAt,
      rates,
    }),
  };
}

export async function publishGoldDraft({
  marketId,
  actorId,
  expectedDraftVersion,
}: {
  marketId: string;
  actorId: string;
  expectedDraftVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    await claimRateDraft(transaction, marketId, expectedDraftVersion, {
      publishedAt: new Date(),
      publishedById: actorId,
    });
    const revisionId = stableId();
    const revisionNumber =
      (await latestRevisionNumber(transaction, marketId)) + 1;
    const publishedAt = new Date();
    const { draft, snapshot } = await publishedSnapshotFromDraft({
      transaction,
      marketId,
      revisionId,
      revisionNumber,
      publishedAt,
    });
    await transaction.goldRateSet.updateMany({
      where: { marketId, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });
    const publishedSet = await transaction.goldRateSet.create({
      data: {
        id: stableId(),
        marketId,
        status: "PUBLISHED",
        version: draft.version,
        publishedAt,
        publishedById: actorId,
        internalNotes: draft.internalNotes,
        needsClientReview: draft.needsClientReview,
        rates: {
          create: draft.rates.map((rate) => ({
            id: stableId(),
            direction: rate.direction,
            rateMinorUnitsPerMillion: rate.rateMinorUnitsPerMillion,
            minimumQuantityGp: rate.minimumQuantityGp,
            maximumQuantityGp: rate.maximumQuantityGp,
            automaticReviewMaximumGp: rate.automaticReviewMaximumGp,
            effectiveStart: rate.effectiveStart,
            effectiveEnd: rate.effectiveEnd,
            enabled: rate.enabled,
            needsClientReview: rate.needsClientReview,
          })),
        },
      },
    });
    await transaction.goldRateRevision.create({
      data: {
        id: revisionId,
        marketId,
        rateSetId: publishedSet.id,
        revisionNumber,
        snapshotSchemaVersion: 1,
        snapshot: jsonSnapshot(snapshot),
        publishedAt,
        publishedById: actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "gold.rate_draft.published",
        targetType: "GoldMarket",
        targetId: marketId,
        metadata: auditMetadata({
          revisionId,
          revisionNumber,
          rateCount: draft.rates.length,
        }),
      },
    });
    return { revisionId, revisionNumber };
  });
}

async function latestGoldSnapshot(
  transaction: Prisma.TransactionClient,
  marketId: string,
) {
  const revision = await transaction.goldRateRevision.findFirst({
    where: { marketId },
    orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
    select: { snapshot: true },
  });
  return revision
    ? normalizePublishedGoldRateRevision(revision.snapshot)
    : null;
}

async function replaceDraftRatesFromSnapshot({
  transaction,
  marketId,
  rates,
}: {
  transaction: Prisma.TransactionClient;
  marketId: string;
  rates: GoldRateConfig[];
}) {
  const draft = await ensureDraftGoldRateSet(transaction, marketId);
  await transaction.goldRate.deleteMany({ where: { rateSetId: draft.id } });
  if (rates.length) {
    await transaction.goldRate.createMany({
      data: rates.map((rate) => ({
        id: stableId(),
        rateSetId: draft.id,
        direction: rate.direction,
        rateMinorUnitsPerMillion: rate.rateMinorUnitsPerMillion,
        minimumQuantityGp: BigInt(rate.minimumQuantityGp),
        maximumQuantityGp: BigInt(rate.maximumQuantityGp),
        automaticReviewMaximumGp: BigInt(rate.automaticReviewMaximumGp),
        effectiveStart: new Date(rate.effectiveStart),
        effectiveEnd: rate.effectiveEnd ? new Date(rate.effectiveEnd) : null,
        enabled: rate.enabled,
        needsClientReview: true,
      })),
    });
  }
}

export async function discardGoldDraft({
  marketId,
  actorId,
  expectedDraftVersion,
}: {
  marketId: string;
  actorId: string;
  expectedDraftVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    await claimRateDraft(transaction, marketId, expectedDraftVersion);
    const snapshot = await latestGoldSnapshot(transaction, marketId);
    await replaceDraftRatesFromSnapshot({
      transaction,
      marketId,
      rates: snapshot?.rates ?? [],
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "gold.rate_draft.discarded",
        targetType: "GoldMarket",
        targetId: marketId,
        metadata: auditMetadata({
          restoredRevision: snapshot?.revision.revisionNumber ?? null,
        }),
      },
    });
  });
}

export async function restoreGoldRevision({
  marketId,
  revisionId,
  actorId,
  expectedDraftVersion,
}: {
  marketId: string;
  revisionId: string;
  actorId: string;
  expectedDraftVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    await claimRateDraft(transaction, marketId, expectedDraftVersion);
    const revision = await transaction.goldRateRevision.findFirst({
      where: { id: revisionId, marketId },
      select: { snapshot: true, revisionNumber: true },
    });
    if (!revision) throw new GoldTransitionError("Gold revision not found.");
    const snapshot = normalizePublishedGoldRateRevision(revision.snapshot);
    await replaceDraftRatesFromSnapshot({
      transaction,
      marketId,
      rates: snapshot.rates,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "gold.rate_revision.restored",
        targetType: "GoldRateRevision",
        targetId: revisionId,
        metadata: auditMetadata({
          marketId,
          revisionNumber: revision.revisionNumber,
        }),
      },
    });
  });
}

export async function adjustGoldInventory({
  input,
  actorId,
  expectedStockVersion,
}: {
  input: GoldInventoryAdjustmentInput;
  actorId: string;
  expectedStockVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    if (input.referenceKey) {
      const existing = await transaction.goldInventoryLedgerEntry.findUnique({
        where: { referenceKey: input.referenceKey },
      });
      if (existing) return existing;
    }

    const quantity = input.quantity;
    const where = {
      id: input.marketId,
      stockVersion: expectedStockVersion,
      ...(input.entryType === "STOCK_DECREASE"
        ? { stockQuantityGp: { gte: quantity } }
        : {}),
      ...(input.entryType === "BUY_CAPACITY_DECREASE"
        ? { buyingCapacityGp: { gte: quantity } }
        : {}),
    };
    const data: Prisma.GoldMarketUpdateManyMutationInput = {
      stockVersion: { increment: 1 },
      ...(input.entryType === "STOCK_INCREASE" ||
      input.entryType === "CORRECTION"
        ? { stockQuantityGp: { increment: quantity } }
        : {}),
      ...(input.entryType === "STOCK_DECREASE"
        ? { stockQuantityGp: { decrement: quantity } }
        : {}),
      ...(input.entryType === "BUY_CAPACITY_INCREASE"
        ? { buyingCapacityGp: { increment: quantity } }
        : {}),
      ...(input.entryType === "BUY_CAPACITY_DECREASE"
        ? { buyingCapacityGp: { decrement: quantity } }
        : {}),
    };
    const updated = await transaction.goldMarket.updateMany({ where, data });
    if (updated.count !== 1) {
      throw new GoldConflictError(
        "Inventory changed after the page loaded or the adjustment exceeds the available balance.",
      );
    }
    const market = await transaction.goldMarket.findUniqueOrThrow({
      where: { id: input.marketId },
    });
    const ledger = await transaction.goldInventoryLedgerEntry.create({
      data: {
        marketId: input.marketId,
        entryType: input.entryType,
        quantityGp: quantity,
        resultingStockQuantityGp: market.stockQuantityGp,
        resultingBuyingCapacityGp: market.buyingCapacityGp,
        reason: input.reason,
        internalNote: input.internalNote,
        actorId,
        referenceKey: input.referenceKey,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action:
          input.entryType === "STOCK_INCREASE"
            ? "gold.stock.increased"
            : input.entryType === "STOCK_DECREASE"
              ? "gold.stock.decreased"
              : input.entryType === "BUY_CAPACITY_INCREASE"
                ? "gold.buying_capacity.increased"
                : input.entryType === "BUY_CAPACITY_DECREASE"
                  ? "gold.buying_capacity.decreased"
                  : "gold.inventory.correction",
        targetType: "GoldMarket",
        targetId: input.marketId,
        metadata: auditMetadata({
          ledgerEntryId: ledger.id,
          quantityGp: quantity.toString(),
          reason: input.reason,
        }),
      },
    });
    return ledger;
  });
}

export function goldActionErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the submitted values.";
  }
  if (
    error instanceof GoldConflictError ||
    error instanceof GoldTransitionError ||
    error instanceof GoldValidationError
  ) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "P2002") return "That gold record already exists.";
    if (code === "P2003")
      return "This gold record is still referenced and cannot be removed.";
    if (code === "P2025") return "This gold record no longer exists.";
  }
  console.error("[gold:action]", {
    errorName: error instanceof Error ? error.name : typeof error,
  });
  return "The gold action could not be completed. Please try again.";
}

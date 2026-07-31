import "server-only";

import type {
  CartCompatibilityGroup,
  CartItemKind,
  Prisma,
} from "@/generated/prisma/client";
import { calculateServerAccountListingEstimate } from "@/lib/accounts/server";
import {
  bossingDeliverySpeeds,
  bossingKillModes,
} from "@/lib/bossing/constants";
import {
  BossingValidationError,
  calculateBossingEstimate,
  calculateBossingKillProgress,
} from "@/lib/bossing/estimate";
import { catalogueGameModes } from "@/lib/catalogue/constants";
import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import {
  CART_ITEM_SNAPSHOT_SCHEMA_VERSION,
  cartItemKindLabels,
} from "@/lib/checkout/constants";
import {
  CheckoutSecurityError,
  assertNoCredentialLikeKeys,
} from "@/lib/checkout/security";
import { prisma } from "@/lib/db/prisma";
import { goldTradeDirections } from "@/lib/gold/constants";
import { GoldValidationError } from "@/lib/gold/estimate";
import { calculateServerGoldEstimate } from "@/lib/gold/server";
import { premiumDeliverySpeeds } from "@/lib/premium/constants";
import {
  PremiumValidationError,
  calculatePremiumEstimate,
} from "@/lib/premium/estimate";
import { publicPricingPayload } from "@/lib/pricing/public-response";
import { applyPublishedPricingIfEnabled } from "@/lib/pricing/server";
import { ProductMarketplaceValidationError } from "@/lib/products/estimate";
import { calculateServerProductEstimate } from "@/lib/products/server";
import {
  skillingDeliverySpeeds,
  skillingInputModes,
  skillingSkillKeys,
} from "@/lib/skilling/constants";
import { calculateSkillingEstimate } from "@/lib/skilling/estimate";
import {
  SkillingValidationError,
  calculateLevelProgress,
  calculateXpProgress,
} from "@/lib/skilling/xp";
import { z } from "zod";

export class CartAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartAdapterError";
  }
}

export type CartLine = {
  label: string;
  amountCents: number;
};

export type CartItemSnapshotV1 = {
  schemaVersion: typeof CART_ITEM_SNAPSHOT_SCHEMA_VERSION;
  itemKind: CartItemKind;
  compatibilityGroup: CartCompatibilityGroup;
  publicTitle: string;
  publicDescription: string;
  publicConfigurationSummary: string;
  quantity: string;
  currency: string;
  authoritativeLineItems: CartLine[];
  subtotalCents: number;
  customerSafeGlobalPricingLines: CartLine[];
  finalEstimatedTotalCents: number;
  sourceRevision: {
    id: string | null;
    revisionNumber: number | null;
  };
  generatedAt: string;
  repricingRequired: boolean;
  reservationRequired: boolean;
};

export type CartSourceInput = {
  kind: CartItemKind;
  source: unknown;
  quantity?: string | number;
  serviceDetails?: unknown;
};

export type CartAdapterResult = {
  kind: CartItemKind;
  compatibilityGroup: CartCompatibilityGroup;
  sourceReference: string;
  publicSourceSlug: string | null;
  quantity: bigint;
  currencyCode: string;
  subtotalCents: number;
  adjustmentTotalCents: number;
  finalTotalCents: number;
  sourcePublishedRevisionId: string | null;
  sourcePublishedRevisionNumber: number | null;
  globalPricingRevisionId: string | null;
  globalPricingRevisionNumber: number | null;
  validationState:
    | "VALID"
    | "RESERVATION_REQUIRED"
    | "MANUAL_REVIEW_REQUIRED"
    | "OUT_OF_STOCK"
    | "UNAVAILABLE";
  repricingRequired: boolean;
  stockRecheckRequired: boolean;
  availabilityRecheckRequired: boolean;
  reservationRequired: boolean;
  snapshot: CartItemSnapshotV1;
  customerSelections: Record<string, unknown>;
  resource:
    | { type: "NONE" }
    | {
        type: "PRODUCT";
        productStableKey: string;
        variantStableKey: string;
        quantity: string;
      }
    | { type: "ACCOUNT"; listingId: string }
    | { type: "GOLD"; marketId: string; quantityGp: string };
};

type Adapter = {
  kind: CartItemKind;
  resolve(input: CartSourceInput): Promise<CartAdapterResult>;
};

function safeJson<T>(value: T) {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    ),
  ) as T;
}

function lineAmountTotal(lines: CartLine[]) {
  return lines.reduce((total, line) => total + line.amountCents, 0);
}

function snapshot(input: Omit<CartItemSnapshotV1, "schemaVersion">) {
  return {
    schemaVersion: CART_ITEM_SNAPSHOT_SCHEMA_VERSION,
    ...input,
  } satisfies CartItemSnapshotV1;
}

function adapterResult(input: {
  kind: CartItemKind;
  compatibilityGroup: CartCompatibilityGroup;
  sourceReference: string;
  publicSourceSlug?: string | null;
  quantity?: bigint;
  currencyCode: string;
  title: string;
  description: string;
  summary: string;
  lines: CartLine[];
  subtotalCents: number;
  globalLines?: CartLine[];
  finalTotalCents: number;
  sourceRevisionId?: string | null;
  sourceRevisionNumber?: number | null;
  globalRevisionId?: string | null;
  globalRevisionNumber?: number | null;
  reservationRequired?: boolean;
  stockRecheckRequired?: boolean;
  availabilityRecheckRequired?: boolean;
  customerSelections?: Record<string, unknown>;
  resource?: CartAdapterResult["resource"];
}) {
  const globalLines = input.globalLines ?? [];
  return {
    kind: input.kind,
    compatibilityGroup: input.compatibilityGroup,
    sourceReference: input.sourceReference,
    publicSourceSlug: input.publicSourceSlug ?? null,
    quantity: input.quantity ?? 1n,
    currencyCode: input.currencyCode,
    subtotalCents: input.subtotalCents,
    adjustmentTotalCents: lineAmountTotal(globalLines),
    finalTotalCents: input.finalTotalCents,
    sourcePublishedRevisionId: input.sourceRevisionId ?? null,
    sourcePublishedRevisionNumber: input.sourceRevisionNumber ?? null,
    globalPricingRevisionId: input.globalRevisionId ?? null,
    globalPricingRevisionNumber: input.globalRevisionNumber ?? null,
    validationState: input.reservationRequired
      ? ("RESERVATION_REQUIRED" as const)
      : ("VALID" as const),
    repricingRequired: false,
    stockRecheckRequired: input.stockRecheckRequired ?? false,
    availabilityRecheckRequired: input.availabilityRecheckRequired ?? false,
    reservationRequired: input.reservationRequired ?? false,
    snapshot: snapshot({
      itemKind: input.kind,
      compatibilityGroup: input.compatibilityGroup,
      publicTitle: input.title,
      publicDescription: input.description,
      publicConfigurationSummary: input.summary,
      quantity: (input.quantity ?? 1n).toString(),
      currency: input.currencyCode,
      authoritativeLineItems: input.lines,
      subtotalCents: input.subtotalCents,
      customerSafeGlobalPricingLines: globalLines,
      finalEstimatedTotalCents: input.finalTotalCents,
      sourceRevision: {
        id: input.sourceRevisionId ?? null,
        revisionNumber: input.sourceRevisionNumber ?? null,
      },
      generatedAt: new Date().toISOString(),
      repricingRequired: false,
      reservationRequired: input.reservationRequired ?? false,
    }),
    customerSelections: input.customerSelections ?? {},
    resource: input.resource ?? { type: "NONE" as const },
  } satisfies CartAdapterResult;
}

function parseSource<T extends z.ZodType>(schema: T, source: unknown) {
  assertNoCredentialLikeKeys(source);
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new CartAdapterError(
      parsed.error.issues[0]?.message ?? "Cart source is invalid.",
    );
  }
  return parsed.data as z.infer<T>;
}

async function flagEnabled(key: string) {
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

const skillingSourceSchema = z
  .object({
    serviceId: z.string().trim().min(1).max(30),
    skillKey: z.enum(skillingSkillKeys),
    methodSlug: z.string().trim().min(2).max(180),
    inputMode: z.enum(skillingInputModes),
    currentLevel: z.number().int().optional(),
    targetLevel: z.number().int().optional(),
    currentXp: z.number().int().optional(),
    targetXp: z.number().int().optional(),
    gameMode: z.enum(catalogueGameModes),
    includeSupplies: z.boolean().default(false),
    includeDiscordStream: z.boolean().default(false),
    deliverySpeed: z.enum(skillingDeliverySpeeds),
  })
  .superRefine((value, context) => {
    if (value.inputMode === "LEVEL") {
      if (value.currentLevel == null) {
        context.addIssue({
          code: "custom",
          path: ["currentLevel"],
          message: "Enter a current level.",
        });
      }
      if (value.targetLevel == null) {
        context.addIssue({
          code: "custom",
          path: ["targetLevel"],
          message: "Enter a target level.",
        });
      }
    }
    if (value.inputMode === "XP") {
      if (value.currentXp == null) {
        context.addIssue({
          code: "custom",
          path: ["currentXp"],
          message: "Enter current XP.",
        });
      }
      if (value.targetXp == null) {
        context.addIssue({
          code: "custom",
          path: ["targetXp"],
          message: "Enter target XP.",
        });
      }
    }
  });

async function resolveSkilling(input: CartSourceInput) {
  const source = parseSource(skillingSourceSchema, input.source);
  if (!(await flagEnabled("skilling_calculator_enabled"))) {
    throw new CartAdapterError("The skilling calculator is unavailable.");
  }
  const service = await prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(),
      id: source.serviceId,
      engineType: "SKILLING_CALCULATOR",
    },
    include: {
      category: true,
      gameModes: true,
      skillingRule: true,
      skillingSkills: {
        where: { skillKey: source.skillKey, enabled: true },
        take: 1,
        include: {
          methods: {
            where: { slug: source.methodSlug, enabled: true },
            take: 1,
          },
        },
      },
    },
  });
  const skill = service?.skillingSkills[0];
  const method = skill?.methods[0];
  if (!service || !skill || !method || !service.skillingRule) {
    throw new CartAdapterError("Choose an available skilling method.");
  }
  if (!service.gameModes.some(({ gameMode }) => gameMode === source.gameMode)) {
    throw new CartAdapterError("Choose a supported account mode.");
  }
  const progress =
    source.inputMode === "LEVEL"
      ? calculateLevelProgress({
          currentLevel: source.currentLevel!,
          targetLevel: source.targetLevel!,
        })
      : calculateXpProgress({
          currentXp: source.currentXp!,
          targetXp: source.targetXp!,
        });
  const estimate = calculateSkillingEstimate({
    progress,
    method,
    rule: service.skillingRule,
    gameMode: source.gameMode,
    includeSupplies: source.includeSupplies,
    includeDiscordStream: source.includeDiscordStream,
    deliverySpeed: source.deliverySpeed,
  });
  const priced = publicPricingPayload(
    await applyPublishedPricingIfEnabled({
      source: {
        serviceId: service.id,
        serviceSlug: service.slug,
        categoryId: service.categoryId,
        categorySlug: service.category.slug,
        engineType: service.engineType,
        currency: "USD",
        baseSubtotalCents: estimate.estimatedTotalCents,
        basePricingLines: estimate.lineItems,
        selectedReferences: {
          skillKey: source.skillKey,
          methodSlug: source.methodSlug,
          inputMode: source.inputMode,
          gameMode: source.gameMode,
          deliverySpeed: source.deliverySpeed,
        },
        engineConfigurationRevision: {
          id: service.skillingRule.id,
          version: service.version,
        },
      },
    }),
  );
  const globalLines = [
    ...priced.globalAdjustmentLines,
    ...priced.minimumMaximumAdjustmentLines,
  ];
  return adapterResult({
    kind: "SKILLING_ESTIMATE",
    compatibilityGroup: "STANDARD_SERVICE",
    sourceReference: `${service.id}:${source.skillKey}:${source.methodSlug}`,
    publicSourceSlug: service.slug,
    currencyCode: "USD",
    title: `${skill.name} training`,
    description: service.shortSummary,
    summary: `${estimate.currentLevel}-${estimate.targetLevel} via ${estimate.methodName}, ${estimate.delivery.label}`,
    lines: priced.lineItems,
    subtotalCents: estimate.estimatedTotalCents,
    globalLines,
    finalTotalCents: priced.estimatedTotalCents,
    sourceRevisionId: service.skillingRule.id,
    sourceRevisionNumber: service.version,
    globalRevisionId: priced.pricingRevision?.id ?? null,
    globalRevisionNumber: priced.pricingRevision?.revisionNumber ?? null,
    customerSelections: safeJson(source),
  });
}

const bossingSourceSchema = z
  .object({
    serviceId: z.string().trim().min(1).max(30),
    bossKey: z.string().trim().min(2).max(120),
    methodSlug: z.string().trim().min(2).max(180),
    killMode: z.enum(bossingKillModes),
    killQuantity: z.number().optional(),
    currentKillCount: z.number().optional(),
    targetKillCount: z.number().optional(),
    gameMode: z.enum(catalogueGameModes),
    customerGearConfirmed: z.boolean().default(false),
    includeSupplies: z.boolean().default(false),
    includeDiscordStream: z.boolean().default(false),
    deliverySpeed: z.enum(bossingDeliverySpeeds),
  })
  .superRefine((value, context) => {
    if (value.killMode === "DIRECT" && value.killQuantity == null) {
      context.addIssue({
        code: "custom",
        path: ["killQuantity"],
        message: "Enter the number of kills.",
      });
    }
    if (value.killMode === "TARGET_KC") {
      if (value.currentKillCount == null) {
        context.addIssue({
          code: "custom",
          path: ["currentKillCount"],
          message: "Enter current KC.",
        });
      }
      if (value.targetKillCount == null) {
        context.addIssue({
          code: "custom",
          path: ["targetKillCount"],
          message: "Enter target KC.",
        });
      }
    }
  });

async function resolveBossing(input: CartSourceInput) {
  const source = parseSource(bossingSourceSchema, input.source);
  if (!(await flagEnabled("bossing_calculator_enabled"))) {
    throw new CartAdapterError("The bossing calculator is unavailable.");
  }
  const service = await prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(),
      id: source.serviceId,
      engineType: "BOSSING_ENGINE",
    },
    include: {
      category: true,
      gameModes: true,
      bossingRule: true,
      bossingBosses: {
        where: { bossKey: source.bossKey, enabled: true },
        take: 1,
        include: {
          methods: {
            where: { slug: source.methodSlug, enabled: true },
            take: 1,
          },
        },
      },
    },
  });
  const boss = service?.bossingBosses[0];
  const method = boss?.methods[0];
  if (!service || !boss || !method || !service.bossingRule) {
    throw new CartAdapterError("Choose an available bossing method.");
  }
  if (!service.gameModes.some(({ gameMode }) => gameMode === source.gameMode)) {
    throw new CartAdapterError("Choose a supported account mode.");
  }
  const progress = calculateBossingKillProgress({
    mode: source.killMode,
    killQuantity: source.killQuantity,
    currentKillCount: source.currentKillCount,
    targetKillCount: source.targetKillCount,
  });
  const estimate = calculateBossingEstimate({
    progress,
    method,
    rule: service.bossingRule,
    gameMode: source.gameMode,
    customerGearConfirmed: source.customerGearConfirmed,
    includeSupplies: source.includeSupplies,
    includeDiscordStream: source.includeDiscordStream,
    deliverySpeed: source.deliverySpeed,
  });
  const priced = publicPricingPayload(
    await applyPublishedPricingIfEnabled({
      source: {
        serviceId: service.id,
        serviceSlug: service.slug,
        categoryId: service.categoryId,
        categorySlug: service.category.slug,
        engineType: service.engineType,
        currency: "USD",
        baseSubtotalCents: estimate.estimatedTotalCents,
        basePricingLines: estimate.lineItems,
        selectedReferences: {
          bossKey: source.bossKey,
          methodSlug: source.methodSlug,
          killMode: source.killMode,
          gameMode: source.gameMode,
          deliverySpeed: source.deliverySpeed,
        },
        engineConfigurationRevision: {
          id: service.bossingRule.id,
          version: service.version,
        },
      },
    }),
  );
  const globalLines = [
    ...priced.globalAdjustmentLines,
    ...priced.minimumMaximumAdjustmentLines,
  ];
  return adapterResult({
    kind: "BOSSING_ESTIMATE",
    compatibilityGroup: "STANDARD_SERVICE",
    sourceReference: `${service.id}:${source.bossKey}:${source.methodSlug}`,
    publicSourceSlug: service.slug,
    currencyCode: "USD",
    title: boss.name,
    description: service.shortSummary,
    summary: `${estimate.requestedKills.toLocaleString()} kill${estimate.requestedKills === 1 ? "" : "s"} via ${estimate.methodName}`,
    lines: priced.lineItems,
    subtotalCents: estimate.estimatedTotalCents,
    globalLines,
    finalTotalCents: priced.estimatedTotalCents,
    sourceRevisionId: service.bossingRule.id,
    sourceRevisionNumber: service.version,
    globalRevisionId: priced.pricingRevision?.id ?? null,
    globalRevisionNumber: priced.pricingRevision?.revisionNumber ?? null,
    customerSelections: safeJson(source),
  });
}

const premiumSourceSchema = z.object({
  serviceId: z.string().trim().min(1).max(30),
  packageSlug: z.string().trim().min(2).max(180),
  optionSelections: z
    .array(
      z.object({
        slug: z.string().trim().min(2).max(180),
        quantity: z.number().int().min(1).max(1_000_000).optional(),
      }),
    )
    .max(20)
    .default([]),
  gameMode: z.enum(catalogueGameModes),
  customerGearConfirmed: z.boolean().default(false),
  includeDiscordStream: z.boolean().default(false),
  deliverySpeed: z.enum(premiumDeliverySpeeds),
});

async function resolvePremium(input: CartSourceInput) {
  const source = parseSource(premiumSourceSchema, input.source);
  if (!(await flagEnabled("premium_configurator_enabled"))) {
    throw new CartAdapterError("The premium configurator is unavailable.");
  }
  const service = await prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(),
      id: source.serviceId,
      engineType: "PREMIUM_SERVICE_CONFIGURATOR",
    },
    include: {
      category: true,
      gameModes: true,
      premiumConfig: true,
      premiumPackages: {
        where: { slug: source.packageSlug, enabled: true },
        take: 1,
      },
      premiumOptions: {
        where: { enabled: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  const premiumPackage = service?.premiumPackages[0];
  if (
    !service ||
    !premiumPackage ||
    !service.premiumConfig ||
    !service.premiumConfig.enabled
  ) {
    throw new CartAdapterError("Choose an available premium package.");
  }
  if (!service.gameModes.some(({ gameMode }) => gameMode === source.gameMode)) {
    throw new CartAdapterError("Choose a supported account mode.");
  }
  const optionsForPackage = service.premiumOptions.filter(
    (option) => !option.packageId || option.packageId === premiumPackage.id,
  );
  const estimate = calculatePremiumEstimate({
    package: premiumPackage,
    rule: service.premiumConfig,
    availableOptions: optionsForPackage,
    selectedOptions: source.optionSelections,
    gameMode: source.gameMode,
    customerGearConfirmed: source.customerGearConfirmed,
    includeDiscordStream: source.includeDiscordStream,
    deliverySpeed: source.deliverySpeed,
  });
  const priced = publicPricingPayload(
    await applyPublishedPricingIfEnabled({
      source: {
        serviceId: service.id,
        serviceSlug: service.slug,
        categoryId: service.categoryId,
        categorySlug: service.category.slug,
        engineType: service.engineType,
        currency: "USD",
        baseSubtotalCents: estimate.estimatedTotalCents,
        basePricingLines: estimate.lineItems,
        selectedReferences: {
          packageSlug: source.packageSlug,
          gameMode: source.gameMode,
          deliverySpeed: source.deliverySpeed,
          selectedOptionCount: source.optionSelections.length,
        },
        engineConfigurationRevision: {
          id: service.premiumConfig.id,
          version: service.version,
        },
      },
    }),
  );
  const globalLines = [
    ...priced.globalAdjustmentLines,
    ...priced.minimumMaximumAdjustmentLines,
  ];
  return adapterResult({
    kind: "PREMIUM_ESTIMATE",
    compatibilityGroup: "STANDARD_SERVICE",
    sourceReference: `${service.id}:${source.packageSlug}`,
    publicSourceSlug: service.slug,
    currencyCode: "USD",
    title: estimate.packageName,
    description: service.shortSummary,
    summary: `${estimate.packageName}, ${estimate.delivery.label}`,
    lines: priced.lineItems,
    subtotalCents: estimate.estimatedTotalCents,
    globalLines,
    finalTotalCents: priced.estimatedTotalCents,
    sourceRevisionId: service.premiumConfig.id,
    sourceRevisionNumber: service.version,
    globalRevisionId: priced.pricingRevision?.id ?? null,
    globalRevisionNumber: priced.pricingRevision?.revisionNumber ?? null,
    customerSelections: safeJson(source),
  });
}

const productSourceSchema = z.object({
  productStableKey: z.string().trim().min(1).max(120).optional(),
  productSlug: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  variantStableKey: z.string().trim().min(1).max(160).optional(),
  publicSku: z.string().trim().min(1).max(120).optional(),
  quantity: z.union([z.string().trim().max(40), z.number().int()]),
});

async function resolveProduct(input: CartSourceInput) {
  const source = parseSource(productSourceSchema, {
    ...(typeof input.source === "object" && input.source ? input.source : {}),
    quantity:
      (input.source as { quantity?: unknown } | null)?.quantity ??
      input.quantity ??
      1,
  });
  const estimate = await calculateServerProductEstimate(source);
  if (estimate.state !== "AVAILABLE" && estimate.state !== "LOW_STOCK") {
    throw new CartAdapterError("Choose an available product.");
  }
  if (
    estimate.estimatedTotalCents == null ||
    estimate.productSubtotalCents == null
  ) {
    throw new CartAdapterError(
      "Manual-review products cannot be added to cart.",
    );
  }
  const snapshotData = estimate.snapshot;
  return adapterResult({
    kind: "PRODUCT_ESTIMATE",
    compatibilityGroup: "STANDARD_SERVICE",
    sourceReference: `${snapshotData.productStableKey}:${snapshotData.variantStableKey}`,
    publicSourceSlug: snapshotData.productSlug,
    quantity: BigInt(estimate.quantity),
    currencyCode: estimate.currency,
    title: snapshotData.productPublicTitle,
    description: estimate.availabilityMessage,
    summary: `${snapshotData.variantPublicName} x ${estimate.quantityLabel}`,
    lines: estimate.lineItems,
    subtotalCents: estimate.productSubtotalCents,
    globalLines: estimate.globalPricingLines,
    finalTotalCents: estimate.estimatedTotalCents,
    sourceRevisionId: snapshotData.publishedProductRevision.id,
    sourceRevisionNumber: snapshotData.publishedProductRevision.revisionNumber,
    globalRevisionId: snapshotData.publishedGlobalPricingRevision?.id ?? null,
    globalRevisionNumber:
      snapshotData.publishedGlobalPricingRevision?.revisionNumber ?? null,
    reservationRequired: true,
    stockRecheckRequired: true,
    availabilityRecheckRequired: true,
    customerSelections: safeJson(source),
    resource: {
      type: "PRODUCT",
      productStableKey: snapshotData.productStableKey,
      variantStableKey: snapshotData.variantStableKey,
      quantity: estimate.quantity,
    },
  });
}

const accountSourceSchema = z.object({
  listingId: z.string().trim().min(1).max(30).optional(),
  listingSlug: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

async function resolveAccount(input: CartSourceInput) {
  const source = parseSource(accountSourceSchema, input.source);
  const estimate = await calculateServerAccountListingEstimate(source);
  const listingStableKey = estimate.snapshot.listing.stableKey;
  const listing = await prisma.accountListing.findFirst({
    where: source.listingId
      ? { id: source.listingId }
      : { stableKey: listingStableKey },
    select: { id: true },
  });
  if (!listing) throw new CartAdapterError("Choose an available account.");
  return adapterResult({
    kind: "ACCOUNT_LISTING_ESTIMATE",
    compatibilityGroup: "ACCOUNT_LISTING",
    sourceReference: listing.id,
    publicSourceSlug: estimate.snapshot.listing.slug,
    currencyCode: estimate.currency,
    title: estimate.snapshot.listing.publicTitle,
    description: estimate.availabilityMessage,
    summary: `${estimate.snapshot.listing.gameMode} account listing`,
    lines: estimate.lineItems,
    subtotalCents: estimate.basePriceCents,
    globalLines: estimate.snapshot.globalPricingAdjustmentLines,
    finalTotalCents: estimate.estimatedTotalCents,
    sourceRevisionId: estimate.snapshot.publishedListingRevision.id,
    sourceRevisionNumber:
      estimate.snapshot.publishedListingRevision.revisionNumber,
    globalRevisionId:
      estimate.snapshot.publishedGlobalPricingRevision?.id ?? null,
    globalRevisionNumber:
      estimate.snapshot.publishedGlobalPricingRevision?.revisionNumber ?? null,
    reservationRequired: true,
    availabilityRecheckRequired: true,
    customerSelections: safeJson(source),
    resource: { type: "ACCOUNT", listingId: listing.id },
  });
}

const goldSourceSchema = z.object({
  serviceId: z.string().trim().min(1).max(30).optional(),
  marketId: z.string().trim().min(1).max(30).optional(),
  direction: z.enum(goldTradeDirections).default("CUSTOMER_BUYS_GOLD"),
  quantity: z.string().trim().min(1).max(80).default(""),
  presetId: z.string().trim().min(1).max(30).optional(),
  secureServiceSelected: z.boolean().default(false),
  rsn: z.string().trim().max(12).optional(),
});

async function resolveGold(input: CartSourceInput) {
  const source = parseSource(goldSourceSchema, input.source);
  if (source.direction !== "CUSTOMER_BUYS_GOLD") {
    throw new CartAdapterError(
      "Customer-selling-gold estimates cannot enter a charge cart.",
    );
  }
  const estimate = await calculateServerGoldEstimate({
    ...source,
    direction: "CUSTOMER_BUYS_GOLD",
  });
  if (estimate.manualReviewRequired) {
    throw new CartAdapterError(
      "Manual-review gold estimates cannot be added to cart.",
    );
  }
  const marketId = source.marketId ?? estimate.snapshot.market.id;
  return adapterResult({
    kind: "GOLD_BUY_ESTIMATE",
    compatibilityGroup: "GOLD_BUY",
    sourceReference: `${marketId}:${estimate.quantityGp}`,
    publicSourceSlug: estimate.snapshot.market.slug,
    quantity: BigInt(estimate.quantityGp),
    currencyCode: estimate.currency,
    title: "Gold purchase",
    description: estimate.availabilityMessage,
    summary: `${estimate.quantityLabel} with manual payment review`,
    lines: estimate.lineItems,
    subtotalCents: estimate.baseTotalMinorUnits,
    globalLines: estimate.snapshot.globalPricingAdjustmentLines.map((line) => ({
      label: line.label,
      amountCents: line.amountMinorUnits,
    })),
    finalTotalCents: estimate.estimatedTotalMinorUnits,
    sourceRevisionId: estimate.snapshot.publishedGoldRateRevision.id,
    sourceRevisionNumber:
      estimate.snapshot.publishedGoldRateRevision.revisionNumber,
    globalRevisionId:
      estimate.snapshot.publishedGlobalPricingRevision?.id ?? null,
    globalRevisionNumber:
      estimate.snapshot.publishedGlobalPricingRevision?.revisionNumber ?? null,
    reservationRequired: true,
    stockRecheckRequired: true,
    availabilityRecheckRequired: true,
    customerSelections: safeJson({
      ...source,
      direction: "CUSTOMER_BUYS_GOLD",
    }),
    resource: { type: "GOLD", marketId, quantityGp: estimate.quantityGp },
  });
}

const quoteSourceSchema = z.object({
  quoteId: z.string().trim().min(1).max(30),
});

async function resolveAcceptedQuote(input: CartSourceInput) {
  const source = parseSource(quoteSourceSchema, input.source);
  const quote = await prisma.customBuildQuote.findUnique({
    where: { id: source.quoteId },
    include: {
      request: { select: { publicRequestNumber: true } },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }],
        take: 5,
        include: { lines: { orderBy: [{ sortOrder: "asc" }] } },
      },
      decisions: { orderBy: [{ decidedAt: "desc" }], take: 1 },
    },
  });
  const decision = quote?.decisions[0];
  const revision = quote?.revisions.find(
    (candidate) => candidate.id === decision?.revisionId,
  );
  if (
    !quote ||
    quote.status !== "ACCEPTED" ||
    !decision ||
    decision.decision !== "ACCEPTED" ||
    !revision ||
    (quote.expiresAt && quote.expiresAt <= new Date())
  ) {
    throw new CartAdapterError(
      "Only an active accepted quote can be converted.",
    );
  }
  const existingOrderItem = await prisma.orderItem.findFirst({
    where: {
      kind: "ACCEPTED_CUSTOM_BUILD_QUOTE",
      sourceReference: quote.id,
    },
    select: { id: true },
  });
  if (existingOrderItem) {
    throw new CartAdapterError(
      "This accepted quote has already been converted.",
    );
  }
  const lines = revision.lines.length
    ? revision.lines.map((line) => ({
        label: line.publicDescription,
        amountCents: line.lineTotalCents,
      }))
    : [
        {
          label: "Accepted custom-build quote",
          amountCents: revision.finalTotalCents,
        },
      ];
  return adapterResult({
    kind: "ACCEPTED_CUSTOM_BUILD_QUOTE",
    compatibilityGroup: "ACCEPTED_CUSTOM_QUOTE",
    sourceReference: quote.id,
    publicSourceSlug: quote.publicQuoteNumber,
    currencyCode: quote.currencyCode,
    title: `Accepted quote ${quote.publicQuoteNumber}`,
    description: "Accepted custom account-build quote.",
    summary: revision.includedWorkSummary.slice(0, 500),
    lines,
    subtotalCents: revision.subtotalCents,
    globalLines: [],
    finalTotalCents: revision.finalTotalCents,
    sourceRevisionId: revision.id,
    sourceRevisionNumber: revision.revisionNumber,
    customerSelections: safeJson(source),
  });
}

const adapters: Record<CartItemKind, Adapter> = {
  SKILLING_ESTIMATE: { kind: "SKILLING_ESTIMATE", resolve: resolveSkilling },
  BOSSING_ESTIMATE: { kind: "BOSSING_ESTIMATE", resolve: resolveBossing },
  PREMIUM_ESTIMATE: { kind: "PREMIUM_ESTIMATE", resolve: resolvePremium },
  PRODUCT_ESTIMATE: { kind: "PRODUCT_ESTIMATE", resolve: resolveProduct },
  ACCOUNT_LISTING_ESTIMATE: {
    kind: "ACCOUNT_LISTING_ESTIMATE",
    resolve: resolveAccount,
  },
  GOLD_BUY_ESTIMATE: { kind: "GOLD_BUY_ESTIMATE", resolve: resolveGold },
  ACCEPTED_CUSTOM_BUILD_QUOTE: {
    kind: "ACCEPTED_CUSTOM_BUILD_QUOTE",
    resolve: resolveAcceptedQuote,
  },
};

export async function resolveCartSource(input: CartSourceInput) {
  try {
    const adapter = adapters[input.kind];
    if (!adapter) throw new CartAdapterError("Unsupported cart item.");
    return await adapter.resolve(input);
  } catch (error) {
    if (
      error instanceof CartAdapterError ||
      error instanceof CheckoutSecurityError ||
      error instanceof SkillingValidationError ||
      error instanceof BossingValidationError ||
      error instanceof PremiumValidationError ||
      error instanceof ProductMarketplaceValidationError ||
      error instanceof GoldValidationError
    ) {
      throw new CartAdapterError(error.message);
    }
    throw error;
  }
}

export function assertKnownCartItemSnapshot(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { schemaVersion?: unknown }).schemaVersion !==
      CART_ITEM_SNAPSHOT_SCHEMA_VERSION
  ) {
    throw new CartAdapterError("Unknown cart item snapshot schema version.");
  }
  return value as CartItemSnapshotV1;
}

export function publicCartItemKind(kind: CartItemKind) {
  return cartItemKindLabels[kind] ?? kind;
}

export function toInputJson(value: unknown) {
  return safeJson(value) as Prisma.InputJsonValue;
}

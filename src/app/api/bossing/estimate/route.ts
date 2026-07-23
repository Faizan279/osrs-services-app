import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { catalogueGameModes } from "@/lib/catalogue/constants";
import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import { prisma } from "@/lib/db/prisma";
import {
  bossingDeliverySpeeds,
  bossingKillModes,
} from "@/lib/bossing/constants";
import {
  BossingValidationError,
  calculateBossingEstimate,
  calculateBossingKillProgress,
} from "@/lib/bossing/estimate";
import { evaluateRequirements } from "@/lib/eligibility/evaluator";
import { lookupPublicStats } from "@/lib/eligibility/lookup";
import {
  configuredRsnProvider,
  RsnNotFoundError,
  RsnProviderDataError,
  RsnProviderUnavailableError,
} from "@/lib/eligibility/provider";
import {
  consumePublicLookupLimit,
  type PublicClientCookie,
  requestIdentity,
} from "@/lib/eligibility/rate-limit";
import { rsnSchema } from "@/lib/eligibility/rsn";
import { publicPricingPayload } from "@/lib/pricing/public-response";
import { applyPublishedPricingIfEnabled } from "@/lib/pricing/server";

export const dynamic = "force-dynamic";

const estimateInputSchema = z
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
    rsn: rsnSchema.optional(),
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

function json(
  body: unknown,
  status = 200,
  publicClientCookie?: PublicClientCookie | null,
) {
  const response = NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
  if (publicClientCookie) {
    response.cookies.set(
      publicClientCookie.name,
      publicClientCookie.value,
      publicClientCookie.options,
    );
  }
  return response;
}

function safeValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the calculator inputs.";
}

function bossingRequirementsForEvaluation(
  method: NonNullable<
    Awaited<ReturnType<typeof loadBossingEstimateService>>
  >["bossingBosses"][number]["methods"][number],
) {
  return [
    ...method.statRequirements.map((requirement) => ({
      id: requirement.id,
      title: requirement.label,
      description:
        requirement.customerGuidance ??
        `${requirement.label} must be at least ${requirement.requiredLevel}.`,
      isRequired: true,
      verificationMode: requirement.verificationMode,
      customerGuidance: requirement.customerGuidance,
      metricKey: requirement.metricKey,
      comparisonOperator: "GREATER_THAN_OR_EQUAL" as const,
      requiredValue: requirement.requiredLevel,
      recommendedService: null,
    })),
    ...method.gearRequirements.map((requirement) => ({
      id: requirement.id,
      title: requirement.label,
      description: requirement.description,
      isRequired: requirement.isRequired,
      verificationMode: requirement.verificationMode,
      customerGuidance: requirement.customerGuidance,
      metricKey: null,
      comparisonOperator: null,
      requiredValue: null,
      recommendedService: null,
    })),
  ];
}

async function loadBossingEstimateService(input: {
  serviceId: string;
  bossKey: string;
  methodSlug: string;
}) {
  return prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(),
      id: input.serviceId,
      engineType: "BOSSING_ENGINE",
    },
    include: {
      gameModes: true,
      bossingRule: true,
      bossingBosses: {
        where: { bossKey: input.bossKey, enabled: true },
        take: 1,
        include: {
          methods: {
            where: { slug: input.methodSlug, enabled: true },
            take: 1,
            include: {
              statRequirements: {
                orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
              },
              gearRequirements: {
                orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
              },
            },
          },
        },
      },
    },
  });
}

async function maybeEvaluateRsn(
  request: NextRequest,
  rsn: string | undefined,
  method: NonNullable<
    Awaited<ReturnType<typeof loadBossingEstimateService>>
  >["bossingBosses"][number]["methods"][number],
) {
  if (!rsn) return { eligibility: null, cookie: null };
  const clientIdentity = requestIdentity(request);
  const flag = await prisma.featureFlag.findUnique({
    where: { key: "rsn_eligibility_enabled" },
    select: { enabled: true },
  });
  if (!flag?.enabled) {
    return {
      cookie: clientIdentity.setCookie,
      eligibility: {
        ok: false,
        message:
          "Public stats checks are temporarily unavailable. You can still use the calculator without RSN lookup.",
      },
    };
  }
  if (!(await consumePublicLookupLimit(clientIdentity.identity))) {
    return {
      cookie: clientIdentity.setCookie,
      eligibility: {
        ok: false,
        message: "Please wait a moment before checking another name.",
      },
    };
  }
  try {
    const provider = configuredRsnProvider();
    const lookup = await lookupPublicStats(rsn, provider);
    const evaluation = evaluateRequirements(
      lookup.profile,
      bossingRequirementsForEvaluation(method),
    );
    return {
      cookie: clientIdentity.setCookie,
      eligibility: {
        ok: true,
        profile: {
          displayName:
            lookup.profile.displayName ?? lookup.profile.normalizedRsn,
          fetchedAt: lookup.profile.fetchedAt,
          provider: lookup.profile.provider,
          cached: lookup.cached,
        },
        ...evaluation,
      },
    };
  } catch (error) {
    const message =
      error instanceof RsnNotFoundError
        ? "No public Old School RuneScape statistics were found for that name."
        : error instanceof RsnProviderDataError ||
            error instanceof RsnProviderUnavailableError
          ? "Public statistics could not be checked right now."
          : "The eligibility check could not be completed safely.";
    return {
      cookie: clientIdentity.setCookie,
      eligibility: { ok: false, message },
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = estimateInputSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { ok: false, message: safeValidationMessage(parsed.error) },
        400,
      );
    }
    const input = parsed.data;
    const flag = await prisma.featureFlag.findUnique({
      where: { key: "bossing_calculator_enabled" },
      select: { enabled: true },
    });
    if (!flag?.enabled) {
      return json(
        {
          ok: false,
          message: "The bossing calculator is temporarily unavailable.",
        },
        404,
      );
    }

    const service = await loadBossingEstimateService(input);
    const boss = service?.bossingBosses[0];
    const method = boss?.methods[0];
    if (!service || !boss || !method || !service.bossingRule) {
      return json(
        { ok: false, message: "Choose an available boss and method." },
        400,
      );
    }
    if (
      !service.gameModes.some(({ gameMode }) => gameMode === input.gameMode)
    ) {
      return json(
        { ok: false, message: "Choose a supported account mode." },
        400,
      );
    }

    const progress = calculateBossingKillProgress({
      mode: input.killMode,
      killQuantity: input.killQuantity,
      currentKillCount: input.currentKillCount,
      targetKillCount: input.targetKillCount,
    });
    const estimate = calculateBossingEstimate({
      progress,
      method,
      rule: service.bossingRule,
      gameMode: input.gameMode,
      customerGearConfirmed: input.customerGearConfirmed,
      includeSupplies: input.includeSupplies,
      includeDiscordStream: input.includeDiscordStream,
      deliverySpeed: input.deliverySpeed,
    });
    const priced = await applyPublishedPricingIfEnabled({
      source: {
        serviceId: service.id,
        serviceSlug: service.slug,
        categoryId: service.categoryId,
        categorySlug: null,
        engineType: service.engineType,
        currency: "USD",
        baseSubtotalCents: estimate.estimatedTotalCents,
        basePricingLines: estimate.lineItems,
        selectedReferences: {
          bossKey: input.bossKey,
          methodSlug: input.methodSlug,
          killMode: input.killMode,
          gameMode: input.gameMode,
          deliverySpeed: input.deliverySpeed,
        },
        engineConfigurationRevision: {
          id: service.bossingRule.id,
          version: service.version,
        },
      },
    });
    const publicPricing = publicPricingPayload(priced);
    const rsn = await maybeEvaluateRsn(request, input.rsn, method);

    return json(
      {
        ok: true,
        estimate: {
          selectedBoss: boss.name,
          selectedMethod: estimate.methodName,
          accountMode: estimate.accountMode,
          requestedKills: estimate.requestedKills,
          currentKillCount: estimate.currentKillCount,
          targetKillCount: estimate.targetKillCount,
          killMode: estimate.killMode,
          customerGearConfirmed: estimate.customerGearConfirmed,
          includesSupplies: estimate.includesSupplies,
          includesDiscordStream: estimate.includesDiscordStream,
          estimatedHours: estimate.estimatedHours,
          delivery: estimate.delivery,
          lineItems: publicPricing.lineItems,
          globalAdjustmentLines: publicPricing.globalAdjustmentLines,
          minimumMaximumAdjustmentLines:
            publicPricing.minimumMaximumAdjustmentLines,
          pricingRevision: publicPricing.pricingRevision,
          priceSnapshot: publicPricing.priceSnapshot,
          estimatedTotalCents: publicPricing.estimatedTotalCents,
          estimatedTotal: publicPricing.estimatedTotal,
          finalPriceNote: estimate.finalPriceNote,
        },
        eligibility: rsn.eligibility,
      },
      200,
      rsn.cookie,
    );
  } catch (error) {
    if (error instanceof BossingValidationError) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("bossing estimate failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      {
        ok: false,
        message: "The estimate could not be calculated. Please try again.",
      },
      500,
    );
  }
}

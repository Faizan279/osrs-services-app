import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { catalogueGameModes } from "@/lib/catalogue/constants";
import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import { prisma } from "@/lib/db/prisma";
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
import {
  premiumDeliverySpeeds,
  premiumPublicStatMetricKeys,
} from "@/lib/premium/constants";
import {
  calculatePremiumEstimate,
  PremiumValidationError,
} from "@/lib/premium/estimate";

export const dynamic = "force-dynamic";

const statCheckModes = ["RSN", "MANUAL", "NONE"] as const;

const manualStatSchema = z
  .object({
    metricKey: z.enum(premiumPublicStatMetricKeys),
    value: z.number().int().min(0).max(2_277),
  })
  .superRefine((stat, context) => {
    const maximum = stat.metricKey === "total.level" ? 2_277 : 99;
    if (stat.value > maximum) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Manual stat value is outside the supported range.",
      });
    }
  });

const estimateInputSchema = z.object({
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
  rsn: rsnSchema.optional(),
  statCheckMode: z.enum(statCheckModes).default("NONE"),
  manualStats: z
    .array(manualStatSchema)
    .max(premiumPublicStatMetricKeys.length)
    .default([])
    .superRefine((stats, context) => {
      const metricKeys = stats.map(({ metricKey }) => metricKey);
      if (new Set(metricKeys).size !== metricKeys.length) {
        context.addIssue({
          code: "custom",
          path: ["manualStats"],
          message: "Manual stat metrics must be unique.",
        });
      }
    }),
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
  return error.issues[0]?.message ?? "Check the configurator inputs.";
}

async function loadPremiumEstimateService(input: {
  serviceId: string;
  packageSlug: string;
}) {
  return prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(),
      id: input.serviceId,
      engineType: "PREMIUM_SERVICE_CONFIGURATOR",
    },
    include: {
      gameModes: true,
      premiumConfig: true,
      premiumPackages: {
        where: { slug: input.packageSlug, enabled: true },
        take: 1,
        include: {
          requirementGroups: {
            orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
            include: {
              requirements: {
                orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
              },
            },
          },
          faqs: {
            where: { enabled: true },
            orderBy: [{ displayOrder: "asc" }, { question: "asc" }],
          },
        },
      },
      premiumOptions: {
        where: { enabled: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      },
    },
  });
}

function premiumRequirementsForEvaluation(
  premiumPackage: NonNullable<
    Awaited<ReturnType<typeof loadPremiumEstimateService>>
  >["premiumPackages"][number],
) {
  return premiumPackage.requirementGroups.flatMap((group) =>
    group.requirements.map((requirement) => {
      const automatic =
        requirement.verificationMode === "AUTOMATIC" &&
        ["SKILL", "ACCOUNT"].includes(requirement.requirementType) &&
        premiumPublicStatMetricKeys.includes(requirement.metricKey as never);
      return {
        id: requirement.id,
        title: requirement.label,
        description: requirement.description,
        isRequired: requirement.isRequired,
        verificationMode: automatic
          ? ("AUTOMATIC" as const)
          : requirement.verificationMode === "AUTOMATIC"
            ? ("SUPPORT_VERIFIED" as const)
            : requirement.verificationMode,
        customerGuidance: requirement.customerGuidance,
        metricKey: automatic ? requirement.metricKey : null,
        comparisonOperator: automatic ? requirement.comparisonOperator : null,
        requiredValue: automatic ? requirement.requiredValue : null,
        recommendedService: null,
      };
    }),
  );
}

function automaticMetricKeys(
  premiumPackage: NonNullable<
    Awaited<ReturnType<typeof loadPremiumEstimateService>>
  >["premiumPackages"][number],
) {
  return new Set(
    premiumRequirementsForEvaluation(premiumPackage)
      .filter(
        (requirement) =>
          requirement.verificationMode === "AUTOMATIC" && requirement.metricKey,
      )
      .map((requirement) => requirement.metricKey!),
  );
}

async function maybeEvaluateRsn(
  request: NextRequest,
  rsn: string | undefined,
  premiumPackage: NonNullable<
    Awaited<ReturnType<typeof loadPremiumEstimateService>>
  >["premiumPackages"][number],
  rsnEligibilityEnabled: boolean,
) {
  if (!rsn) return { eligibility: null, cookie: null };
  const clientIdentity = requestIdentity(request);
  if (!rsnEligibilityEnabled) {
    return {
      cookie: clientIdentity.setCookie,
      eligibility: {
        ok: false,
        message:
          "Public stat checks are not enabled for this premium service. You can still request review.",
      },
    };
  }
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
          "Public stats checks are temporarily unavailable. You can still use the configurator without RSN lookup.",
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
      premiumRequirementsForEvaluation(premiumPackage),
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
        source: "OFFICIAL_PUBLIC_STATS" as const,
        verificationLabel: "Official public Hiscores lookup.",
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

function manualStatsProfile(
  stats: Array<{ metricKey: string; value: number }>,
) {
  const skillLevels: Record<string, number> = {};
  let totalLevel = 0;
  for (const stat of stats) {
    if (stat.metricKey === "total.level") {
      totalLevel = stat.value;
      continue;
    }
    const [, skill, kind] = stat.metricKey.split(".");
    if (skill && kind === "level") skillLevels[skill] = stat.value;
  }
  return {
    normalizedRsn: "manual-entry",
    displayName: null,
    fetchedAt: new Date().toISOString(),
    provider: "customer-entered",
    totalLevel,
    totalXp: 0,
    skillLevels,
    skillXp: {},
    activityScores: {},
  };
}

function evaluateManualStats(
  input: z.infer<typeof estimateInputSchema>,
  premiumPackage: NonNullable<
    Awaited<ReturnType<typeof loadPremiumEstimateService>>
  >["premiumPackages"][number],
  supportsManualStatFallback: boolean,
) {
  if (input.statCheckMode !== "MANUAL" || input.manualStats.length === 0) {
    return null;
  }
  if (!supportsManualStatFallback) {
    return {
      ok: false,
      message:
        "Manual stat entry is not enabled for this premium service. You can continue without a stat check.",
    };
  }
  const allowedMetricKeys = automaticMetricKeys(premiumPackage);
  const unexpectedMetric = input.manualStats.find(
    ({ metricKey }) => !allowedMetricKeys.has(metricKey),
  );
  if (unexpectedMetric) {
    throw new PremiumValidationError(
      "Manual stats must match configured package requirements.",
    );
  }
  const evaluation = evaluateRequirements(
    manualStatsProfile(input.manualStats),
    premiumRequirementsForEvaluation(premiumPackage),
  );
  return {
    ok: true,
    source: "MANUAL_STATS" as const,
    verificationLabel: "Customer-entered / not independently verified.",
    ...evaluation,
  };
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
      where: { key: "premium_configurator_enabled" },
      select: { enabled: true },
    });
    if (!flag?.enabled) {
      return json(
        {
          ok: false,
          message: "The premium configurator is temporarily unavailable.",
        },
        404,
      );
    }

    const service = await loadPremiumEstimateService(input);
    const premiumPackage = service?.premiumPackages[0];
    if (
      !service ||
      !premiumPackage ||
      !service.premiumConfig ||
      !service.premiumConfig.enabled
    ) {
      return json(
        { ok: false, message: "Choose an available premium package." },
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

    const optionsForPackage = service.premiumOptions.filter(
      (option) => !option.packageId || option.packageId === premiumPackage.id,
    );
    const estimate = calculatePremiumEstimate({
      package: premiumPackage,
      rule: service.premiumConfig,
      availableOptions: optionsForPackage,
      selectedOptions: input.optionSelections,
      gameMode: input.gameMode,
      customerGearConfirmed: input.customerGearConfirmed,
      includeDiscordStream: input.includeDiscordStream,
      deliverySpeed: input.deliverySpeed,
    });
    const selectedOptionNames = input.optionSelections.map((selection) => {
      const option = optionsForPackage.find(
        (candidate) => candidate.slug === selection.slug,
      );
      return {
        slug: selection.slug,
        name: option?.name ?? selection.slug,
        quantity: selection.quantity ?? option?.defaultQuantity ?? 1,
      };
    });
    const rsn = await maybeEvaluateRsn(
      request,
      input.rsn,
      premiumPackage,
      service.premiumConfig.rsnEligibilityEnabled,
    );
    const manualEligibility =
      rsn.eligibility?.ok === true
        ? null
        : evaluateManualStats(
            input,
            premiumPackage,
            service.premiumConfig.supportsManualStatFallback,
          );

    return json(
      {
        ok: true,
        estimate: {
          selectedPackage: estimate.packageName,
          selectedOptions: selectedOptionNames,
          accountMode: estimate.accountMode,
          customerGearConfirmed: estimate.customerGearConfirmed,
          includesDiscordStream: estimate.includesDiscordStream,
          estimatedHours: estimate.estimatedHours,
          delivery: estimate.delivery,
          lineItems: estimate.lineItems,
          estimatedTotalCents: estimate.estimatedTotalCents,
          estimatedTotal: estimate.estimatedTotal,
          finalPriceNote: estimate.finalPriceNote,
        },
        eligibility: rsn.eligibility?.ok
          ? rsn.eligibility
          : (manualEligibility ?? rsn.eligibility),
      },
      200,
      rsn.cookie,
    );
  } catch (error) {
    if (error instanceof PremiumValidationError) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("premium estimate failed", {
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

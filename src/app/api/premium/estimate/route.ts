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
import { premiumDeliverySpeeds } from "@/lib/premium/constants";
import {
  calculatePremiumEstimate,
  PremiumValidationError,
} from "@/lib/premium/estimate";

export const dynamic = "force-dynamic";

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
    group.requirements.map((requirement) => ({
      id: requirement.id,
      title: requirement.label,
      description: requirement.description,
      isRequired: requirement.isRequired,
      verificationMode: requirement.verificationMode,
      customerGuidance: requirement.customerGuidance,
      metricKey: requirement.metricKey,
      comparisonOperator:
        requirement.verificationMode === "AUTOMATIC"
          ? ("GREATER_THAN_OR_EQUAL" as const)
          : null,
      requiredValue:
        requirement.verificationMode === "AUTOMATIC"
          ? requirement.requiredValue
          : null,
      recommendedService: null,
    })),
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
    if (!service || !premiumPackage || !service.premiumConfig) {
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
        eligibility: rsn.eligibility,
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

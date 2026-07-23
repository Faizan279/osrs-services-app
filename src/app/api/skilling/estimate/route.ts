import { NextResponse } from "next/server";
import { z } from "zod";

import { catalogueGameModes } from "@/lib/catalogue/constants";
import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import { prisma } from "@/lib/db/prisma";
import { publicPricingPayload } from "@/lib/pricing/public-response";
import { applyPublishedPricingIfEnabled } from "@/lib/pricing/server";
import {
  skillingDeliverySpeeds,
  skillingInputModes,
  skillingSkillKeys,
} from "@/lib/skilling/constants";
import { calculateSkillingEstimate } from "@/lib/skilling/estimate";
import {
  calculateLevelProgress,
  calculateXpProgress,
  SkillingValidationError,
} from "@/lib/skilling/xp";

export const dynamic = "force-dynamic";

const estimateInputSchema = z
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

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the calculator inputs.";
}

export async function POST(request: Request) {
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
      where: { key: "skilling_calculator_enabled" },
      select: { enabled: true },
    });
    if (!flag?.enabled) {
      return json(
        {
          ok: false,
          message: "The skilling calculator is temporarily unavailable.",
        },
        404,
      );
    }

    const service = await prisma.catalogueService.findFirst({
      where: {
        ...publicCatalogueWhere(),
        id: input.serviceId,
        engineType: "SKILLING_CALCULATOR",
      },
      include: {
        gameModes: true,
        skillingRule: true,
        skillingSkills: {
          where: { skillKey: input.skillKey, enabled: true },
          take: 1,
          include: {
            methods: {
              where: { slug: input.methodSlug, enabled: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!service) {
      return json(
        { ok: false, message: "This calculator is not available." },
        404,
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
    const skill = service.skillingSkills[0];
    const method = skill?.methods[0];
    if (!skill || !method || !service.skillingRule) {
      return json(
        { ok: false, message: "Choose an available training method." },
        400,
      );
    }

    const progress =
      input.inputMode === "LEVEL"
        ? calculateLevelProgress({
            currentLevel: input.currentLevel!,
            targetLevel: input.targetLevel!,
          })
        : calculateXpProgress({
            currentXp: input.currentXp!,
            targetXp: input.targetXp!,
          });
    const estimate = calculateSkillingEstimate({
      progress,
      method,
      rule: service.skillingRule,
      gameMode: input.gameMode,
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
          skillKey: input.skillKey,
          methodSlug: input.methodSlug,
          inputMode: input.inputMode,
          gameMode: input.gameMode,
          deliverySpeed: input.deliverySpeed,
        },
        engineConfigurationRevision: {
          id: service.skillingRule.id,
          version: service.version,
        },
      },
    });
    const publicPricing = publicPricingPayload(priced);

    return json({
      ok: true,
      estimate: {
        skillName: skill.name,
        selectedSkill: skill.name,
        selectedMethod: estimate.methodName,
        accountMode: estimate.accountMode,
        currentLevel: estimate.currentLevel,
        targetLevel: estimate.targetLevel,
        currentXp: estimate.currentXp,
        targetXp: estimate.targetXp,
        xpRequired: estimate.xpRequired,
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
    });
  } catch (error) {
    if (error instanceof SkillingValidationError) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("skilling estimate failed", error);
    return json(
      {
        ok: false,
        message: "The estimate could not be calculated. Please try again.",
      },
      500,
    );
  }
}

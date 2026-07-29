import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CustomBuildEstimateError } from "@/lib/custom-build/estimate";
import { assertNoCredentialLikeKeys } from "@/lib/custom-build/security";
import {
  calculateServerCustomBuildEstimate,
  publicCustomBuildEstimatePayload,
} from "@/lib/custom-build/server";
import { catalogueGameModes } from "@/lib/catalogue/constants";
import { SkillingValidationError } from "@/lib/skilling/xp";

export const dynamic = "force-dynamic";

const skillSchema = z.object({
  skillKey: z.enum([
    "ATTACK",
    "STRENGTH",
    "DEFENCE",
    "RANGED",
    "PRAYER",
    "MAGIC",
    "RUNECRAFT",
    "CONSTRUCTION",
    "HITPOINTS",
    "AGILITY",
    "HERBLORE",
    "THIEVING",
    "CRAFTING",
    "FLETCHING",
    "SLAYER",
    "HUNTER",
    "MINING",
    "SMITHING",
    "FISHING",
    "COOKING",
    "FIREMAKING",
    "WOODCUTTING",
    "FARMING",
  ]),
  valueMode: z.enum(["LEVEL", "XP", "UNKNOWN_CURRENT", "FRESH_ACCOUNT"]),
  currentLevel: z.number().int().min(1).max(99).nullable().optional(),
  targetLevel: z.number().int().min(1).max(99).nullable().optional(),
  currentXp: z
    .union([z.number().int().min(0), z.string()])
    .nullable()
    .optional(),
  targetXp: z
    .union([z.number().int().min(0), z.string()])
    .nullable()
    .optional(),
  freshStart: z.boolean().optional(),
});

const estimateInputSchema = z.object({
  serviceSlug: z.string().trim().min(1).max(180).optional(),
  gameMode: z.enum(catalogueGameModes),
  skills: z.array(skillSchema).max(23).default([]),
  objectives: z
    .array(
      z.object({
        stableKey: z.string().trim().min(1).max(160),
        customerAlreadyCompleted: z.boolean().optional(),
      }),
    )
    .max(50)
    .default([]),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    assertNoCredentialLikeKeys(body);
    const parsed = estimateInputSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? "Check the build inputs.",
        },
        400,
      );
    }
    const estimate = await calculateServerCustomBuildEstimate(parsed.data);
    return json({
      ok: true,
      estimate: publicCustomBuildEstimatePayload(estimate),
    });
  } catch (error) {
    if (
      error instanceof CustomBuildEstimateError ||
      error instanceof SkillingValidationError
    ) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("custom build estimate failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      {
        ok: false,
        message:
          "The custom build estimate could not be calculated. Please try again.",
      },
      500,
    );
  }
}

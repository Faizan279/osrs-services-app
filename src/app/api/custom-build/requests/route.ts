import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CustomBuildEstimateError } from "@/lib/custom-build/estimate";
import {
  CustomBuildSecurityError,
  assertNoCredentialLikeKeys,
} from "@/lib/custom-build/security";
import { submitCustomBuildRequest } from "@/lib/custom-build/server";
import { catalogueGameModes } from "@/lib/catalogue/constants";

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

const requestInputSchema = z.object({
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
  displayName: z.unknown(),
  email: z.unknown(),
  discordUsername: z.unknown().optional(),
  rsn: z.unknown().optional(),
  customerNotes: z.string().max(5000).optional(),
  consentAccepted: z.boolean(),
  consentPolicyVersion: z.string().trim().max(80).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function rateLimitKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "custom-build:anonymous"
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    assertNoCredentialLikeKeys(body);
    const parsed = requestInputSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          ok: false,
          message:
            parsed.error.issues[0]?.message ?? "Check the request details.",
        },
        400,
      );
    }
    const result = await submitCustomBuildRequest({
      ...parsed.data,
      rateLimitKey: rateLimitKey(request),
    });
    return json({ ok: true, request: result });
  } catch (error) {
    if (
      error instanceof CustomBuildEstimateError ||
      error instanceof CustomBuildSecurityError ||
      error instanceof z.ZodError
    ) {
      return json(
        {
          ok: false,
          message:
            error instanceof z.ZodError
              ? (error.issues[0]?.message ?? "Check the request details.")
              : error.message,
        },
        400,
      );
    }
    console.error("custom build request failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      {
        ok: false,
        message:
          "The custom build request could not be submitted. Please try again.",
      },
      500,
    );
  }
}

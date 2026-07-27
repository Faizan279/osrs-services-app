import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { goldTradeDirections } from "@/lib/gold/constants";
import { GoldValidationError } from "@/lib/gold/estimate";
import {
  calculateServerGoldEstimate,
  publicGoldEstimatePayload,
} from "@/lib/gold/server";
import { rsnSchema } from "@/lib/eligibility/rsn";

export const dynamic = "force-dynamic";

const optionalRsnSchema = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text || undefined;
}, rsnSchema.optional());

const estimateInputSchema = z.object({
  serviceId: z.string().trim().min(1).max(30).optional(),
  marketId: z.string().trim().min(1).max(30).optional(),
  direction: z.enum(goldTradeDirections),
  quantity: z.string().trim().min(1).max(80).default(""),
  presetId: z.string().trim().min(1).max(30).optional(),
  secureServiceSelected: z.boolean().default(false),
  rsn: optionalRsnSchema,
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function safeValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the gold estimate inputs.";
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
    const estimate = await calculateServerGoldEstimate(parsed.data);
    return json({ ok: true, estimate: publicGoldEstimatePayload(estimate) });
  } catch (error) {
    if (error instanceof GoldValidationError) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("gold estimate failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      {
        ok: false,
        message: "The gold estimate could not be calculated. Please try again.",
      },
      500,
    );
  }
}

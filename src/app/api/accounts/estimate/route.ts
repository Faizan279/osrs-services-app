import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AccountMarketplaceValidationError } from "@/lib/accounts/estimate";
import {
  calculateServerAccountListingEstimate,
  publicAccountEstimatePayload,
} from "@/lib/accounts/server";

export const dynamic = "force-dynamic";

const estimateInputSchema = z.object({
  listingId: z.string().trim().min(1).max(30).optional(),
  listingSlug: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function safeValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Choose an account listing.";
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
    const estimate = await calculateServerAccountListingEstimate(parsed.data);
    return json({
      ok: true,
      estimate: publicAccountEstimatePayload(estimate),
    });
  } catch (error) {
    if (error instanceof AccountMarketplaceValidationError) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("account estimate failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      {
        ok: false,
        message:
          "The account listing estimate could not be calculated. Please try again.",
      },
      500,
    );
  }
}

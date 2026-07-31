import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ProductMarketplaceValidationError } from "@/lib/products/estimate";
import {
  calculateServerProductEstimate,
  publicProductEstimatePayload,
} from "@/lib/products/server";

export const dynamic = "force-dynamic";

const estimateInputSchema = z.object({
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

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function safeValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Choose a product and quantity.";
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
    const estimate = await calculateServerProductEstimate(parsed.data);
    return json({
      ok: true,
      estimate: publicProductEstimatePayload(estimate),
    });
  } catch (error) {
    if (error instanceof ProductMarketplaceValidationError) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("product estimate failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      {
        ok: false,
        message:
          "The product estimate could not be calculated. Please try again.",
      },
      500,
    );
  }
}

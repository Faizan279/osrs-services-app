import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CART_COOKIE_NAME } from "@/lib/checkout/constants";
import { revalidateCart, sanitizeCartError } from "@/lib/checkout/cart";

export const dynamic = "force-dynamic";

const revalidateSchema = z.object({
  acceptUpdatedTotals: z.boolean().default(false),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const parsed = revalidateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json(
        { ok: false, message: "Check the revalidation request." },
        400,
      );
    }
    const result = await revalidateCart({
      rawToken: request.cookies.get(CART_COOKIE_NAME)?.value,
      acceptUpdatedTotals: parsed.data.acceptUpdatedTotals,
    });
    return json({ ok: true, ...result });
  } catch (error) {
    const safe = sanitizeCartError(error);
    return json({ ok: false, message: safe.message }, safe.status);
  }
}

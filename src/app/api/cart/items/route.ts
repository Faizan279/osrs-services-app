import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CART_COOKIE_NAME } from "@/lib/checkout/constants";
import { addCartItem, sanitizeCartError } from "@/lib/checkout/cart";

export const dynamic = "force-dynamic";

const cartItemKinds = [
  "SKILLING_ESTIMATE",
  "BOSSING_ESTIMATE",
  "PREMIUM_ESTIMATE",
  "PRODUCT_ESTIMATE",
  "ACCOUNT_LISTING_ESTIMATE",
  "GOLD_BUY_ESTIMATE",
  "ACCEPTED_CUSTOM_BUILD_QUOTE",
] as const;

const addItemSchema = z.object({
  kind: z.enum(cartItemKinds),
  source: z.unknown(),
  quantity: z.union([z.string().trim().max(80), z.number().int()]).optional(),
  serviceDetails: z.unknown().optional(),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const parsed = addItemSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? "Check the cart item.",
        },
        400,
      );
    }
    const { idempotencyKey, ...input } = parsed.data;
    const result = await addCartItem({
      rawToken: request.cookies.get(CART_COOKIE_NAME)?.value,
      input,
      idempotencyKey,
    });
    const response = json({ ok: true, cart: result.cart });
    if (result.cookie) {
      response.cookies.set(
        result.cookie.name,
        result.cookie.value,
        result.cookie.options,
      );
    }
    return response;
  } catch (error) {
    const safe = sanitizeCartError(error);
    return json({ ok: false, message: safe.message }, safe.status);
  }
}

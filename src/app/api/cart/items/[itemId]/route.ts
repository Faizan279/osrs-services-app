import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CART_COOKIE_NAME } from "@/lib/checkout/constants";
import {
  removeCartItem,
  sanitizeCartError,
  updateCartItemQuantity,
} from "@/lib/checkout/cart";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  quantity: z.union([z.string().trim().max(80), z.number().int()]),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json(
        {
          ok: false,
          message:
            parsed.error.issues[0]?.message ?? "Choose a valid quantity.",
        },
        400,
      );
    }
    const cart = await updateCartItemQuantity({
      rawToken: request.cookies.get(CART_COOKIE_NAME)?.value,
      itemId,
      quantity: parsed.data.quantity,
    });
    return json({ ok: true, cart });
  } catch (error) {
    const safe = sanitizeCartError(error);
    return json({ ok: false, message: safe.message }, safe.status);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const cart = await removeCartItem({
      rawToken: request.cookies.get(CART_COOKIE_NAME)?.value,
      itemId,
    });
    return json({ ok: true, cart });
  } catch (error) {
    const safe = sanitizeCartError(error);
    return json({ ok: false, message: safe.message }, safe.status);
  }
}

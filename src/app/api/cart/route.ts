import { NextRequest, NextResponse } from "next/server";

import { CART_COOKIE_NAME } from "@/lib/checkout/constants";
import { getPublicCart, sanitizeCartError } from "@/lib/checkout/cart";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(request: NextRequest) {
  try {
    const result = await getPublicCart(
      request.cookies.get(CART_COOKIE_NAME)?.value,
    );
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

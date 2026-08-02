import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CART_COOKIE_NAME } from "@/lib/checkout/constants";
import {
  sanitizeCheckoutError,
  submitGuestCheckout,
} from "@/lib/checkout/orders";
import { getCurrentCustomerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  contact: z.object({
    displayName: z.unknown(),
    email: z.unknown(),
    discordUsername: z.unknown().optional(),
    rsn: z.unknown().optional(),
  }),
  paymentMethodStableKey: z.string().trim().min(1).max(120).optional(),
  termsAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
  acceptedUpdatedTotals: z.boolean().default(false),
  serviceDetails: z.unknown().optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json(
        {
          ok: false,
          message:
            parsed.error.issues[0]?.message ?? "Check the checkout details.",
        },
        400,
      );
    }
    const customerSession = await getCurrentCustomerSession();
    const result = await submitGuestCheckout({
      ...parsed.data,
      rawCartToken: request.cookies.get(CART_COOKIE_NAME)?.value,
      authenticatedCustomer: customerSession
        ? {
            userId: customerSession.user.id,
            email: customerSession.user.email,
          }
        : null,
    });
    const response = json({ ok: true, ...result });
    if ("cookie" in result && result.cookie) {
      response.cookies.set(
        result.cookie.name,
        result.cookie.value,
        result.cookie.options,
      );
    }
    return response;
  } catch (error) {
    const safe = sanitizeCheckoutError(error);
    return json({ ok: false, message: safe.message }, safe.status);
  }
}

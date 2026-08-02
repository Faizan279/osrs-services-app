import { NextRequest } from "next/server";
import { z } from "zod";

import { customerJson, attachPublicClientCookie } from "@/lib/customer/api";
import {
  registerCustomer,
  sanitizeCustomerError,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.unknown(),
  password: z.unknown(),
  passwordConfirmation: z.unknown(),
  displayName: z.unknown(),
  discordUsername: z.unknown().optional(),
  defaultRsn: z.unknown().optional(),
  termsAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
  orderTrackingToken: z.string().trim().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const { response: baseResponse, context } = attachPublicClientCookie(
    customerJson({ ok: true }),
    request,
  );
  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return customerJson(
        { ok: false, message: "Check the account details." },
        400,
      );
    }
    const result = await registerCustomer(parsed.data, context);
    const response = customerJson({
      ok: true,
      user: { email: result.user.email, name: result.user.name },
      emailDeliveryStatus: result.emailDeliveryStatus,
    });
    for (const cookie of baseResponse.cookies.getAll()) {
      response.cookies.set(cookie.name, cookie.value, cookie);
    }
    return response;
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    const response = customerJson(
      { ok: false, message: safe.message },
      safe.status,
    );
    for (const cookie of baseResponse.cookies.getAll()) {
      response.cookies.set(cookie.name, cookie.value, cookie);
    }
    return response;
  }
}

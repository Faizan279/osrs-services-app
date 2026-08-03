import { NextRequest } from "next/server";
import { z } from "zod";

import { customerJson, requireCustomerApiSession } from "@/lib/customer/api";
import {
  getCustomerNotificationPreferences,
  sanitizeCustomerError,
  updateCustomerNotificationPreference,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

const preferenceSchema = z.object({
  type: z.enum([
    "ACCOUNT",
    "SECURITY",
    "ORDER_CREATED",
    "ORDER_STATUS_CHANGED",
    "ORDER_PAYMENT_CHANGED",
    "EMAIL_VERIFICATION",
    "PASSWORD_RECOVERY",
  ]),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  marketingConsent: z.boolean(),
  expectedVersion: z.number().int().positive(),
});

export async function GET() {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    const preferences = await getCustomerNotificationPreferences(
      session.user.id,
    );
    return customerJson({ ok: true, preferences });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    const parsed = preferenceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return customerJson(
        { ok: false, message: "Check the preference details." },
        400,
      );
    }
    await updateCustomerNotificationPreference(session.user.id, parsed.data);
    return customerJson({ ok: true });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";

import { customerJson, requireCustomerApiSession } from "@/lib/customer/api";
import {
  changeCustomerPassword,
  sanitizeCustomerError,
} from "@/lib/customer/account";
import { requestCustomerIdentity } from "@/lib/customer/security";

export const dynamic = "force-dynamic";

const passwordSchema = z.object({
  currentPassword: z.unknown(),
  newPassword: z.unknown(),
  newPasswordConfirmation: z.unknown(),
});

export async function POST(request: NextRequest) {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    const parsed = passwordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return customerJson(
        { ok: false, message: "Check the password details." },
        400,
      );
    }
    const context = requestCustomerIdentity(request);
    await changeCustomerPassword(session.user.id, parsed.data, {
      ...context,
      sessionId: session.id,
    });
    return customerJson({ ok: true });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

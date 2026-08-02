import { NextRequest } from "next/server";
import { z } from "zod";

import { customerJson } from "@/lib/customer/api";
import {
  resetCustomerPasswordWithToken,
  sanitizeCustomerError,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
  token: z.string().trim(),
  password: z.unknown(),
  passwordConfirmation: z.unknown(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = resetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return customerJson(
        { ok: false, message: "Password reset link is invalid." },
        400,
      );
    }
    await resetCustomerPasswordWithToken(parsed.data);
    return customerJson({ ok: true });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

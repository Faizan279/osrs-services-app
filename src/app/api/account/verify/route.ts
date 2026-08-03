import { NextRequest } from "next/server";
import { z } from "zod";

import { customerJson } from "@/lib/customer/api";
import {
  sanitizeCustomerError,
  verifyCustomerEmailToken,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

const verifySchema = z.object({ token: z.string().trim() });

export async function POST(request: NextRequest) {
  try {
    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) {
      return customerJson(
        { ok: false, message: "Verification link is invalid." },
        400,
      );
    }
    const result = await verifyCustomerEmailToken(parsed.data.token);
    return customerJson(result);
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

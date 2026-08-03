import { NextRequest } from "next/server";
import { z } from "zod";

import { customerJson, attachPublicClientCookie } from "@/lib/customer/api";
import {
  requestPasswordRecovery,
  sanitizeCustomerError,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

const recoverySchema = z.object({ email: z.unknown() });

export async function POST(request: NextRequest) {
  const { response: baseResponse, context } = attachPublicClientCookie(
    customerJson({ ok: true }),
    request,
  );
  try {
    const parsed = recoverySchema.safeParse(await request.json());
    const result = await requestPasswordRecovery(
      parsed.success ? parsed.data : { email: "" },
      context,
    );
    const response = customerJson({ ok: true, ...result });
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

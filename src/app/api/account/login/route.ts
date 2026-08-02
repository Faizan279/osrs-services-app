import { NextRequest } from "next/server";
import { z } from "zod";

import { customerJson, attachPublicClientCookie } from "@/lib/customer/api";
import { loginCustomer, sanitizeCustomerError } from "@/lib/customer/account";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.unknown(),
  password: z.unknown(),
});

export async function POST(request: NextRequest) {
  const { response: baseResponse, context } = attachPublicClientCookie(
    customerJson({ ok: true }),
    request,
  );
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return customerJson(
        { ok: false, message: "Email or password is incorrect." },
        401,
      );
    }
    const result = await loginCustomer(parsed.data, context);
    const response = customerJson({
      ok: true,
      user: { email: result.user.email, name: result.user.name },
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

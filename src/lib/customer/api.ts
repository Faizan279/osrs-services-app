import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as ResponseFactory } from "next/server";

import { getCurrentCustomerSession } from "@/lib/auth/session";
import { requestCustomerIdentity } from "@/lib/customer/security";

export function customerJson(body: unknown, status = 200) {
  return ResponseFactory.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export function attachPublicClientCookie(
  response: NextResponse,
  request: NextRequest,
) {
  const context = requestCustomerIdentity(request);
  if (context.setCookie) {
    response.cookies.set(
      context.setCookie.name,
      context.setCookie.value,
      context.setCookie.options,
    );
  }
  return { response, context };
}

export async function requireCustomerApiSession() {
  const session = await getCurrentCustomerSession();
  if (!session) {
    return {
      session: null,
      response: customerJson({ ok: false, message: "Sign in required." }, 401),
    };
  }
  return { session, response: null };
}

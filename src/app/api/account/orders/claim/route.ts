import { NextRequest } from "next/server";
import { z } from "zod";

import { customerJson, requireCustomerApiSession } from "@/lib/customer/api";
import {
  claimOrderWithTrackingToken,
  sanitizeCustomerError,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

const claimSchema = z.object({ trackingToken: z.string().trim() });

export async function POST(request: NextRequest) {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    const parsed = claimSchema.safeParse(await request.json());
    if (!parsed.success) {
      return customerJson(
        { ok: false, message: "Order tracking link is invalid." },
        400,
      );
    }
    const result = await claimOrderWithTrackingToken(
      session.user.id,
      parsed.data.trackingToken,
    );
    return customerJson({ ok: true, ...result });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

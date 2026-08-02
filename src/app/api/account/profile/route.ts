import { NextRequest } from "next/server";
import { z } from "zod";

import { customerJson, requireCustomerApiSession } from "@/lib/customer/api";
import {
  getCustomerProfile,
  sanitizeCustomerError,
  updateCustomerProfile,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  displayName: z.unknown(),
  discordUsername: z.unknown().optional(),
  defaultRsn: z.unknown().optional(),
  timezone: z.unknown().optional(),
  locale: z.unknown().optional(),
  expectedVersion: z.number().int().positive(),
});

export async function GET() {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  const profile = await getCustomerProfile(session.user.id);
  return customerJson({ ok: true, profile });
}

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return customerJson(
        { ok: false, message: "Check the profile details." },
        400,
      );
    }
    const profile = await updateCustomerProfile(session.user.id, parsed.data);
    return customerJson({ ok: true, profile });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

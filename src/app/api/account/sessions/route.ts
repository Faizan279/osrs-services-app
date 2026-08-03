import { customerJson, requireCustomerApiSession } from "@/lib/customer/api";
import {
  listCustomerSessions,
  sanitizeCustomerError,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    const sessions = await listCustomerSessions(session.user.id);
    return customerJson({ ok: true, sessions, currentSessionId: session.id });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

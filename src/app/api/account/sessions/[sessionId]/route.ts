import { customerJson, requireCustomerApiSession } from "@/lib/customer/api";
import {
  revokeOwnCustomerSession,
  sanitizeCustomerError,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    const { sessionId } = await params;
    await revokeOwnCustomerSession(session.user.id, sessionId);
    return customerJson({ ok: true });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

import { customerJson, requireCustomerApiSession } from "@/lib/customer/api";
import {
  markCustomerNotificationRead,
  sanitizeCustomerError,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    const { notificationId } = await params;
    await markCustomerNotificationRead(session.user.id, notificationId);
    return customerJson({ ok: true });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

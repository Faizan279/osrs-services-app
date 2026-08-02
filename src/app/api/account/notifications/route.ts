import { customerJson, requireCustomerApiSession } from "@/lib/customer/api";
import {
  getCustomerNotifications,
  markAllCustomerNotificationsRead,
  sanitizeCustomerError,
} from "@/lib/customer/account";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    const notifications = await getCustomerNotifications(session.user.id);
    return customerJson({ ok: true, notifications });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

export async function PATCH() {
  const { session, response } = await requireCustomerApiSession();
  if (!session) return response;
  try {
    await markAllCustomerNotificationsRead(session.user.id);
    return customerJson({ ok: true });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

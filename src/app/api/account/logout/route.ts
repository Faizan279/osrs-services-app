import { customerJson, requireCustomerApiSession } from "@/lib/customer/api";
import { logoutCustomer, sanitizeCustomerError } from "@/lib/customer/account";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { session } = await requireCustomerApiSession();
    await logoutCustomer(session?.user.id);
    return customerJson({ ok: true });
  } catch (error) {
    const safe = sanitizeCustomerError(error);
    return customerJson({ ok: false, message: safe.message }, safe.status);
  }
}

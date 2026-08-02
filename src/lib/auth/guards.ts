import "server-only";

import { forbidden, redirect } from "next/navigation";

import { hasCapability } from "@/lib/auth/capabilities";
import type { PermissionKey } from "@/lib/auth/permissions";
import { getCurrentSession } from "@/lib/auth/session";

export async function requireUser(returnTo: string) {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

export async function requireCustomer(returnTo: string) {
  const session = await getCurrentSession("CUSTOMER");
  if (!session) {
    redirect(`/account/login?next=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

export async function requireCapability(
  capability: PermissionKey,
  returnTo: string,
) {
  const session = await requireUser(returnTo);
  if (!hasCapability(session.capabilities, capability)) {
    forbidden();
  }
  return session;
}

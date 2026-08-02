import type { PermissionKey } from "@/lib/auth/permissions";

export function hasCapability(
  capabilities: ReadonlySet<string> | readonly string[],
  capability: PermissionKey,
) {
  return new Set(capabilities).has(capability);
}

export function canAccessPath(
  pathname: string,
  session: {
    capabilities: ReadonlySet<string> | readonly string[];
    user?: { accountType?: "STAFF" | "CUSTOMER" };
  } | null,
) {
  if (pathname.startsWith("/account")) {
    return session?.user?.accountType === "CUSTOMER";
  }

  if (pathname.startsWith("/admin/design-system")) {
    return Boolean(
      session && hasCapability(session.capabilities, "design_system.view"),
    );
  }

  if (pathname.startsWith("/admin")) {
    return Boolean(
      session && hasCapability(session.capabilities, "admin.access"),
    );
  }

  return true;
}

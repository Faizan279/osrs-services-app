import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin-shell";
import { requireCapability } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireCapability("admin.access", "/admin");
  return <AdminShell user={session.user}>{children}</AdminShell>;
}

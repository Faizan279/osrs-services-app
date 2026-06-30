import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/guards";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser("/account");
  return children;
}

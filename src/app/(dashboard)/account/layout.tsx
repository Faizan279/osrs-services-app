import type { ReactNode } from "react";

import {
  CustomerAccountShell,
  CustomerUnavailablePanel,
} from "@/components/customer-account-shell";
import { dashboardUnavailableMessage } from "@/lib/customer/constants";
import { requireCustomer } from "@/lib/auth/guards";
import { getCustomerAvailability } from "@/lib/customer/account";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireCustomer("/account");
  const availability = await getCustomerAvailability();
  if (
    !availability.accountsEnabled ||
    !availability.dashboardEnabled ||
    !availability.settings?.dashboardEnabled
  ) {
    return <CustomerUnavailablePanel message={dashboardUnavailableMessage} />;
  }
  return (
    <CustomerAccountShell user={session.user}>{children}</CustomerAccountShell>
  );
}

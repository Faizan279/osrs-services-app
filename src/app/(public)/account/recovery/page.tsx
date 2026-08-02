import Link from "next/link";

import { CustomerRecoveryForm } from "@/components/customer-account-forms";
import { Badge } from "@/components/ui/badge";
import { getCustomerAvailability } from "@/lib/customer/account";
import {
  customerUnavailableMessage,
  providerNotConfiguredMessage,
} from "@/lib/customer/constants";

export const metadata = {
  title: "Customer account recovery",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CustomerRecoveryPage() {
  const availability = await getCustomerAvailability();
  const disabled = !availability.accountsEnabled;

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <section>
          <Badge variant="info">Recovery foundation</Badge>
          <h1 className="display-type mt-5 max-w-2xl text-5xl leading-tight text-white">
            Recover account access
          </h1>
          <p className="text-text-secondary mt-5 max-w-2xl text-sm leading-6">
            Recovery responses do not reveal whether an email exists. Task 014
            does not send live email.
          </p>
          <p className="border-gold/25 bg-gold/10 mt-6 rounded-xl border p-4 text-sm">
            {disabled
              ? customerUnavailableMessage
              : providerNotConfiguredMessage}
          </p>
        </section>
        <section className="surface-panel rounded-2xl p-6 sm:p-8">
          <CustomerRecoveryForm disabled={disabled} />
          <p className="text-text-muted mt-5 text-sm">
            Remembered it?{" "}
            <Link className="text-primary font-bold" href="/account/login">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

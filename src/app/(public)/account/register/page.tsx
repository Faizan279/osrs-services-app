import Link from "next/link";

import { CustomerRegisterForm } from "@/components/customer-account-forms";
import { Badge } from "@/components/ui/badge";
import { getCustomerAvailability } from "@/lib/customer/account";
import {
  customerUnavailableMessage,
  registrationUnavailableMessage,
} from "@/lib/customer/constants";

export const metadata = {
  title: "Customer registration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CustomerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ trackingToken?: string }>;
}) {
  const { trackingToken = null } = await searchParams;
  const availability = await getCustomerAvailability();
  const disabled =
    !availability.accountsEnabled ||
    !availability.registrationEnabled ||
    !availability.settings?.registrationEnabled;
  const message = !availability.accountsEnabled
    ? customerUnavailableMessage
    : registrationUnavailableMessage;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_34rem]">
        <section>
          <Badge variant="info">Optional account</Badge>
          <h1 className="display-type mt-5 max-w-2xl text-5xl leading-tight text-white">
            Create a customer account
          </h1>
          <p className="text-text-secondary mt-5 max-w-2xl text-sm leading-6">
            Registration never creates staff roles or permissions. Guest order
            contacts remain immutable after account creation.
          </p>
          {disabled ? (
            <p className="border-warning/35 bg-warning/10 mt-6 rounded-xl border p-4 text-sm">
              {message}
            </p>
          ) : null}
        </section>
        <section className="surface-panel rounded-2xl p-6 sm:p-8">
          <CustomerRegisterForm
            disabled={disabled}
            trackingToken={trackingToken}
          />
          <p className="text-text-muted mt-5 text-sm">
            Already registered?{" "}
            <Link className="text-primary font-bold" href="/account/login">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

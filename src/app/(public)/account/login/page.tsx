import Link from "next/link";

import { CustomerLoginForm } from "@/components/customer-account-forms";
import { Badge } from "@/components/ui/badge";
import { getCustomerAvailability } from "@/lib/customer/account";
import { customerUnavailableMessage } from "@/lib/customer/constants";

export const metadata = {
  title: "Customer sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/account" } = await searchParams;
  const availability = await getCustomerAvailability();
  const disabled = !availability.accountsEnabled;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <section>
          <Badge variant="info">Customer portal</Badge>
          <h1 className="display-type mt-5 max-w-2xl text-5xl leading-tight text-white">
            Customer sign in
          </h1>
          <p className="text-text-secondary mt-5 max-w-2xl text-sm leading-6">
            Access order status, payment state, security controls, and in-app
            updates from a customer-only session.
          </p>
          {disabled ? (
            <p className="border-warning/35 bg-warning/10 mt-6 rounded-xl border p-4 text-sm">
              {customerUnavailableMessage}
            </p>
          ) : null}
        </section>
        <section className="surface-panel rounded-2xl p-6 sm:p-8">
          <CustomerLoginForm next={next} disabled={disabled} />
          <p className="text-text-muted mt-5 text-sm">
            Need an account?{" "}
            <Link className="text-primary font-bold" href="/account/register">
              Register
            </Link>
          </p>
          <p className="text-text-muted mt-2 text-sm">
            Forgot password?{" "}
            <Link className="text-primary font-bold" href="/account/recovery">
              Recover access
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

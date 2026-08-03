import Link from "next/link";

import { CustomerResetForm } from "@/components/customer-account-forms";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Reset customer password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CustomerResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <section>
          <Badge variant="info">Password reset</Badge>
          <h1 className="display-type mt-5 max-w-2xl text-5xl leading-tight text-white">
            Set a new password
          </h1>
          <p className="text-text-secondary mt-5 max-w-2xl text-sm leading-6">
            Reset tokens are one-time use and stored only as hashes.
          </p>
        </section>
        <section className="surface-panel rounded-2xl p-6 sm:p-8">
          <CustomerResetForm token={token} />
          <p className="text-text-muted mt-5 text-sm">
            Return to{" "}
            <Link className="text-primary font-bold" href="/account/login">
              sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

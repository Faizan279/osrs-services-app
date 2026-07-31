import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminCheckoutConfiguration } from "@/lib/checkout/admin";
import { updateCheckoutPaymentMethodAction } from "../actions";

export const metadata: Metadata = { title: "Admin checkout payment methods" };

function stateBadge(state: string | undefined, message?: string) {
  if (!state || !message) return null;
  return (
    <div
      className={
        state === "saved"
          ? "border-success/30 bg-success/10 text-success rounded-xl border p-4 text-sm"
          : "border-danger/30 bg-danger/10 text-danger rounded-xl border p-4 text-sm"
      }
      role="status"
    >
      {message}
    </div>
  );
}

export default async function AdminCheckoutPaymentMethodsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability(
    "checkout.configure",
    "/admin/checkout/payment-methods",
  );
  const [query, settings] = await Promise.all([
    searchParams,
    getAdminCheckoutConfiguration(),
  ]);
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  const message = Array.isArray(query.message)
    ? query.message[0]
    : query.message;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="info">Manual review</Badge>
          <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
            Payment methods
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
            Task 013 supports only manual payment review placeholders. No live
            payment providers are connected.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/checkout">Checkout settings</Link>
        </Button>
      </div>

      <div className="mt-6">{stateBadge(state, message)}</div>

      <section className="mt-8 grid gap-5">
        {settings?.paymentMethods.length ? (
          settings.paymentMethods.map((method) => (
            <form
              key={method.id}
              action={updateCheckoutPaymentMethodAction}
              className="border-border bg-surface-1 grid gap-5 rounded-2xl border p-5 sm:p-6"
            >
              <input type="hidden" name="id" value={method.id} />
              <input
                type="hidden"
                name="expectedVersion"
                value={method.concurrencyVersion}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="warning">{method.methodType}</Badge>
                <Badge variant={method.enabled ? "success" : "neutral"}>
                  {method.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Public name
                  <Input
                    name="publicName"
                    maxLength={120}
                    defaultValue={method.publicName}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Sort order
                  <Input
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={1000}
                    defaultValue={method.sortOrder}
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold">
                Public description
                <textarea
                  name="publicDescription"
                  maxLength={500}
                  defaultValue={method.publicDescription}
                  className="border-border bg-background min-h-24 rounded-xl border px-3 py-2"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Public instructions
                <textarea
                  name="publicInstructions"
                  maxLength={4000}
                  defaultValue={method.publicInstructions}
                  className="border-border bg-background min-h-28 rounded-xl border px-3 py-2"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="border-border bg-background/35 flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={method.enabled}
                  />
                  Enabled
                </label>
                <label className="border-border bg-background/35 flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
                  <input
                    type="checkbox"
                    name="needsClientReview"
                    defaultChecked={method.needsClientReview}
                  />
                  Needs client review
                </label>
              </div>
              <Button type="submit" className="w-fit">
                Save method
              </Button>
            </form>
          ))
        ) : (
          <div className="border-warning/40 bg-warning/10 rounded-2xl border p-6">
            <h2 className="text-xl font-bold">No payment method configured</h2>
            <p className="text-text-secondary mt-2 text-sm">
              Run the database seed to create the manual-review method.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

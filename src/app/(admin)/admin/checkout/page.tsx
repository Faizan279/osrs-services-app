import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminCheckoutConfiguration } from "@/lib/checkout/admin";
import { updateCheckoutSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Admin checkout configuration" };

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

export default async function AdminCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("checkout.configure", "/admin/checkout");
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
          <Badge variant="info">Task 013</Badge>
          <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
            Checkout configuration
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
            Guest checkout settings for the secure cart and manual-review order
            foundation.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/checkout/payment-methods">Payment methods</Link>
        </Button>
      </div>

      <div className="mt-6">{stateBadge(state, message)}</div>

      {!settings ? (
        <section className="border-warning/40 bg-warning/10 mt-8 rounded-2xl border p-6">
          <h2 className="text-xl font-bold">Checkout seed is missing</h2>
          <p className="text-text-secondary mt-2 text-sm">
            Run the database seed before configuring checkout.
          </p>
        </section>
      ) : (
        <form
          action={updateCheckoutSettingsAction}
          className="border-border bg-surface-1 mt-8 grid gap-6 rounded-2xl border p-5 sm:p-6"
        >
          <input type="hidden" name="id" value={settings.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={settings.concurrencyVersion}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-2 text-sm font-semibold">
              Max cart items
              <Input
                name="maximumCartItems"
                type="number"
                min={1}
                max={50}
                defaultValue={settings.maximumCartItems}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Cart expiry minutes
              <Input
                name="cartExpiryMinutes"
                type="number"
                min={15}
                max={10080}
                defaultValue={settings.cartExpiryMinutes}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Reservation minutes
              <Input
                name="checkoutReservationMinutes"
                type="number"
                min={5}
                max={240}
                defaultValue={settings.checkoutReservationMinutes}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Order prefix
              <Input
                name="orderNumberPrefix"
                maxLength={12}
                defaultValue={settings.orderNumberPrefix}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Terms version
              <Input
                name="termsVersion"
                maxLength={80}
                defaultValue={settings.termsVersion}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Privacy version
              <Input
                name="privacyPolicyVersion"
                maxLength={80}
                defaultValue={settings.privacyPolicyVersion}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold">
            Public checkout instructions
            <textarea
              name="publicCheckoutInstructions"
              maxLength={4000}
              defaultValue={settings.publicCheckoutInstructions}
              className="border-border bg-background min-h-32 rounded-xl border px-3 py-2"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Public payment review instructions
            <textarea
              name="publicPaymentReviewInstructions"
              maxLength={4000}
              defaultValue={settings.publicPaymentReviewInstructions}
              className="border-border bg-background min-h-32 rounded-xl border px-3 py-2"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="border-border bg-background/35 flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
              <input
                type="checkbox"
                name="guestCheckoutEnabled"
                defaultChecked={settings.guestCheckoutEnabled}
              />
              Guest checkout settings enabled
            </label>
            <label className="border-border bg-background/35 flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
              <input
                type="checkbox"
                name="needsClientReview"
                defaultChecked={settings.needsClientReview}
              />
              Needs client review
            </label>
          </div>

          <div className="border-warning/40 bg-warning/10 rounded-xl border p-4 text-sm">
            Notification delivery remains outbox-only in Task 013. No email
            provider or payment provider credentials are configured here.
          </div>

          <Button type="submit" className="w-fit">
            Save checkout settings
          </Button>
        </form>
      )}
    </main>
  );
}

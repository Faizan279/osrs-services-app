import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { CheckoutForm } from "@/components/checkout-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicCart } from "@/lib/checkout/cart";
import {
  CART_COOKIE_NAME,
  CART_FEATURE_FLAG,
  GUEST_CHECKOUT_FEATURE_FLAG,
} from "@/lib/checkout/constants";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest checkout",
  robots: { index: false, follow: false },
};

async function featureEnabled(key: string) {
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

async function checkoutConfiguration() {
  return prisma.checkoutSettings.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      paymentMethods: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { publicName: "asc" }],
        select: {
          stableKey: true,
          publicName: true,
          publicDescription: true,
        },
      },
    },
  });
}

function formatCents(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const rawCartToken = cookieStore.get(CART_COOKIE_NAME)?.value;
  const [cartResult, cartEnabled, guestCheckoutEnabled, settings] =
    await Promise.all([
      getPublicCart(rawCartToken),
      featureEnabled(CART_FEATURE_FLAG),
      featureEnabled(GUEST_CHECKOUT_FEATURE_FLAG),
      checkoutConfiguration(),
    ]);
  const cart = cartResult.cart;
  const settingsEnabled = Boolean(settings?.guestCheckoutEnabled);
  const hasPaymentMethod = Boolean(settings?.paymentMethods.length);
  const disabled =
    !cartEnabled ||
    !guestCheckoutEnabled ||
    !settingsEnabled ||
    !hasPaymentMethod ||
    cart.status !== "ACTIVE" ||
    cart.items.length === 0;

  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Badge variant={disabled ? "warning" : "success"}>
            {disabled ? "Checkout review" : "Guest checkout"}
          </Badge>
          <h1 className="display-type mt-4 text-4xl sm:text-5xl">
            Guest checkout
          </h1>
          <p className="text-text-secondary mt-4 max-w-2xl leading-7">
            Submit the current cart for manual payment review. Card, wallet and
            provider credentials are intentionally not collected here.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          className="border-border bg-surface-1 rounded-2xl border p-5 sm:p-6"
          aria-labelledby="checkout-form-heading"
        >
          <h2 id="checkout-form-heading" className="text-xl font-bold">
            Contact and review
          </h2>
          {disabled && (
            <div
              className="border-warning/40 bg-warning/10 my-5 rounded-xl border p-4 text-sm"
              role="status"
            >
              Checkout is available only when cart and guest checkout flags are
              enabled, checkout settings are client-reviewed, and the cart has
              active items.
            </div>
          )}
          <CheckoutForm
            paymentMethods={settings?.paymentMethods ?? []}
            disabled={disabled}
          />
        </section>

        <aside className="border-gold/25 bg-gold/5 h-fit rounded-2xl border p-5">
          <h2 className="text-lg font-bold">Cart total</h2>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Items</dt>
              <dd>{cart.itemCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Subtotal</dt>
              <dd>{formatCents(cart.subtotalCents, cart.currencyCode)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Adjustments</dt>
              <dd>
                {formatCents(cart.adjustmentTotalCents, cart.currencyCode)}
              </dd>
            </div>
            <div className="border-border flex justify-between gap-4 border-t pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatCents(cart.finalTotalCents, cart.currencyCode)}</dd>
            </div>
          </dl>
          <Button asChild variant="secondary" className="mt-5 w-full">
            <Link href="/cart">Review cart</Link>
          </Button>
        </aside>
      </div>
    </main>
  );
}

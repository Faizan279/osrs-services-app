import { ShoppingCart } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import {
  CartItemControls,
  CartRevalidateButton,
} from "@/components/cart-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicCart } from "@/lib/checkout/cart";
import { CART_COOKIE_NAME } from "@/lib/checkout/constants";

export const metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

function formatCents(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export default async function CartPage() {
  const cookieStore = await cookies();
  const { cart } = await getPublicCart(
    cookieStore.get(CART_COOKIE_NAME)?.value,
  );
  const canCheckout =
    cart.featureEnabled && cart.status === "ACTIVE" && cart.items.length > 0;

  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Badge variant={cart.featureEnabled ? "success" : "warning"}>
            {cart.featureEnabled ? "Cart review" : "Cart disabled"}
          </Badge>
          <h1 className="display-type mt-4 text-4xl sm:text-5xl">Cart</h1>
          <p className="text-text-secondary mt-4 max-w-2xl leading-7">
            Review server-authoritative item totals before guest checkout.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-4" aria-labelledby="cart-items-heading">
          <h2 id="cart-items-heading" className="text-xl font-bold">
            Items
          </h2>
          {cart.warnings.map((warning) => (
            <div
              key={warning}
              className="border-warning/40 bg-warning/10 rounded-xl border p-4 text-sm"
              role="status"
            >
              {warning}
            </div>
          ))}
          {cart.items.length === 0 ? (
            <div className="border-border bg-surface-1 rounded-2xl border p-8 text-center">
              <ShoppingCart
                className="text-primary mx-auto size-10"
                aria-hidden="true"
              />
              <p className="mt-4 font-bold">Your cart is empty.</p>
              <p className="text-text-muted mt-2 text-sm">
                Add eligible estimates or products once cart actions are
                enabled.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {cart.items.map((item) => (
                <article
                  key={item.id}
                  className="border-border bg-surface-1 rounded-2xl border p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <Badge variant="info">{item.kindLabel}</Badge>
                      <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                      <p className="text-text-secondary mt-2 text-sm">
                        {item.configurationSummary}
                      </p>
                    </div>
                    <p className="text-right text-lg font-bold">
                      {formatCents(item.finalTotalCents, item.currency)}
                    </p>
                  </div>
                  <ul className="divide-border mt-4 divide-y text-sm">
                    {item.lineItems.map((line) => (
                      <li
                        key={`${item.id}:${line.label}`}
                        className="flex justify-between gap-4 py-2"
                      >
                        <span>{line.label}</span>
                        <strong>
                          {formatCents(line.amountCents, item.currency)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {item.repricingRequired && (
                      <Badge variant="warning">Review updated total</Badge>
                    )}
                    {item.reservationRequired && (
                      <Badge variant="info">Reservation at checkout</Badge>
                    )}
                  </div>
                  <CartItemControls item={item} />
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="border-gold/25 bg-gold/5 h-fit rounded-2xl border p-5">
          <h2 className="text-lg font-bold">Order summary</h2>
          <dl className="mt-5 grid gap-3 text-sm">
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
          <p className="text-text-muted mt-4 text-xs">
            Final availability is rechecked during checkout.
          </p>
          <CartRevalidateButton />
          {canCheckout ? (
            <Button asChild className="mt-5 w-full">
              <Link href="/checkout">Checkout</Link>
            </Button>
          ) : (
            <Button className="mt-5 w-full" disabled>
              Checkout
            </Button>
          )}
        </aside>
      </div>
    </main>
  );
}

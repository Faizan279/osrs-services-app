import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { requireCustomer } from "@/lib/auth/guards";
import { getCustomerOrderDetail } from "@/lib/customer/account";

export const metadata = {
  title: "Customer order detail",
  robots: { index: false, follow: false },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCents(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const session = await requireCustomer(`/account/orders/${orderNumber}`);
  const order = await getCustomerOrderDetail(session.user.id, orderNumber);
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap gap-2">
        <Badge variant="info">{order.statusLabel}</Badge>
        <Badge variant="warning">{order.paymentStatusLabel}</Badge>
      </div>
      <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
        {order.orderNumber}
      </h1>
      <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
        {order.statusMessage}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="grid gap-4" aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-2xl font-bold">
            Items
          </h2>
          {order.items.map((item) => (
            <article
              key={item.id}
              className="border-border bg-surface-1 rounded-2xl border p-5"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <Badge variant="neutral">
                    {item.resourceReservationState}
                  </Badge>
                  <h3 className="mt-3 text-lg font-bold">{item.publicTitle}</h3>
                  <p className="text-text-secondary mt-2 text-sm whitespace-pre-line">
                    {item.publicConfigurationSummary}
                  </p>
                </div>
                <p className="font-bold">{item.finalTotal}</p>
              </div>
            </article>
          ))}
        </section>

        <aside className="border-gold/25 bg-gold/5 h-fit rounded-2xl border p-5">
          <h2 className="text-lg font-bold">Summary</h2>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Created</dt>
              <dd>{formatDate(order.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Subtotal</dt>
              <dd>{formatCents(order.subtotalCents, order.currencyCode)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Adjustments</dt>
              <dd>
                {formatCents(order.adjustmentTotalCents, order.currencyCode)}
              </dd>
            </div>
            <div className="border-border flex justify-between gap-4 border-t pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatCents(order.finalTotalCents, order.currencyCode)}</dd>
            </div>
          </dl>
          <p className="text-text-muted mt-5 text-xs">
            {order.emailDeliveryMessage}
          </p>
        </aside>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="border-border bg-surface-1 rounded-2xl border p-5">
          <h2 className="text-xl font-bold">Order progress</h2>
          <ol className="divide-border mt-4 divide-y text-sm">
            {order.statusTimeline.map((event) => (
              <li
                key={`${event.eventType}:${event.createdAt}`}
                className="py-3"
              >
                <strong>{event.label}</strong>
                <p className="text-text-muted">{formatDate(event.createdAt)}</p>
                <p className="text-text-secondary mt-1">{event.message}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="border-border bg-surface-1 rounded-2xl border p-5">
          <h2 className="text-xl font-bold">Payment state</h2>
          <ol className="divide-border mt-4 divide-y text-sm">
            {order.paymentTimeline.map((event) => (
              <li
                key={`${event.paymentStatus}:${event.createdAt}`}
                className="py-3"
              >
                <strong>{event.label}</strong>
                <p className="text-text-muted">{formatDate(event.createdAt)}</p>
                <p className="text-text-secondary mt-1">{event.message}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

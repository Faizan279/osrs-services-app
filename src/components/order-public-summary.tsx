import { Clock, CreditCard, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  emailNotConfiguredMessage,
  orderPaymentStatusLabels,
  orderStatusLabels,
  paymentReviewMessage,
} from "@/lib/checkout/constants";

type PublicOrder = {
  orderNumber: string;
  status: keyof typeof orderStatusLabels;
  paymentStatus: keyof typeof orderPaymentStatusLabels;
  currencyCode: string;
  subtotalCents: number;
  adjustmentTotalCents: number;
  finalTotalCents: number;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  paymentReviewMessage: string;
  emailDeliveryMessage: string;
  items: Array<{
    id: string;
    publicTitle: string;
    publicConfigurationSummary: string;
    quantity: string;
    currencyCode: string;
    priceLines: unknown;
    finalTotalCents: number;
    resourceReservationState: string;
  }>;
  statusTimeline: Array<{
    eventType: string;
    status: keyof typeof orderStatusLabels;
    publicNote: string | null;
    createdAt: string;
  }>;
  paymentTimeline: Array<{
    paymentStatus: keyof typeof orderPaymentStatusLabels;
    publicNote: string | null;
    createdAt: string;
  }>;
  notifications: Array<{ type: string; status: string; createdAt: string }>;
};

function formatCents(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function OrderPublicSummary({ order }: { order: PublicOrder }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="space-y-5" aria-labelledby="order-items-heading">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="info">{orderStatusLabels[order.status]}</Badge>
          <Badge variant="warning">
            {orderPaymentStatusLabels[order.paymentStatus]}
          </Badge>
        </div>
        <h2 id="order-items-heading" className="text-2xl font-bold">
          Order {order.orderNumber}
        </h2>
        <div className="border-border bg-surface-1 rounded-2xl border p-5">
          <div className="flex items-center gap-2">
            <CreditCard className="text-gold size-5" aria-hidden="true" />
            <h3 className="font-bold">Payment review</h3>
          </div>
          <p className="text-text-secondary mt-3 text-sm leading-6">
            {order.paymentReviewMessage || paymentReviewMessage}
          </p>
          <p className="text-text-muted mt-2 text-xs">
            {order.emailDeliveryMessage || emailNotConfiguredMessage}
          </p>
        </div>
        <div className="grid gap-4">
          {order.items.map((item) => (
            <article
              className="border-border bg-surface-1 rounded-2xl border p-5"
              key={item.id}
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <Badge variant="neutral">
                    {item.resourceReservationState === "NONE"
                      ? "No reservation"
                      : item.resourceReservationState}
                  </Badge>
                  <h3 className="mt-3 text-lg font-bold">{item.publicTitle}</h3>
                  <p className="text-text-secondary mt-2 text-sm leading-6 whitespace-pre-line">
                    {item.publicConfigurationSummary}
                  </p>
                </div>
                <p className="text-right text-lg font-bold">
                  {formatCents(item.finalTotalCents, item.currencyCode)}
                </p>
              </div>
            </article>
          ))}
        </div>
        <section
          className="border-border bg-surface-1 rounded-2xl border p-5"
          aria-labelledby="order-timeline-heading"
        >
          <div className="flex items-center gap-2">
            <Clock className="text-primary size-5" aria-hidden="true" />
            <h3 id="order-timeline-heading" className="font-bold">
              Timeline
            </h3>
          </div>
          <ol className="divide-border mt-4 divide-y text-sm">
            {order.statusTimeline.map((event) => (
              <li
                key={`${event.eventType}:${event.createdAt}`}
                className="grid gap-1 py-3"
              >
                <strong>{orderStatusLabels[event.status]}</strong>
                <span className="text-text-muted">
                  {formatDate(event.createdAt)}
                </span>
                {event.publicNote && (
                  <span className="text-text-secondary">
                    {event.publicNote}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      </section>
      <aside className="border-gold/25 bg-gold/5 h-fit rounded-2xl border p-5">
        <div className="flex items-center gap-2">
          <PackageCheck className="text-gold size-5" aria-hidden="true" />
          <h2 className="text-lg font-bold">Summary</h2>
        </div>
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
      </aside>
    </div>
  );
}

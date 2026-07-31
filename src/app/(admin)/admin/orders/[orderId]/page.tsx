import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/guards";
import {
  orderPaymentStatusLabels,
  orderStatusLabels,
} from "@/lib/checkout/constants";
import { getAdminOrder } from "@/lib/checkout/orders";
import {
  cancelOrderAction,
  markOrderPaidAction,
  markPaymentReviewAction,
  updateOrderStatusAction,
} from "../actions";

export const metadata: Metadata = { title: "Admin order detail" };

const statusOptions = [
  "AWAITING_ASSIGNMENT",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "COMPLETED",
  "REQUIRES_REVIEW",
  "DISPUTED",
] as const;

function formatCents(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatDate(value: Date | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function stateBadge(state: "saved" | "error" | undefined, message?: string) {
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

function HiddenOrderFields({
  orderId,
  expectedVersion,
}: {
  orderId: string;
  expectedVersion: number;
}) {
  return (
    <>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
    </>
  );
}

function NoteFields() {
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-xs font-semibold">
        Public note
        <textarea
          name="publicNote"
          maxLength={500}
          className="border-border bg-background min-h-20 rounded-xl border px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold">
        Internal note
        <textarea
          name="internalNote"
          maxLength={2000}
          className="border-border bg-background min-h-20 rounded-xl border px-3 py-2"
        />
      </label>
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderId } = await params;
  const query = await searchParams;
  const session = await requireCapability(
    "orders.view",
    `/admin/orders/${orderId}`,
  );
  const order = await getAdminOrder(orderId);
  if (!order) notFound();

  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  const message = Array.isArray(query.message)
    ? query.message[0]
    : query.message;
  const canStatus = hasCapability(session.capabilities, "orders.status.manage");
  const canPayment = hasCapability(
    session.capabilities,
    "orders.payment.review",
  );
  const canCancel = hasCapability(session.capabilities, "orders.cancel");

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="info">Order detail</Badge>
          <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
            {order.orderNumber}
          </h1>
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge variant="info">{orderStatusLabels[order.status]}</Badge>
            <Badge variant="warning">
              {orderPaymentStatusLabels[order.paymentStatus]}
            </Badge>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">
            {formatCents(order.finalTotalCents, order.currencyCode)}
          </p>
          <p className="text-text-muted">
            Created {formatDate(order.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {stateBadge(state as "saved" | "error", message)}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="space-y-6">
          <section className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="text-xl font-bold">Guest contact</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-muted">Display name</dt>
                <dd className="font-semibold">
                  {order.guestContact.displayName}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Email</dt>
                <dd className="font-semibold">{order.guestContact.email}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Discord</dt>
                <dd className="font-semibold">
                  {order.guestContact.discordUsername ?? "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">RSN</dt>
                <dd className="font-semibold">
                  {order.guestContact.rsn ?? "Not provided"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="text-xl font-bold">Items</h2>
            <div className="mt-4 grid gap-4">
              {order.items.map((item) => (
                <article
                  key={item.id}
                  className="border-border rounded-xl border p-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <Badge variant="neutral">{item.kind}</Badge>
                      <h3 className="mt-2 font-bold">{item.publicTitle}</h3>
                      <p className="text-text-secondary mt-2 text-sm whitespace-pre-line">
                        {item.publicConfigurationSummary}
                      </p>
                    </div>
                    <p className="font-bold">
                      {formatCents(item.finalTotalCents, item.currencyCode)}
                    </p>
                  </div>
                  <p className="text-text-muted mt-3 text-xs">
                    Reservation state: {item.resourceReservationState}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="text-xl font-bold">Resource allocations</h2>
            <div className="mt-4 grid gap-3 text-sm">
              {order.resourceAllocations.length === 0 ? (
                <p className="text-text-muted">
                  No finite resource allocation.
                </p>
              ) : (
                order.resourceAllocations.map((allocation) => (
                  <div
                    key={allocation.id}
                    className="border-border rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">{allocation.itemKind}</Badge>
                      <Badge variant="neutral">{allocation.state}</Badge>
                    </div>
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-text-muted">Quantity</dt>
                        <dd>{allocation.quantity?.toString() ?? "N/A"}</dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Expires</dt>
                        <dd>{formatDate(allocation.expiresAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Released</dt>
                        <dd>{formatDate(allocation.releasedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-text-muted">Consumed</dt>
                        <dd>{formatDate(allocation.consumedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="text-xl font-bold">Timeline</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-bold">Order status</h3>
                <ol className="divide-border mt-3 divide-y text-sm">
                  {order.statusEvents.map((event) => (
                    <li key={event.id} className="grid gap-1 py-3">
                      <strong>{orderStatusLabels[event.newStatus]}</strong>
                      <span className="text-text-muted">
                        {formatDate(event.createdAt)}
                      </span>
                      {event.publicNote && <span>{event.publicNote}</span>}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="font-bold">Payment</h3>
                <ol className="divide-border mt-3 divide-y text-sm">
                  {order.paymentEvents.map((event) => (
                    <li key={event.id} className="grid gap-1 py-3">
                      <strong>
                        {orderPaymentStatusLabels[event.newPaymentStatus]}
                      </strong>
                      <span className="text-text-muted">
                        {formatDate(event.createdAt)}
                      </span>
                      {event.publicNote && <span>{event.publicNote}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="text-lg font-bold">Totals</h2>
            <dl className="mt-4 grid gap-3 text-sm">
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
              <div className="border-border flex justify-between gap-4 border-t pt-3 font-bold">
                <dt>Total</dt>
                <dd>
                  {formatCents(order.finalTotalCents, order.currencyCode)}
                </dd>
              </div>
            </dl>
          </section>

          {canStatus && (
            <form
              action={updateOrderStatusAction}
              className="border-border bg-surface-1 grid gap-4 rounded-2xl border p-5"
            >
              <HiddenOrderFields
                orderId={order.id}
                expectedVersion={order.concurrencyVersion}
              />
              <h2 className="text-lg font-bold">Update status</h2>
              <label className="grid gap-1 text-xs font-semibold">
                Status
                <select
                  name="nextStatus"
                  defaultValue={order.status}
                  className="border-border bg-background min-h-11 rounded-xl border px-3"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {orderStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <NoteFields />
              <Button type="submit" variant="secondary">
                Save status
              </Button>
            </form>
          )}

          {canPayment && (
            <form
              action={markPaymentReviewAction}
              className="border-border bg-surface-1 grid gap-4 rounded-2xl border p-5"
            >
              <HiddenOrderFields
                orderId={order.id}
                expectedVersion={order.concurrencyVersion}
              />
              <h2 className="text-lg font-bold">Payment review</h2>
              <NoteFields />
              <Button type="submit" variant="secondary">
                Start review
              </Button>
            </form>
          )}

          {canPayment && (
            <form
              action={markOrderPaidAction}
              className="border-border bg-surface-1 grid gap-4 rounded-2xl border p-5"
            >
              <HiddenOrderFields
                orderId={order.id}
                expectedVersion={order.concurrencyVersion}
              />
              <h2 className="text-lg font-bold">Mark paid</h2>
              <NoteFields />
              <Button type="submit">Mark paid</Button>
            </form>
          )}

          {canCancel && (
            <form
              action={cancelOrderAction}
              className="border-danger/30 bg-danger/5 grid gap-4 rounded-2xl border p-5"
            >
              <HiddenOrderFields
                orderId={order.id}
                expectedVersion={order.concurrencyVersion}
              />
              <h2 className="text-lg font-bold">Cancel order</h2>
              <NoteFields />
              <Button type="submit" variant="danger">
                Cancel and release holds
              </Button>
            </form>
          )}

          <section className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="text-lg font-bold">Notification outbox</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {order.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="border-border rounded-xl border p-3"
                >
                  <strong>{notification.notificationType}</strong>
                  <p className="text-text-muted">{notification.status}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

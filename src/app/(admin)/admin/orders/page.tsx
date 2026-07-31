import { ClipboardList, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  orderPaymentStatusLabels,
  orderStatusLabels,
} from "@/lib/checkout/constants";
import { getAdminOrders } from "@/lib/checkout/orders";
import { requireCapability } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Admin orders" };

function formatCents(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminOrdersPage() {
  await requireCapability("orders.view", "/admin/orders");
  const orders = await getAdminOrders();

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="info">Task 013</Badge>
          <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
            Orders
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
            Manual-review guest orders, payment states, and checkout
            reservations.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/checkout">Checkout config</Link>
        </Button>
      </div>

      <section className="border-border bg-surface-1 mt-8 overflow-hidden rounded-2xl border">
        {orders.length === 0 ? (
          <div className="grid place-items-center p-10 text-center">
            <ClipboardList
              className="text-primary size-10"
              aria-hidden="true"
            />
            <p className="mt-4 font-bold">No orders yet.</p>
            <p className="text-text-muted mt-2 text-sm">
              Guest checkout creates orders only after cart and checkout flags
              are enabled.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-border bg-surface-2 border-b">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-bold">{order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">
                        {order.guestContact.displayName}
                      </span>
                      <span className="text-text-muted">
                        {order.guestContact.email}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="info">
                        {orderStatusLabels[order.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="warning">
                        {orderPaymentStatusLabels[order.paymentStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {formatCents(order.finalTotalCents, order.currencyCode)}
                    </td>
                    <td className="px-4 py-3">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/orders/${order.id}`}>
                          <ExternalLink className="size-4" aria-hidden="true" />
                          Open
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

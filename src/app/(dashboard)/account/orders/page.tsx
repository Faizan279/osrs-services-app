import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCustomer } from "@/lib/auth/guards";
import { getCustomerOrders } from "@/lib/customer/account";

export const metadata = {
  title: "Customer orders",
  robots: { index: false, follow: false },
};

export default async function CustomerOrdersPage() {
  const session = await requireCustomer("/account/orders");
  const orders = await getCustomerOrders(session.user.id);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <Badge variant="info">Customer-safe</Badge>
      <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
        Orders
      </h1>
      <section className="mt-8 grid gap-4">
        {orders.length === 0 ? (
          <div className="border-border bg-surface-1 rounded-2xl border p-6">
            <p className="font-semibold">No orders linked to this account.</p>
            <p className="text-text-muted mt-2 text-sm">
              Guest orders remain private until claimed with their secure
              tracking token.
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="border-border bg-surface-1 rounded-2xl border p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{order.statusLabel}</Badge>
                    <Badge variant="warning">{order.paymentStatusLabel}</Badge>
                  </div>
                  <h2 className="mt-3 text-xl font-bold">
                    {order.orderNumber}
                  </h2>
                  <p className="text-text-secondary mt-1 text-sm">
                    {order.primaryItem} - {order.itemCount} item
                    {order.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold">{order.total}</p>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/account/orders/${order.orderNumber}`}>
                      Open
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

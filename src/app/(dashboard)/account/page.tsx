import { Bell, ClipboardList, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCustomer } from "@/lib/auth/guards";
import { getCustomerDashboard } from "@/lib/customer/account";

export const metadata = {
  title: "Customer dashboard",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await requireCustomer("/account");
  const dashboard = await getCustomerDashboard(session.user.id);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="info">Task 014</Badge>
          <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
            Dashboard
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
            Signed in as {dashboard.profile.displayName}. Account data is
            private and scoped to this customer session.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/account/orders">View orders</Link>
        </Button>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="surface-panel rounded-2xl p-5">
          <ClipboardList className="text-primary size-5" aria-hidden="true" />
          <p className="text-text-muted mt-4 text-xs font-bold uppercase">
            Recent orders
          </p>
          <p className="mt-2 text-3xl font-black">{dashboard.orders.length}</p>
        </article>
        <article className="surface-panel rounded-2xl p-5">
          <Bell className="text-gold size-5" aria-hidden="true" />
          <p className="text-text-muted mt-4 text-xs font-bold uppercase">
            Unread updates
          </p>
          <p className="mt-2 text-3xl font-black">{dashboard.unreadCount}</p>
        </article>
        <article className="surface-panel rounded-2xl p-5">
          <ShieldCheck className="text-success size-5" aria-hidden="true" />
          <p className="text-text-muted mt-4 text-xs font-bold uppercase">
            Email state
          </p>
          <p className="mt-2 text-base font-bold">
            {dashboard.profile.emailVerificationStatus.replace(/_/g, " ")}
          </p>
        </article>
      </section>

      <section className="mt-8" aria-labelledby="recent-orders-heading">
        <h2 id="recent-orders-heading" className="text-2xl font-bold">
          Recent orders
        </h2>
        <div className="mt-4 grid gap-4">
          {dashboard.orders.length === 0 ? (
            <div className="border-border bg-surface-1 rounded-2xl border p-6">
              <p className="font-semibold">No linked orders yet.</p>
              <p className="text-text-muted mt-2 text-sm">
                Use the secure tracking token on the Security page to claim one
                historical guest order at a time.
              </p>
            </div>
          ) : (
            dashboard.orders.map((order) => (
              <article
                key={order.id}
                className="border-border bg-surface-1 rounded-2xl border p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <Badge variant="info">{order.statusLabel}</Badge>
                    <h3 className="mt-3 text-lg font-bold">
                      {order.orderNumber}
                    </h3>
                    <p className="text-text-secondary mt-1 text-sm">
                      {order.primaryItem}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{order.total}</p>
                    <p className="text-text-muted text-xs">
                      {order.paymentStatusLabel}
                    </p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

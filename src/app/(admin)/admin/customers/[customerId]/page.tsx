import { notFound } from "next/navigation";

import {
  revokeCustomerSessionAction,
  setCustomerStatusAction,
} from "@/app/(admin)/admin/customers/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminCustomerDetail } from "@/lib/customer/admin";

export const metadata = { title: "Admin customer detail" };

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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatCents(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { customerId } = await params;
  const session = await requireCapability(
    "customers.view",
    `/admin/customers/${customerId}`,
  );
  const [query, customer] = await Promise.all([
    searchParams,
    getAdminCustomerDetail(customerId),
  ]);
  if (!customer || !customer.customerProfile) notFound();
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  const message = Array.isArray(query.message)
    ? query.message[0]
    : query.message;
  const canManage = hasCapability(session.capabilities, "customers.manage");
  const canManageSecurity = hasCapability(
    session.capabilities,
    "customers.security.manage",
  );
  const staffRoleCount = customer.roles.length;
  const staffPermissionCount = new Set(
    customer.roles.flatMap((assignment) =>
      assignment.role.permissions.map((permission) => permission.permissionId),
    ),
  ).size;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant={customer.status === "ACTIVE" ? "success" : "warning"}>
            {customer.status}
          </Badge>
          <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
            {customer.customerProfile.displayName}
          </h1>
          <p className="screenshot-sensitive text-text-secondary mt-3 text-sm">
            {customer.email}
          </p>
        </div>
      </div>

      <div className="mt-6">{stateBadge(state, message)}</div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <article className="surface-panel rounded-2xl p-5">
          <p className="text-text-muted text-xs font-bold uppercase">
            Verification
          </p>
          <p className="mt-2 font-bold">
            {customer.customerProfile.emailVerificationStatus.replace(
              /_/g,
              " ",
            )}
          </p>
        </article>
        <article className="surface-panel rounded-2xl p-5">
          <p className="text-text-muted text-xs font-bold uppercase">Orders</p>
          <p className="mt-2 text-3xl font-black">
            {customer.customerOrderLinks.length}
          </p>
        </article>
        <article className="surface-panel rounded-2xl p-5">
          <p className="text-text-muted text-xs font-bold uppercase">
            Customer sessions
          </p>
          <p className="mt-2 text-3xl font-black">
            {customer.sessions.filter((record) => !record.revokedAt).length}
          </p>
        </article>
        <article className="surface-panel rounded-2xl p-5">
          <p className="text-text-muted text-xs font-bold uppercase">
            Staff permissions
          </p>
          <p className="mt-2 text-3xl font-black">{staffPermissionCount}</p>
          <p className="text-text-muted mt-1 text-xs">
            Roles assigned: {staffRoleCount}
          </p>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <form
          action={setCustomerStatusAction}
          className="border-border bg-surface-1 grid gap-4 rounded-2xl border p-5"
        >
          <input type="hidden" name="customerId" value={customer.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={customer.customerProfile.concurrencyVersion}
          />
          <h2 className="text-xl font-bold">Account state</h2>
          <label className="grid gap-2 text-sm font-semibold">
            Reason code
            <Input
              name="reason"
              defaultValue="ADMIN_REVIEW"
              maxLength={80}
              disabled={!canManage}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              name="status"
              value="DISABLED"
              variant="danger"
              disabled={!canManage || customer.status === "DISABLED"}
            >
              Disable customer
            </Button>
            <Button
              type="submit"
              name="status"
              value="ACTIVE"
              variant="secondary"
              disabled={!canManage || customer.status === "ACTIVE"}
            >
              Re-enable customer
            </Button>
          </div>
        </form>

        <section className="border-border bg-surface-1 rounded-2xl border p-5">
          <h2 className="text-xl font-bold">Profile</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Default RSN</dt>
              <dd>{customer.customerProfile.defaultRsn ?? "Not set"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Discord</dt>
              <dd>{customer.customerProfile.discordUsername ?? "Not set"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Needs review</dt>
              <dd>{customer.customerProfile.needsReview ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </section>
      </section>

      <section className="mt-8" aria-labelledby="customer-orders-heading">
        <h2 id="customer-orders-heading" className="text-2xl font-bold">
          Linked orders
        </h2>
        <div className="mt-4 grid gap-4">
          {customer.customerOrderLinks.length === 0 ? (
            <div className="border-border bg-surface-1 rounded-2xl border p-5 text-sm">
              No linked orders.
            </div>
          ) : (
            customer.customerOrderLinks.map((link) => (
              <article
                key={link.id}
                className="border-border bg-surface-1 rounded-2xl border p-5"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <Badge variant="info">{link.source}</Badge>
                    <h3 className="mt-3 text-lg font-bold">
                      {link.order.orderNumber}
                    </h3>
                    <p className="text-text-muted text-sm">
                      {link.order.status} / {link.order.paymentStatus}
                    </p>
                  </div>
                  <p className="font-bold">
                    {formatCents(
                      link.order.finalTotalCents,
                      link.order.currencyCode,
                    )}
                  </p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="customer-sessions-heading">
        <h2 id="customer-sessions-heading" className="text-2xl font-bold">
          Customer sessions
        </h2>
        <div className="mt-4 grid gap-4">
          {customer.sessions.map((record) => (
            <article
              key={record.id}
              className="border-border bg-surface-1 rounded-2xl border p-5"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <Badge variant={record.revokedAt ? "neutral" : "success"}>
                    {record.revokedAt ? "Revoked" : "Active"}
                  </Badge>
                  <p className="text-text-muted mt-3 text-sm">
                    Created {formatDate(record.createdAt)}; expires{" "}
                    {formatDate(record.expires)}
                  </p>
                </div>
                {!record.revokedAt ? (
                  <form action={revokeCustomerSessionAction}>
                    <input
                      type="hidden"
                      name="customerId"
                      value={customer.id}
                    />
                    <input type="hidden" name="sessionId" value={record.id} />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      disabled={!canManageSecurity}
                    >
                      Revoke
                    </Button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

import { updateCustomerSettingsAction } from "@/app/(admin)/admin/customers/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireCapability } from "@/lib/auth/guards";
import {
  getAdminCustomerSettings,
  getAdminCustomers,
} from "@/lib/customer/admin";

export const metadata = { title: "Admin customers" };

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

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability("customers.view", "/admin/customers");
  const [query, settings, customers] = await Promise.all([
    searchParams,
    getAdminCustomerSettings(),
    getAdminCustomers(),
  ]);
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  const message = Array.isArray(query.message)
    ? query.message[0]
    : query.message;
  const canConfigure = hasCapability(
    session.capabilities,
    "customers.configure",
  );

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div>
        <Badge variant="info">Task 014</Badge>
        <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
          Customers
        </h1>
        <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
          Customer account configuration, account state, order ownership, and
          customer-only session summaries.
        </p>
      </div>

      <div className="mt-6">{stateBadge(state, message)}</div>

      {settings ? (
        <form
          action={updateCustomerSettingsAction}
          className="border-border bg-surface-1 mt-8 grid gap-6 rounded-2xl border p-5 sm:p-6"
        >
          <input type="hidden" name="id" value={settings.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={settings.concurrencyVersion}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="border-border bg-background/35 flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
              <input
                type="checkbox"
                name="registrationEnabled"
                defaultChecked={settings.registrationEnabled}
                disabled={!canConfigure}
              />
              Registration setting
            </label>
            <label className="border-border bg-background/35 flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
              <input
                type="checkbox"
                name="dashboardEnabled"
                defaultChecked={settings.dashboardEnabled}
                disabled={!canConfigure}
              />
              Dashboard setting
            </label>
            <label className="border-border bg-background/35 flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
              <input
                type="checkbox"
                name="emailVerificationRequired"
                defaultChecked={settings.emailVerificationRequired}
                disabled={!canConfigure}
              />
              Require email verification
            </label>
            <label className="border-border bg-background/35 flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
              <input
                type="checkbox"
                name="passwordRecoveryEnabled"
                defaultChecked={settings.passwordRecoveryEnabled}
                disabled={!canConfigure}
              />
              Recovery setting
            </label>
            <label className="border-border bg-background/35 flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold">
              <input
                type="checkbox"
                name="needsClientReview"
                defaultChecked={settings.needsClientReview}
                disabled={!canConfigure}
              />
              Needs review
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Session hours
              <Input
                name="customerSessionDurationHours"
                type="number"
                min={1}
                max={720}
                defaultValue={settings.customerSessionDurationHours}
                disabled={!canConfigure}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Max active sessions
              <Input
                name="maximumActiveCustomerSessions"
                type="number"
                min={1}
                max={20}
                defaultValue={settings.maximumActiveCustomerSessions}
                disabled={!canConfigure}
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            Public registration instructions
            <textarea
              name="publicRegistrationInstructions"
              defaultValue={settings.publicRegistrationInstructions}
              maxLength={4000}
              disabled={!canConfigure}
              className="border-border bg-background min-h-28 rounded-xl border px-3 py-2"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Public recovery instructions
            <textarea
              name="publicRecoveryInstructions"
              defaultValue={settings.publicRecoveryInstructions}
              maxLength={4000}
              disabled={!canConfigure}
              className="border-border bg-background min-h-28 rounded-xl border px-3 py-2"
            />
          </label>
          <div className="border-warning/40 bg-warning/10 rounded-xl border p-4 text-sm">
            Notification provider configured:{" "}
            {settings.notificationProviderConfigured ? "yes" : "no"}. Task 014
            does not configure live email delivery.
          </div>
          <Button type="submit" className="w-fit" disabled={!canConfigure}>
            Save customer settings
          </Button>
        </form>
      ) : (
        <section className="border-warning/40 bg-warning/10 mt-8 rounded-2xl border p-6">
          <h2 className="text-xl font-bold">Customer settings seed missing</h2>
          <p className="text-text-secondary mt-2 text-sm">
            Run the database seed before configuring customer accounts.
          </p>
        </section>
      )}

      <section className="border-border bg-surface-1 mt-8 overflow-hidden rounded-2xl border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] text-left text-sm">
            <thead className="border-border bg-surface-2 border-b">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Sessions</th>
                <th className="px-4 py-3">Open</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    No customer accounts exist in the normal seed.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3 font-semibold">
                      {customer.customerProfile?.displayName ??
                        customer.name ??
                        "Customer"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          customer.status === "ACTIVE" ? "success" : "warning"
                        }
                      >
                        {customer.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {customer.customerProfile?.emailVerificationStatus ??
                        "UNVERIFIED"}
                    </td>
                    <td className="px-4 py-3">
                      {customer.customerOrderLinks.length}
                    </td>
                    <td className="px-4 py-3">{customer.sessions.length}</td>
                    <td className="px-4 py-3">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/admin/customers/${customer.id}`}>
                          Open
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

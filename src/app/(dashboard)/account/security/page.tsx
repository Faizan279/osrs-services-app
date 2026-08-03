import { Badge } from "@/components/ui/badge";
import {
  CustomerClaimOrderForm,
  CustomerPasswordForm,
  CustomerSessionRevokeButton,
} from "@/components/customer-account-forms";
import { requireCustomer } from "@/lib/auth/guards";
import { listCustomerSessions } from "@/lib/customer/account";

export const metadata = {
  title: "Customer security",
  robots: { index: false, follow: false },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function CustomerSecurityPage() {
  const session = await requireCustomer("/account/security");
  const sessions = await listCustomerSessions(session.user.id);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <Badge variant="info">Security</Badge>
      <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
        Security
      </h1>
      <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
        Customer sessions are isolated from staff sessions and can be revoked
        without affecting staff access.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="surface-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold">Change password</h2>
          <div className="mt-5">
            <CustomerPasswordForm />
          </div>
        </section>
        <section className="surface-panel rounded-2xl p-6">
          <h2 className="text-xl font-bold">Claim a guest order</h2>
          <p className="text-text-muted mt-2 text-sm">
            The secure tracking token must match this account email.
          </p>
          <div className="mt-5">
            <CustomerClaimOrderForm />
          </div>
        </section>
      </div>

      <section className="mt-8" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="text-2xl font-bold">
          Active sessions
        </h2>
        <div className="mt-4 grid gap-4">
          {sessions.map((record) => (
            <article
              key={record.id}
              className="border-border bg-surface-1 rounded-2xl border p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {record.id === session.id ? "Current session" : "Session"}
                  </p>
                  <p className="text-text-muted mt-1 text-sm">
                    Created {formatDate(record.createdAt)}; expires{" "}
                    {formatDate(record.expires)}
                  </p>
                  <p className="text-text-muted mt-1 text-xs">
                    {record.userAgentSummary}
                  </p>
                </div>
                {record.revokedAt ? (
                  <Badge variant="neutral">Revoked</Badge>
                ) : (
                  <CustomerSessionRevokeButton sessionId={record.id} />
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

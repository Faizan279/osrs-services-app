import { Badge } from "@/components/ui/badge";
import {
  CustomerNotificationReadButton,
  MarkAllNotificationsReadButton,
  PreferenceToggleForm,
} from "@/components/customer-account-forms";
import { requireCustomer } from "@/lib/auth/guards";
import {
  getCustomerNotificationPreferences,
  getCustomerNotifications,
} from "@/lib/customer/account";
import { customerNotificationTypeLabels } from "@/lib/customer/constants";

export const metadata = {
  title: "Customer notifications",
  robots: { index: false, follow: false },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function CustomerNotificationsPage() {
  const session = await requireCustomer("/account/notifications");
  const [notifications, preferences] = await Promise.all([
    getCustomerNotifications(session.user.id),
    getCustomerNotificationPreferences(session.user.id),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="info">In-app only</Badge>
          <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
            Notifications
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
            External email delivery remains unconfigured in Task 014; account
            notifications are represented truthfully in-app.
          </p>
        </div>
        <MarkAllNotificationsReadButton />
      </div>

      <section className="mt-8 grid gap-4">
        {notifications.length === 0 ? (
          <div className="border-border bg-surface-1 rounded-2xl border p-6">
            <p className="font-semibold">No notifications yet.</p>
            <p className="text-text-muted mt-2 text-sm">
              Order and security events will appear here when they exist.
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <article
              key={notification.id}
              className="border-border bg-surface-1 rounded-2xl border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        notification.status === "UNREAD" ? "warning" : "neutral"
                      }
                    >
                      {notification.status === "UNREAD" ? "Unread" : "Read"}
                    </Badge>
                    <Badge variant="info">
                      {customerNotificationTypeLabels[notification.type]}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-lg font-bold">
                    {notification.title}
                  </h2>
                  <p className="text-text-secondary mt-2 text-sm">
                    {notification.body}
                  </p>
                  <p className="text-text-muted mt-2 text-xs">
                    {formatDate(notification.createdAt)}
                    {notification.orderNumber
                      ? ` / ${notification.orderNumber}`
                      : ""}
                  </p>
                </div>
                {notification.status === "UNREAD" ? (
                  <CustomerNotificationReadButton
                    notificationId={notification.id}
                  />
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="mt-10" aria-labelledby="preferences-heading">
        <h2 id="preferences-heading" className="text-2xl font-bold">
          Preferences
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {preferences.map((preference) => (
            <PreferenceToggleForm key={preference.id} preference={preference} />
          ))}
        </div>
      </section>
    </main>
  );
}

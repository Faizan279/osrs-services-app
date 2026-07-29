import { notFound } from "next/navigation";

import { CustomBuildAdminHero } from "@/components/custom-build-admin";
import { StatusBadge } from "@/components/catalogue-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getCustomBuildRequestAdmin } from "@/lib/custom-build/admin";

export const metadata = { title: "Custom Build Request History" };
export const dynamic = "force-dynamic";

export default async function CustomBuildRequestHistoryPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  await requireCapability(
    "custom_builds.requests.review",
    `/admin/custom-builds/requests/${requestId}/history`,
  );
  const request = await getCustomBuildRequestAdmin(requestId);
  if (!request) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Request History"
        description="Append-only request status events with public messages and private internal reasons."
        icon="history"
      />
      <section className="border-border bg-surface-1 mt-8 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-3xl text-left text-sm">
          <thead className="bg-surface-2 text-text-muted">
            <tr>
              <th className="p-4">Status</th>
              <th className="p-4">Public message</th>
              <th className="p-4">Actor</th>
              <th className="p-4">Created</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {request.statusEvents.map((event) => (
              <tr key={event.id}>
                <td className="p-4">
                  <StatusBadge status={event.newStatus} />
                </td>
                <td className="text-text-secondary p-4">
                  {event.publicMessage ?? "Internal update"}
                </td>
                <td className="text-text-secondary p-4">
                  {event.actor?.name ?? event.actor?.email ?? "system"}
                </td>
                <td className="text-text-secondary p-4">
                  {event.createdAt.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

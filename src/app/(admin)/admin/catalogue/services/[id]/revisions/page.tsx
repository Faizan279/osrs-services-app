import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { formatEnumLabel } from "@/lib/catalogue/constants";
import { getAdminService } from "@/lib/catalogue/queries";

export const metadata = { title: "Catalogue publication revisions" };
export const dynamic = "force-dynamic";

export default async function ServiceRevisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/revisions`,
  );
  const service = await getAdminService(id);
  if (!service) notFound();
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Publication record</p>
          <h1 className="display-type mt-3 text-4xl">
            {service.name} revisions
          </h1>
          <p className="text-text-secondary mt-3">
            Immutable snapshots are recorded when a service is published,
            republished or archived.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/catalogue/services/${id}`}>Back to editor</Link>
        </Button>
      </div>
      {service.revisions.length ? (
        <ol className="border-border bg-surface-1 divide-border mt-8 divide-y rounded-2xl border">
          {service.revisions.map((revision) => (
            <li
              key={revision.id}
              className="grid gap-4 p-5 sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
            >
              <span className="display-type text-2xl">
                #{revision.revisionNumber}
              </span>
              <div>
                <div className="flex flex-wrap gap-2">
                  <strong>{formatEnumLabel(revision.event)}</strong>
                  <StatusBadge status={revision.publicationStatus} />
                </div>
                <p className="text-text-secondary mt-2 text-sm">
                  {revision.summary}
                </p>
                <p className="text-text-muted mt-2 text-xs">
                  by {revision.actor?.name ?? revision.actor?.email ?? "system"}
                </p>
              </div>
              <time
                className="text-text-muted text-xs"
                dateTime={revision.createdAt.toISOString()}
              >
                {revision.createdAt.toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <div className="border-border bg-surface-1 mt-8 rounded-2xl border p-8">
          <h2 className="font-bold">No publication revisions yet</h2>
          <p className="text-text-secondary mt-2 text-sm">
            Saving draft changes does not create a publication snapshot.
          </p>
        </div>
      )}
    </main>
  );
}

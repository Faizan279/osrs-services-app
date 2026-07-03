import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/catalogue-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { formatEnumLabel, gameModeLabels } from "@/lib/catalogue/constants";
import { getAdminService } from "@/lib/catalogue/queries";
import { publicationIssues } from "@/lib/catalogue/rules";

export const metadata = { title: "Catalogue service preview" };
export const dynamic = "force-dynamic";

export default async function ServicePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/preview`,
  );
  const service = await getAdminService(id);
  if (!service) notFound();
  const issues = publicationIssues(service);
  const primaryMedia =
    service.mediaReferences.find((media) => media.isPrimary) ?? null;
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex gap-2">
            <Badge variant="info">Private preview</Badge>
            <StatusBadge status={service.publicationStatus} />
            {service.hasPendingChanges && (
              <Badge variant="warning">Pending unpublished version</Badge>
            )}
          </div>
          <h1 className="display-type mt-4 text-4xl">{service.name}</h1>
          <p className="text-text-secondary mt-3">
            {service.hasPendingChanges
              ? "This preview shows pending changes. The public catalogue still shows the published version."
              : "This preview includes saved private content but never changes publication state."}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/catalogue/services/${id}`}>Back to editor</Link>
        </Button>
      </div>
      {issues.length > 0 && (
        <section className="border-warning/40 bg-warning/10 mt-8 rounded-2xl border p-5">
          <h2 className="text-warning font-bold">
            Publication checks need attention
          </h2>
          <ul className="text-text-secondary mt-3 list-disc space-y-1 pl-5 text-sm">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="border-border bg-surface-1 mt-8 grid gap-8 rounded-3xl border p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article>
          <p className="text-gold kicker-type">{service.category.name}</p>
          <h2 className="display-type mt-4 text-4xl">{service.name}</h2>
          <p className="text-text-secondary mt-5 text-lg leading-8">
            {service.shortSummary}
          </p>
          <div className="text-text-secondary mt-8 space-y-4 leading-7">
            {service.content.split(/\n{2,}/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {service.publicPreparationNotes && (
            <div className="border-info/30 bg-info/10 mt-8 rounded-xl border p-4">
              <h3 className="font-bold">Public preparation notes</h3>
              <p className="text-text-secondary mt-2 text-sm">
                {service.publicPreparationNotes}
              </p>
            </div>
          )}
        </article>
        <aside className="space-y-5">
          <div>
            <h3 className="text-sm font-bold">Availability</h3>
            <p className="text-text-secondary mt-2 text-sm">
              {formatEnumLabel(service.availabilityState)}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold">Game modes</h3>
            <ul className="text-text-secondary mt-2 space-y-2 text-sm">
              {service.gameModes.map(({ gameMode }) => (
                <li key={gameMode}>{gameModeLabels[gameMode]}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold">Requirements</h3>
            <ul className="text-text-secondary mt-2 space-y-2 text-sm">
              {service.requirements.map((requirement) => (
                <li key={requirement.id}>{requirement.title}</li>
              ))}
            </ul>
          </div>
          {primaryMedia && (
            <div>
              <h3 className="text-sm font-bold">Primary service media</h3>
              <p className="text-text-secondary mt-2 text-sm">
                {primaryMedia.altText}
              </p>
              <p className="text-text-muted mt-1 text-xs break-all">
                {primaryMedia.assetPath}
              </p>
            </div>
          )}
        </aside>
      </div>
      <section className="border-danger/30 bg-danger/5 mt-8 rounded-2xl border p-5">
        <h2 className="text-danger text-sm font-bold">
          Internal notes — admin only
        </h2>
        <p className="text-text-secondary mt-2 text-sm">
          {service.internalNotes || "No internal notes recorded."}
        </p>
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/catalogue-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { formatEnumLabel, gameModeLabels } from "@/lib/catalogue/constants";
import { getAdminService } from "@/lib/catalogue/queries";
import { publicationIssues } from "@/lib/catalogue/rules";
import { env } from "@/lib/env";

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
      {service.engineType === "CATALOGUE_CARD" && (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-primary kicker-type">Catalogue card preview</p>
              <h2 className="display-type mt-3 text-3xl">Staged offerings</h2>
            </div>
            <Badge variant="info">{service.offerings.length} total</Badge>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {service.offerings.map((offering) => (
              <article
                className="border-border bg-surface-1 rounded-2xl border p-5"
                key={offering.id}
              >
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-gold">{offering.groupLabel}</span>
                  <span className="text-text-muted">{offering.tierLabel}</span>
                  {!offering.isActive && (
                    <span className="text-warning">Inactive</span>
                  )}
                </div>
                <h3 className="mt-3 text-lg font-bold">{offering.name}</h3>
                <p className="text-text-secondary mt-2 text-sm leading-6">
                  {offering.shortSummary}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {offering.facets.map((facet) => (
                    <span
                      className="border-border rounded-full border px-2 py-1 text-xs"
                      key={facet.id}
                    >
                      {facet.label}
                    </span>
                  ))}
                </div>
                <p className="text-text-muted mt-4 text-xs">
                  {offering.requirements.length} offering requirement
                  {offering.requirements.length === 1 ? "" : "s"}
                </p>
              </article>
            ))}
          </div>
          {env.RSN_DEVELOPMENT_FIXTURE && env.NODE_ENV !== "production" && (
            <div className="border-success/30 bg-success/10 mt-6 rounded-2xl border p-5">
              <h3 className="font-bold">Eligibility preview enabled</h3>
              <p className="text-text-secondary mt-2 text-sm">
                The local deterministic public-stat profile is active for safe
                preview and screenshots. No external lookup or customer name is
                used.
              </p>
            </div>
          )}
        </section>
      )}
      {service.engineType === "SKILLING_CALCULATOR" && (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-primary kicker-type">Skilling preview</p>
              <h2 className="display-type mt-3 text-3xl">
                Staged calculator configuration
              </h2>
            </div>
            <Badge variant="info">
              {service.skillingSkills.filter((skill) => skill.enabled).length}{" "}
              enabled skills
            </Badge>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {service.skillingSkills.map((skill) => (
              <article
                className="border-border bg-surface-1 rounded-2xl border p-5"
                key={skill.id}
              >
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={skill.enabled ? "text-success" : "text-warning"}
                  >
                    {skill.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span className="text-text-muted">
                    Order {skill.displayOrder}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-bold">{skill.name}</h3>
                <p className="text-text-secondary mt-2 text-sm">
                  {skill.methods.length} method
                  {skill.methods.length === 1 ? "" : "s"} configured.
                </p>
                {skill.methods.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {skill.methods.map((method) => (
                      <li
                        className="border-border rounded-xl border p-3 text-sm"
                        key={method.id}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{method.name}</span>
                          <span
                            className={
                              method.enabled ? "text-success" : "text-warning"
                            }
                          >
                            {method.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-text-muted mt-2 text-xs">
                          Levels {method.minimumLevel}-{method.maximumLevel} -{" "}
                          {method.basePriceCentsPerMillionXp} cents per 1m XP
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {service.engineType === "BOSSING_ENGINE" && (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-primary kicker-type">Bossing preview</p>
              <h2 className="display-type mt-3 text-3xl">
                Staged PvM calculator configuration
              </h2>
            </div>
            <Badge variant="info">
              {service.bossingBosses.filter((boss) => boss.enabled).length}{" "}
              enabled bosses
            </Badge>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {service.bossingBosses.map((boss) => (
              <article
                className="border-border bg-surface-1 rounded-2xl border p-5"
                key={boss.id}
              >
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={boss.enabled ? "text-success" : "text-warning"}
                  >
                    {boss.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span className="text-text-muted">
                    Order {boss.displayOrder}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-bold">{boss.name}</h3>
                <p className="text-text-secondary mt-2 text-sm">
                  {boss.methods.length} method
                  {boss.methods.length === 1 ? "" : "s"} configured.
                </p>
                {boss.methods.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {boss.methods.map((method) => (
                      <li
                        className="border-border rounded-xl border p-3 text-sm"
                        key={method.id}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{method.name}</span>
                          <span
                            className={
                              method.enabled ? "text-success" : "text-warning"
                            }
                          >
                            {method.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-text-muted mt-2 text-xs">
                          {method.minimumKillCount.toLocaleString()}-
                          {method.maximumKillCount?.toLocaleString() ??
                            "unlimited"}{" "}
                          kills - {method.priceMode.replaceAll("_", " ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
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

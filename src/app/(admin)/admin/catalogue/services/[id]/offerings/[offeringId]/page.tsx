import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { EligibilityRuleForm, OfferingForm } from "@/components/offering-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import {
  getAdminService,
  getPrerequisiteServiceOptions,
} from "@/lib/catalogue/queries";
import {
  addOfferingRequirementAction,
  deleteOfferingRequirementAction,
  saveOfferingAction,
} from "../../../../actions";

export default async function EditOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; offeringId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { id, offeringId } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/offerings/${offeringId}`,
  );
  const [service, notice, prerequisiteOptions] = await Promise.all([
    getAdminService(id),
    searchParams,
    getPrerequisiteServiceOptions(id),
  ]);
  const offering = service?.offerings.find((item) => item.id === offeringId);
  if (!service || !offering) notFound();
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <Link
        className="text-primary text-sm font-bold"
        href={`/admin/catalogue/services/${id}/offerings`}
      >
        ← Offerings
      </Link>
      <h1 className="display-type mt-5 text-4xl">{offering.name}</h1>
      <p className="text-text-muted mt-3">
        Changes use service aggregate version {service.version}.
      </p>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
        <section className="border-border bg-surface-1 rounded-2xl border p-6">
          <OfferingForm
            action={saveOfferingAction}
            serviceId={id}
            version={service.version}
            parentModes={service.gameModes.map(({ gameMode }) => gameMode)}
            offering={offering}
          />
        </section>
        <section className="border-border bg-surface-1 mt-8 rounded-2xl border p-6">
          <h2 className="display-type text-2xl">Eligibility rules</h2>
          <p className="text-text-muted mt-2 text-sm">
            Automatic rules only use allow-listed public statistics. Quests,
            gear, inventory and ownership remain confirmation or support checks.
          </p>
          <div className="mt-5 space-y-3">
            {offering.requirements.map((requirement) => (
              <article
                className="border-border flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4"
                key={requirement.id}
              >
                <div>
                  <h3 className="font-bold">{requirement.title}</h3>
                  <p className="text-text-secondary mt-1 text-sm">
                    {requirement.description}
                  </p>
                  <p className="text-text-muted mt-2 text-xs">
                    {formatRule(
                      requirement.verificationMode,
                      requirement.metricKey,
                    )}
                  </p>
                </div>
                <form action={deleteOfferingRequirementAction}>
                  <input type="hidden" name="serviceId" value={id} />
                  <input type="hidden" name="offeringId" value={offeringId} />
                  <input
                    type="hidden"
                    name="requirementId"
                    value={requirement.id}
                  />
                  <input
                    type="hidden"
                    name="expectedVersion"
                    value={service.version}
                  />
                  <Button type="submit" variant="danger">
                    Remove
                  </Button>
                </form>
              </article>
            ))}
          </div>
          <EligibilityRuleForm
            action={addOfferingRequirementAction}
            serviceId={id}
            offeringId={offeringId}
            version={service.version}
            prerequisiteOptions={prerequisiteOptions}
          />
        </section>
      </div>
    </main>
  );
}

function formatRule(mode: string, metric: string | null) {
  return mode === "AUTOMATIC"
    ? `Automatic · ${metric}`
    : mode.replaceAll("_", " ").toLowerCase();
}

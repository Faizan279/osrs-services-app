import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CatalogueNotice,
  ServiceForm,
  StatusBadge,
  fieldClass,
  labelClass,
} from "@/components/catalogue-admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import {
  catalogueRequirementTypes,
  catalogueComparisonOperators,
  comparisonOperatorLabels,
  formatEnumLabel,
  requirementVerificationModes,
} from "@/lib/catalogue/constants";
import {
  getAdminCategories,
  getAdminService,
  getPrerequisiteServiceOptions,
} from "@/lib/catalogue/queries";
import { metricRegistry } from "@/lib/eligibility/metrics";
import {
  addMediaAction,
  addRequirementAction,
  archiveServiceAction,
  deleteMediaAction,
  deleteRequirementAction,
  discardServiceStageAction,
  duplicateServiceAction,
  publishServiceAction,
  saveServiceAction,
} from "../../actions";

export const metadata = { title: "Edit catalogue service" };
export const dynamic = "force-dynamic";

export default async function EditServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { id } = await params;
  await requireCapability("products.view", `/admin/catalogue/services/${id}`);
  const [service, categories, notice, prerequisiteOptions] = await Promise.all([
    getAdminService(id),
    getAdminCategories(),
    searchParams,
    getPrerequisiteServiceOptions(id),
  ]);
  if (!service) notFound();
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={service.publicationStatus} />
            <StatusBadge status={service.availabilityState} />
            {service.hasPendingChanges && (
              <span className="border-warning/40 bg-warning/10 text-warning rounded-full border px-3 py-1 text-xs font-bold">
                Pending unpublished changes
              </span>
            )}
          </div>
          <h1 className="display-type mt-4 text-4xl">{service.name}</h1>
          <p className="text-text-muted mt-2 text-sm">
            {service.hasPendingChanges ? (
              <>
                Pending version {service.version} · published version{" "}
                {service.publishedVersion?.version}
              </>
            ) : (
              <>Version {service.version}</>
            )}{" "}
            · last updated {service.updatedAt.toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {service.engineType === "CATALOGUE_CARD" && (
            <Button asChild variant="secondary">
              <Link href={`/admin/catalogue/services/${id}/offerings`}>
                Manage offerings
              </Link>
            </Button>
          )}
          {service.engineType === "SKILLING_CALCULATOR" && (
            <Button asChild variant="secondary">
              <Link href={`/admin/catalogue/services/${id}/skilling`}>
                Manage skilling
              </Link>
            </Button>
          )}
          {service.engineType === "BOSSING_ENGINE" && (
            <Button asChild variant="secondary">
              <Link href={`/admin/catalogue/services/${id}/bossing`}>
                Manage bossing
              </Link>
            </Button>
          )}
          {service.engineType === "PREMIUM_SERVICE_CONFIGURATOR" && (
            <Button asChild variant="secondary">
              <Link href={`/admin/catalogue/services/${id}/premium`}>
                Manage premium
              </Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link href={`/admin/catalogue/services/${id}/preview`}>
              Preview
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/admin/catalogue/services/${id}/revisions`}>
              Revisions
            </Link>
          </Button>
          <form action={duplicateServiceAction}>
            <input type="hidden" name="id" value={id} />
            <ConfirmSubmitButton
              variant="secondary"
              confirmation="Create a private draft copy of this service?"
            >
              Duplicate
            </ConfirmSubmitButton>
          </form>
          {service.publicationStatus === "PUBLISHED" &&
            !service.hasPendingChanges && (
              <form action={archiveServiceAction}>
                <input type="hidden" name="id" value={id} />
                <input
                  type="hidden"
                  name="expectedVersion"
                  value={service.version}
                />
                <ConfirmSubmitButton
                  variant="danger"
                  confirmation="Archive this service and remove it from public discovery?"
                >
                  Archive
                </ConfirmSubmitButton>
              </form>
            )}
          {service.hasPendingChanges && (
            <form action={discardServiceStageAction}>
              <input type="hidden" name="id" value={id} />
              <input
                type="hidden"
                name="expectedVersion"
                value={service.version}
              />
              <ConfirmSubmitButton
                variant="danger"
                confirmation="Discard all pending unpublished changes and restore the editor to the published version?"
              >
                Discard pending changes
              </ConfirmSubmitButton>
            </form>
          )}
          {(service.publicationStatus !== "PUBLISHED" ||
            service.hasPendingChanges) && (
            <form action={publishServiceAction}>
              <input type="hidden" name="id" value={id} />
              <input
                type="hidden"
                name="expectedVersion"
                value={service.version}
              />
              <ConfirmSubmitButton confirmation="Publish this saved version to the public catalogue?">
                {service.hasPendingChanges
                  ? "Republish pending changes"
                  : service.hasPublicationHistory
                    ? "Republish archived service"
                    : "Publish"}
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
        {service.hasPendingChanges && (
          <section
            aria-label="Pending publication state"
            className="border-warning/40 bg-warning/10 mb-6 rounded-2xl border p-5"
          >
            <h2 className="text-warning font-bold">
              Pending unpublished changes
            </h2>
            <p className="text-text-secondary mt-2 text-sm leading-6">
              The public catalogue still shows {service.publishedVersion?.name}.
              Preview shows this pending version; republish applies every staged
              field, requirement, game mode and media change together.
            </p>
          </section>
        )}
      </div>
      <div className="grid gap-8 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          aria-label="Editor sections"
          className="border-border bg-surface-1 h-fit rounded-2xl border p-4 xl:sticky xl:top-24"
        >
          <ul className="space-y-1">
            {[
              "general",
              "content",
              "modes",
              "requirements",
              "media",
              "seo",
              "publishing",
            ].map((section) => (
              <li key={section}>
                <a
                  className="text-text-secondary hover:bg-surface-2 hover:text-primary block rounded-lg px-3 py-2 text-sm font-semibold"
                  href={`#${section}`}
                >
                  {formatEnumLabel(section)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold">Service editor</h2>
            </CardHeader>
            <CardContent>
              <form action={saveServiceAction}>
                <ServiceForm service={service} categories={categories} />
              </form>
            </CardContent>
          </Card>
          <Card id="requirements">
            <CardHeader>
              <h2 className="display-type text-2xl">Requirements</h2>
              <p className="text-text-muted text-sm">
                Structured prerequisites shown on the public detail page.
                Changes to a published service remain pending until republish.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {service.requirements.length > 0 && (
                <ul className="divide-border border-border divide-y rounded-xl border">
                  {service.requirements.map((requirement) => (
                    <li
                      key={requirement.id}
                      className="flex items-start justify-between gap-4 p-4"
                    >
                      <div>
                        <strong>{requirement.title}</strong>
                        <p className="text-text-secondary mt-1 text-sm">
                          {requirement.description}
                        </p>
                        <p className="text-text-muted mt-2 text-xs">
                          {formatEnumLabel(requirement.type)} ·{" "}
                          {formatEnumLabel(requirement.verificationMode)}
                          {requirement.isRequired ? " · required" : ""}
                        </p>
                      </div>
                      <form action={deleteRequirementAction}>
                        <input type="hidden" name="serviceId" value={id} />
                        <input
                          type="hidden"
                          name="expectedVersion"
                          value={service.version}
                        />
                        <input
                          type="hidden"
                          name="requirementId"
                          value={requirement.id}
                        />
                        <ConfirmSubmitButton
                          size="sm"
                          variant="danger"
                          confirmation="Remove this requirement?"
                        >
                          Remove
                        </ConfirmSubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form
                action={addRequirementAction}
                className="bg-surface-2 grid gap-4 rounded-xl p-4 lg:grid-cols-2"
              >
                <input type="hidden" name="serviceId" value={id} />
                <input
                  type="hidden"
                  name="expectedVersion"
                  value={service.version}
                />
                <label className={labelClass}>
                  Title
                  <input className={fieldClass} name="title" required />
                </label>
                <label className={labelClass}>
                  Type
                  <select className={fieldClass} name="type">
                    {catalogueRequirementTypes.map((value) => (
                      <option key={value} value={value}>
                        {formatEnumLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`${labelClass} lg:col-span-2`}>
                  Description
                  <textarea
                    className={`${fieldClass} min-h-24`}
                    name="description"
                    required
                  />
                </label>
                <label className={labelClass}>
                  Verification
                  <select
                    className={fieldClass}
                    name="verificationMode"
                    defaultValue="SUPPORT_VERIFIED"
                  >
                    {requirementVerificationModes.map((value) => (
                      <option key={value} value={value}>
                        {formatEnumLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Order
                  <input
                    className={fieldClass}
                    type="number"
                    name="displayOrder"
                    defaultValue="0"
                    min="0"
                  />
                </label>
                <label className={labelClass}>
                  Automatic metric
                  <select className={fieldClass} name="metricKey">
                    <option value="">Not automatic</option>
                    {[...metricRegistry].map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Comparison
                  <select className={fieldClass} name="comparisonOperator">
                    <option value="">Not automatic</option>
                    {catalogueComparisonOperators.map((value) => (
                      <option key={value} value={value}>
                        {comparisonOperatorLabels[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Required value
                  <input
                    className={fieldClass}
                    type="number"
                    min="0"
                    name="requiredValue"
                  />
                </label>
                <label className={labelClass}>
                  Recommended prerequisite
                  <select className={fieldClass} name="recommendedServiceId">
                    <option value="">No recommendation</option>
                    {prerequisiteOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`${labelClass} lg:col-span-2`}>
                  Customer guidance
                  <textarea className={fieldClass} name="customerGuidance" />
                </label>
                <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" name="isRequired" defaultChecked />
                  Required
                </label>
                <Button type="submit" className="w-fit">
                  Add requirement
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card id="media">
            <CardHeader>
              <h2 className="display-type text-2xl">Media references</h2>
              <p className="text-text-muted text-sm">
                Safe internal paths or approved HTTP(S) URLs. Managed uploads
                are deferred.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {service.mediaReferences.length > 0 && (
                <ul className="divide-border border-border divide-y rounded-xl border">
                  {service.mediaReferences.map((media) => (
                    <li
                      key={media.id}
                      className="flex items-start justify-between gap-4 p-4"
                    >
                      <div>
                        <strong>{media.altText}</strong>
                        <p className="text-text-muted mt-1 text-xs break-all">
                          {media.assetPath}
                        </p>
                        {media.isPrimary && (
                          <span className="text-warning mt-2 block text-xs font-bold">
                            Primary service media
                          </span>
                        )}
                      </div>
                      <form action={deleteMediaAction}>
                        <input type="hidden" name="serviceId" value={id} />
                        <input
                          type="hidden"
                          name="expectedVersion"
                          value={service.version}
                        />
                        <input type="hidden" name="mediaId" value={media.id} />
                        <ConfirmSubmitButton
                          size="sm"
                          variant="danger"
                          confirmation="Remove this media reference?"
                        >
                          Remove
                        </ConfirmSubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form
                action={addMediaAction}
                className="bg-surface-2 grid gap-4 rounded-xl p-4 lg:grid-cols-2"
              >
                <input type="hidden" name="serviceId" value={id} />
                <input
                  type="hidden"
                  name="expectedVersion"
                  value={service.version}
                />
                <label className={`${labelClass} lg:col-span-2`}>
                  Asset path or URL
                  <input className={fieldClass} name="assetPath" required />
                </label>
                <label className={labelClass}>
                  Alt text
                  <input className={fieldClass} name="altText" required />
                </label>
                <label className={labelClass}>
                  Caption
                  <input className={fieldClass} name="caption" />
                </label>
                <label className={labelClass}>
                  Order
                  <input
                    className={fieldClass}
                    type="number"
                    name="displayOrder"
                    defaultValue="0"
                    min="0"
                  />
                </label>
                <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" name="isPrimary" />
                  Primary media
                </label>
                <Button type="submit" className="w-fit">
                  Add media reference
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

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
  formatEnumLabel,
  requirementVerificationModes,
} from "@/lib/catalogue/constants";
import { getAdminCategories, getAdminService } from "@/lib/catalogue/queries";
import {
  addMediaAction,
  addRequirementAction,
  archiveServiceAction,
  deleteMediaAction,
  deleteRequirementAction,
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
  const [service, categories, notice] = await Promise.all([
    getAdminService(id),
    getAdminCategories(),
    searchParams,
  ]);
  if (!service) notFound();
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={service.publicationStatus} />
            <StatusBadge status={service.availabilityState} />
          </div>
          <h1 className="display-type mt-4 text-4xl">{service.name}</h1>
          <p className="text-text-muted mt-2 text-sm">
            Version {service.version} · last updated{" "}
            {service.updatedAt.toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          {service.publicationStatus !== "ARCHIVED" && (
            <form action={archiveServiceAction}>
              <input type="hidden" name="id" value={id} />
              <ConfirmSubmitButton
                variant="danger"
                confirmation="Archive this service and remove it from public discovery?"
              >
                Archive
              </ConfirmSubmitButton>
            </form>
          )}
          <form action={publishServiceAction}>
            <input type="hidden" name="id" value={id} />
            <ConfirmSubmitButton confirmation="Publish this saved version to the public catalogue?">
              {service.publicationStatus === "PUBLISHED"
                ? "Republish"
                : "Publish"}
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
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
                  <select className={fieldClass} name="verificationMode">
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
                      </div>
                      <form action={deleteMediaAction}>
                        <input type="hidden" name="serviceId" value={id} />
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

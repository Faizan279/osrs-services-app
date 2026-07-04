import type {
  CatalogueCategory,
  CatalogueService,
} from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormStateIndicator } from "@/components/form-state-indicator";
import {
  catalogueAvailabilityStates,
  catalogueEngineTypes,
  catalogueGameModes,
  engineTypeLabels,
  formatEnumLabel,
  gameModeLabels,
} from "@/lib/catalogue/constants";

export const fieldClass =
  "border-border bg-background/70 text-text-primary focus:border-primary focus:ring-primary/25 min-h-11 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";
export const labelClass =
  "text-text-secondary grid gap-2 text-sm font-semibold";

export function CatalogueNotice({
  state,
  message,
}: {
  state?: string;
  message?: string;
}) {
  if (!state) return null;
  return (
    <div
      role={state === "error" ? "alert" : "status"}
      className={`mb-6 rounded-xl border px-4 py-3 text-sm ${state === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success"}`}
    >
      {message ||
        (state === "saved" ? "Changes saved." : "Check the submitted values.")}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "PUBLISHED" || status === "AVAILABLE"
      ? "success"
      : status === "ARCHIVED" || status === "UNAVAILABLE"
        ? "danger"
        : "warning";
  return <Badge variant={variant}>{formatEnumLabel(status)}</Badge>;
}

export function CategoryForm({ category }: { category?: CatalogueCategory }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {category && <input type="hidden" name="id" value={category.id} />}
      <label className={labelClass}>
        Name
        <input
          className={fieldClass}
          name="name"
          required
          defaultValue={category?.name}
        />
      </label>
      <label className={labelClass}>
        URL slug
        <input
          className={fieldClass}
          name="slug"
          required
          defaultValue={category?.slug}
        />
      </label>
      <label className={`${labelClass} lg:col-span-2`}>
        Short description
        <textarea
          className={`${fieldClass} min-h-24`}
          name="shortDescription"
          required
          defaultValue={category?.shortDescription}
        />
      </label>
      <label className={`${labelClass} lg:col-span-2`}>
        Full description
        <textarea
          className={`${fieldClass} min-h-36`}
          name="description"
          defaultValue={category?.description ?? ""}
        />
      </label>
      <label className={labelClass}>
        Icon key
        <input
          className={fieldClass}
          name="iconKey"
          defaultValue={category?.iconKey ?? ""}
        />
      </label>
      <label className={labelClass}>
        Image path or approved URL
        <input
          className={fieldClass}
          name="imagePath"
          defaultValue={category?.imagePath ?? ""}
        />
      </label>
      <label className={labelClass}>
        Display order
        <input
          className={fieldClass}
          name="displayOrder"
          type="number"
          min="0"
          defaultValue={category?.displayOrder ?? 0}
        />
      </label>
      <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={category?.isActive ?? true}
        />{" "}
        Active and publicly discoverable
      </label>
      <label className={labelClass}>
        SEO title
        <input
          className={fieldClass}
          name="seoTitle"
          defaultValue={category?.seoTitle ?? ""}
        />
      </label>
      <label className={labelClass}>
        SEO description
        <textarea
          className={`${fieldClass} min-h-24`}
          name="seoDescription"
          defaultValue={category?.seoDescription ?? ""}
        />
      </label>
      <div className="lg:col-span-2">
        <Button type="submit">
          {category ? "Save category" : "Create category"}
        </Button>
      </div>
    </div>
  );
}

type EditableService = CatalogueService & {
  gameModes: { gameMode: (typeof catalogueGameModes)[number] }[];
  hasPendingChanges?: boolean;
};

function localDate(value: Date | null | undefined) {
  if (!value) return "";
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function ServiceForm({
  service,
  categories,
}: {
  service?: EditableService;
  categories: CatalogueCategory[];
}) {
  const selectedModes = new Set(
    service?.gameModes.map(({ gameMode }) => gameMode) ?? ["NORMAL"],
  );
  return (
    <div className="grid gap-8">
      <div className="border-border bg-surface-2 flex items-center justify-between rounded-xl border px-4 py-3">
        <span className="text-text-secondary text-sm font-bold">
          {service?.hasPendingChanges
            ? "Editing pending unpublished version"
            : "Editor state"}
        </span>
        <FormStateIndicator />
      </div>
      {service && (
        <>
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="expectedVersion" value={service.version} />
        </>
      )}
      {!service && <input type="hidden" name="expectedVersion" value="1" />}
      <fieldset id="general" className="grid gap-5 border-0 p-0 lg:grid-cols-2">
        <legend className="display-type mb-5 text-2xl">General</legend>
        <label className={labelClass}>
          Name
          <input
            className={fieldClass}
            name="name"
            required
            defaultValue={service?.name}
          />
        </label>
        <label className={labelClass}>
          Category
          <select
            className={fieldClass}
            name="categoryId"
            required
            defaultValue={service?.categoryId ?? ""}
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Service slug
          <input
            className={fieldClass}
            name="slug"
            required
            defaultValue={service?.slug}
          />
        </label>
        <label className={labelClass}>
          Canonical slug
          <input
            className={fieldClass}
            name="canonicalSlug"
            required
            defaultValue={service?.canonicalSlug}
          />
        </label>
        <label className={labelClass}>
          Service type
          <select
            className={fieldClass}
            name="serviceType"
            defaultValue={service?.serviceType ?? "SERVICE"}
          >
            {["SERVICE", "PRODUCT", "MARKETPLACE"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Engine type
          <select
            className={fieldClass}
            name="engineType"
            defaultValue={service?.engineType ?? "CATALOGUE_CARD"}
          >
            {catalogueEngineTypes.map((value) => (
              <option key={value} value={value}>
                {engineTypeLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Availability
          <select
            className={fieldClass}
            name="availabilityState"
            defaultValue={service?.availabilityState ?? "AVAILABLE"}
          >
            {catalogueAvailabilityStates.map((value) => (
              <option key={value} value={value}>
                {formatEnumLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Display order
          <input
            className={fieldClass}
            name="displayOrder"
            type="number"
            min="0"
            defaultValue={service?.displayOrder ?? 0}
          />
        </label>
        <div className="flex flex-wrap gap-5 lg:col-span-2">
          {[
            ["isFeatured", "Featured", service?.isFeatured ?? false],
            ["isQuoteOnly", "Quote only", service?.isQuoteOnly ?? true],
            [
              "needsClientReview",
              "Needs client review",
              service?.needsClientReview ?? true,
            ],
          ].map(([name, label, enabled]) => (
            <label
              key={String(name)}
              className="text-text-secondary flex items-center gap-2 text-sm font-semibold"
            >
              <input
                name={String(name)}
                type="checkbox"
                defaultChecked={Boolean(enabled)}
              />
              {String(label)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset id="content" className="grid gap-5 border-0 p-0">
        <legend className="display-type mb-5 text-2xl">Public content</legend>
        <label className={labelClass}>
          Short summary
          <textarea
            className={`${fieldClass} min-h-24`}
            name="shortSummary"
            required
            defaultValue={service?.shortSummary}
          />
        </label>
        <label className={labelClass}>
          Service description
          <textarea
            className={`${fieldClass} min-h-56`}
            name="content"
            required
            defaultValue={service?.content}
          />
        </label>
        <label className={labelClass}>
          Public preparation notes
          <textarea
            className={`${fieldClass} min-h-28`}
            name="publicPreparationNotes"
            defaultValue={service?.publicPreparationNotes ?? ""}
          />
        </label>
        <label className={labelClass}>
          Internal notes (never public)
          <textarea
            className={`${fieldClass} min-h-28`}
            name="internalNotes"
            defaultValue={service?.internalNotes ?? ""}
          />
        </label>
      </fieldset>
      <fieldset id="modes" className="border-0 p-0">
        <legend className="display-type mb-5 text-2xl">
          Supported game modes
        </legend>
        <div className="flex flex-wrap gap-4">
          {catalogueGameModes.map((mode) => (
            <label
              key={mode}
              className="border-border bg-surface-2 text-text-secondary flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
            >
              <input
                name="gameModes"
                value={mode}
                type="checkbox"
                defaultChecked={selectedModes.has(mode)}
              />
              {gameModeLabels[mode]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset id="seo" className="grid gap-5 border-0 p-0 lg:grid-cols-2">
        <legend className="display-type mb-5 text-2xl lg:col-span-2">
          SEO
        </legend>
        <label className={labelClass}>
          SEO title
          <input
            className={fieldClass}
            name="seoTitle"
            defaultValue={service?.seoTitle ?? ""}
          />
        </label>
        <label className={labelClass}>
          SEO description
          <textarea
            className={`${fieldClass} min-h-24`}
            name="seoDescription"
            defaultValue={service?.seoDescription ?? ""}
          />
        </label>
      </fieldset>
      <fieldset
        id="publishing"
        className="grid gap-5 border-0 p-0 lg:grid-cols-2"
      >
        <legend className="display-type mb-5 text-2xl lg:col-span-2">
          Publishing schedule
        </legend>
        <label className={labelClass}>
          Publish at
          <input
            className={fieldClass}
            name="publishAt"
            type="datetime-local"
            defaultValue={localDate(service?.publishAt)}
          />
        </label>
        <label className={labelClass}>
          Unpublish at
          <input
            className={fieldClass}
            name="unpublishAt"
            type="datetime-local"
            defaultValue={localDate(service?.unpublishAt)}
          />
        </label>
        <p className="text-text-muted text-xs lg:col-span-2">
          {service?.publicationStatus === "PUBLISHED"
            ? "Saving stages an unpublished version. The current public service stays unchanged until Republish succeeds."
            : "Saving remains private. Use the explicit publish control after previewing and resolving validation issues."}
        </p>
      </fieldset>
      <Button type="submit" className="w-fit">
        {service?.publicationStatus === "PUBLISHED"
          ? "Save unpublished changes"
          : service
            ? "Save private draft"
            : "Create draft service"}
      </Button>
    </div>
  );
}

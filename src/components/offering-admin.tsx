import { Button } from "@/components/ui/button";
import {
  catalogueComparisonOperators,
  catalogueGameModes,
  catalogueRequirementTypes,
  comparisonOperatorLabels,
  gameModeLabels,
  requirementVerificationModes,
  formatEnumLabel,
} from "@/lib/catalogue/constants";
import { fieldClass, labelClass } from "@/components/catalogue-admin";
import { metricRegistry } from "@/lib/eligibility/metrics";

type EditableOffering = {
  id: string;
  slug: string;
  name: string;
  shortSummary: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  needsClientReview: boolean;
  groupLabel: string | null;
  tierLabel: string | null;
  quantityEnabled: boolean;
  quantityUnit: string | null;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  gameModes: Array<{ gameMode: string }>;
  facets: Array<{ facetKey: string; facetValue: string; label: string }>;
};

export function OfferingForm({
  serviceId,
  version,
  parentModes,
  offering,
  action,
}: {
  serviceId: string;
  version: number;
  parentModes: string[];
  offering?: EditableOffering;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="expectedVersion" value={version} />
      {offering && (
        <input type="hidden" name="offeringId" value={offering.id} />
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>
          Offering name
          <input
            className={fieldClass}
            name="name"
            required
            defaultValue={offering?.name}
          />
        </label>
        <label className={labelClass}>
          Slug
          <input
            className={fieldClass}
            name="slug"
            required
            defaultValue={offering?.slug}
          />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Short summary
          <textarea
            className={`${fieldClass} min-h-24`}
            name="shortSummary"
            required
            defaultValue={offering?.shortSummary}
          />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Description
          <textarea
            className={`${fieldClass} min-h-32`}
            name="description"
            defaultValue={offering?.description ?? ""}
          />
        </label>
        <label className={labelClass}>
          Group label
          <input
            className={fieldClass}
            name="groupLabel"
            defaultValue={offering?.groupLabel ?? ""}
          />
        </label>
        <label className={labelClass}>
          Tier label
          <input
            className={fieldClass}
            name="tierLabel"
            defaultValue={offering?.tierLabel ?? ""}
          />
        </label>
        <label className={labelClass}>
          Display order
          <input
            className={fieldClass}
            type="number"
            min="0"
            name="displayOrder"
            defaultValue={offering?.displayOrder ?? 10}
          />
        </label>
      </div>
      <fieldset className="border-border rounded-2xl border p-5">
        <legend className="px-2 font-bold">Supported game modes</legend>
        <p className="text-text-muted mb-4 text-sm">
          Leave every mode clear to inherit all parent service modes.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {catalogueGameModes
            .filter((mode) => parentModes.includes(mode))
            .map((mode) => (
              <label className="flex items-center gap-3 text-sm" key={mode}>
                <input
                  type="checkbox"
                  name="gameModes"
                  value={mode}
                  defaultChecked={offering?.gameModes.some(
                    (item) => item.gameMode === mode,
                  )}
                />
                {gameModeLabels[mode]}
              </label>
            ))}
        </div>
      </fieldset>
      <label className={labelClass}>
        Facets
        <textarea
          className={`${fieldClass} min-h-32 font-mono`}
          name="facets"
          placeholder="tier|hard|Hard"
          defaultValue={offering?.facets
            .map(
              (facet) => `${facet.facetKey}|${facet.facetValue}|${facet.label}`,
            )
            .join("\n")}
        />
        <span className="text-text-muted text-xs">
          One normalized key|value|customer label per line.
        </span>
      </label>
      <fieldset className="border-border rounded-2xl border p-5">
        <legend className="px-2 font-bold">Quantity configuration</legend>
        <label className="mb-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="quantityEnabled"
            defaultChecked={offering?.quantityEnabled}
          />{" "}
          Enable bounded quantity input
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            Unit
            <input
              className={fieldClass}
              name="quantityUnit"
              defaultValue={offering?.quantityUnit ?? ""}
            />
          </label>
          <label className={labelClass}>
            Minimum
            <input
              className={fieldClass}
              type="number"
              min="0"
              name="minimumQuantity"
              defaultValue={offering?.minimumQuantity ?? ""}
            />
          </label>
          <label className={labelClass}>
            Maximum
            <input
              className={fieldClass}
              type="number"
              min="0"
              name="maximumQuantity"
              defaultValue={offering?.maximumQuantity ?? ""}
            />
          </label>
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={offering?.isActive ?? true}
          />{" "}
          Active
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={offering?.isFeatured}
          />{" "}
          Featured
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={offering?.needsClientReview ?? true}
          />{" "}
          Needs client review
        </label>
      </div>
      <Button type="submit">Save offering</Button>
    </form>
  );
}

export function EligibilityRuleForm({
  serviceId,
  offeringId,
  version,
  prerequisiteOptions,
  action,
}: {
  serviceId: string;
  offeringId: string;
  version: number;
  prerequisiteOptions: Array<{ id: string; name: string }>;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      className="border-border bg-background/40 mt-5 grid gap-4 rounded-2xl border p-5 sm:grid-cols-2"
    >
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <label className={labelClass}>
        Title
        <input className={fieldClass} name="title" required />
      </label>
      <label className={labelClass}>
        Type
        <select className={fieldClass} name="type">
          {catalogueRequirementTypes.map((value) => (
            <option value={value} key={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Description
        <textarea className={fieldClass} name="description" required />
      </label>
      <label className={labelClass}>
        Verification mode
        <select
          className={fieldClass}
          name="verificationMode"
          defaultValue="SUPPORT_VERIFIED"
        >
          {requirementVerificationModes.map((value) => (
            <option value={value} key={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Automatic metric
        <select className={fieldClass} name="metricKey">
          <option value="">Not automatic</option>
          {[...metricRegistry].map(([key, label]) => (
            <option value={key} key={key}>
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
            <option value={value} key={value}>
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
      <label className={`${labelClass} sm:col-span-2`}>
        Customer guidance
        <textarea className={fieldClass} name="customerGuidance" />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Recommended prerequisite
        <select className={fieldClass} name="recommendedServiceId">
          <option value="">No recommendation</option>
          {prerequisiteOptions.map((option) => (
            <option value={option.id} key={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Display order
        <input
          className={fieldClass}
          type="number"
          min="0"
          name="displayOrder"
          defaultValue="10"
        />
      </label>
      <label className="flex items-center gap-3 self-end pb-3 text-sm">
        <input type="checkbox" name="isRequired" defaultChecked /> Required
      </label>
      <Button type="submit" className="sm:col-span-2">
        Add eligibility rule
      </Button>
    </form>
  );
}

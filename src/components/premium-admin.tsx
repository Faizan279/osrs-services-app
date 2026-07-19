import { Crown, PackagePlus, SlidersHorizontal, Sparkles } from "lucide-react";

import { fieldClass, labelClass } from "@/components/catalogue-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  StagedPremiumOption,
  StagedPremiumPackage,
  StagedPremiumRule,
} from "@/lib/catalogue/staging";
import {
  premiumOptionPricingModeLabels,
  premiumOptionTypeLabels,
} from "@/lib/premium/constants";

export function PremiumRuleForm({
  serviceId,
  version,
  rule,
  action,
}: {
  serviceId: string;
  version: number;
  rule: StagedPremiumRule | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const current = rule ?? defaultRule();
  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <fieldset className="grid gap-4 border-0 p-0 md:grid-cols-2">
        <legend className="display-type mb-2 text-2xl">
          Account mode multipliers
        </legend>
        <NumberField
          name="normalModeMultiplierBps"
          label="Normal bps"
          defaultValue={current.normalModeMultiplierBps}
        />
        <NumberField
          name="ironmanMultiplierBps"
          label="Ironman bps"
          defaultValue={current.ironmanMultiplierBps}
        />
        <NumberField
          name="hardcoreIronmanMultiplierBps"
          label="Hardcore Ironman bps"
          defaultValue={current.hardcoreIronmanMultiplierBps}
        />
        <NumberField
          name="ultimateIronmanMultiplierBps"
          label="Ultimate Ironman bps"
          defaultValue={current.ultimateIronmanMultiplierBps}
        />
      </fieldset>
      <fieldset className="grid gap-4 border-0 p-0 md:grid-cols-3">
        <legend className="display-type mb-2 text-2xl">Public add-ons</legend>
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="discordStreamEnabled"
            defaultChecked={current.discordStreamEnabled}
          />
          Discord Stream enabled
        </label>
        <NumberField
          name="discordStreamPercentBps"
          label="Discord Stream bps"
          defaultValue={current.discordStreamPercentBps}
        />
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="rsnEligibilityEnabled"
            defaultChecked={current.rsnEligibilityEnabled}
          />
          Optional RSN public-stat checks
        </label>
      </fieldset>
      <div className="grid gap-4 xl:grid-cols-3">
        <DeliveryFields
          prefix="standard"
          title="Standard delivery"
          enabled={current.standardDeliveryEnabled}
          label={current.standardDeliveryLabel}
          description={current.standardDeliveryDescription}
          estimate={current.standardDeliveryEstimate}
          multiplierBps={current.standardDeliveryMultiplierBps}
          fixedFeeCents={current.standardDeliveryFixedFeeCents}
        />
        <DeliveryFields
          prefix="priority"
          title="Priority delivery"
          enabled={current.priorityDeliveryEnabled}
          label={current.priorityDeliveryLabel}
          description={current.priorityDeliveryDescription}
          estimate={current.priorityDeliveryEstimate}
          multiplierBps={current.priorityDeliveryMultiplierBps}
          fixedFeeCents={current.priorityDeliveryFixedFeeCents}
        />
        <DeliveryFields
          prefix="express"
          title="Express delivery"
          enabled={current.expressDeliveryEnabled}
          label={current.expressDeliveryLabel}
          description={current.expressDeliveryDescription}
          estimate={current.expressDeliveryEstimate}
          multiplierBps={current.expressDeliveryMultiplierBps}
          fixedFeeCents={current.expressDeliveryFixedFeeCents}
        />
      </div>
      <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          name="needsClientReview"
          defaultChecked={current.needsClientReview}
        />
        Needs client review
      </label>
      <Button type="submit" className="w-fit">
        <SlidersHorizontal className="mr-2 size-4" aria-hidden="true" />
        Save premium rules
      </Button>
    </form>
  );
}

export function PremiumPackageForm({
  serviceId,
  version,
  premiumPackage,
  action,
}: {
  serviceId: string;
  version: number;
  premiumPackage?: StagedPremiumPackage;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="expectedVersion" value={version} />
      {premiumPackage && (
        <input type="hidden" name="packageId" value={premiumPackage.id} />
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>
          Package name
          <input
            className={fieldClass}
            name="name"
            defaultValue={premiumPackage?.name}
            required
          />
        </label>
        <label className={labelClass}>
          Slug
          <input
            className={fieldClass}
            name="slug"
            defaultValue={premiumPackage?.slug}
            required
          />
        </label>
        <NumberField
          name="displayOrder"
          label="Display order"
          defaultValue={premiumPackage?.displayOrder ?? 10}
        />
        <label className={labelClass}>
          Tier label
          <input
            className={fieldClass}
            name="difficultyTierLabel"
            defaultValue={premiumPackage?.difficultyTierLabel ?? ""}
          />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Short description
          <textarea
            className={`${fieldClass} min-h-24`}
            name="shortDescription"
            defaultValue={premiumPackage?.shortDescription}
            required
          />
        </label>
      </div>
      <fieldset className="border-border grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
        <legend className="px-2 font-bold">Package pricing</legend>
        <NumberField
          name="basePriceCents"
          label="Base cents"
          defaultValue={premiumPackage?.basePriceCents ?? 2000}
        />
        <NumberField
          name="minimumPriceCents"
          label="Minimum cents"
          defaultValue={premiumPackage?.minimumPriceCents ?? 2000}
        />
        <NumberField
          name="setupFeeCents"
          label="Setup fee cents"
          defaultValue={premiumPackage?.setupFeeCents ?? 0}
        />
        <NumberField
          name="estimatedHours"
          label="Estimated hours"
          defaultValue={premiumPackage?.estimatedHours ?? ""}
          min={1}
        />
        <label className="text-text-secondary flex items-center gap-3 pt-8 text-sm font-semibold">
          <input
            name="customerGearRequired"
            type="checkbox"
            defaultChecked={premiumPackage?.customerGearRequired ?? true}
          />
          Gear confirmation enabled
        </label>
        <label className={labelClass}>
          Gear confirmation label
          <input
            className={fieldClass}
            name="customerGearLabel"
            defaultValue={premiumPackage?.customerGearLabel ?? ""}
          />
        </label>
        <NumberField
          name="gearUnconfirmedAdjustmentCents"
          label="Gear adjustment cents"
          defaultValue={premiumPackage?.gearUnconfirmedAdjustmentCents ?? 0}
        />
      </fieldset>
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>
          Requirement summary
          <textarea
            className={`${fieldClass} min-h-28`}
            name="requirementsSummary"
            defaultValue={premiumPackage?.requirementsSummary ?? ""}
          />
        </label>
        <label className={labelClass}>
          Gear notes
          <textarea
            className={`${fieldClass} min-h-28`}
            name="gearNotes"
            defaultValue={premiumPackage?.gearNotes ?? ""}
          />
        </label>
        <label className={labelClass}>
          Unlock notes
          <textarea
            className={`${fieldClass} min-h-28`}
            name="unlockNotes"
            defaultValue={premiumPackage?.unlockNotes ?? ""}
          />
        </label>
        <label className={labelClass}>
          Requirement groups
          <textarea
            className={`${fieldClass} min-h-36 font-mono text-xs`}
            name="requirementGroups"
            defaultValue={requirementGroupText(premiumPackage)}
            placeholder="Stats|Public stats|Attack level|60 Attack required|AUTOMATIC|skill.attack.level|60|Optional guidance"
          />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          FAQs
          <textarea
            className={`${fieldClass} min-h-28 font-mono text-xs`}
            name="faqs"
            defaultValue={faqText(premiumPackage)}
            placeholder="Can I use my own gear?|Yes. Confirm gear before requesting review."
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={premiumPackage?.enabled ?? true}
          />
          Enabled publicly
        </label>
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={premiumPackage?.needsClientReview ?? true}
          />
          Needs client review
        </label>
      </div>
      <Button type="submit">
        <PackagePlus className="mr-2 size-4" aria-hidden="true" />
        Save package
      </Button>
    </form>
  );
}

export function PremiumOptionForm({
  serviceId,
  version,
  packages,
  option,
  action,
}: {
  serviceId: string;
  version: number;
  packages: StagedPremiumPackage[];
  option?: StagedPremiumOption;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="expectedVersion" value={version} />
      {option && <input type="hidden" name="optionId" value={option.id} />}
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>
          Package scope
          <select
            className={fieldClass}
            name="packageId"
            defaultValue={option?.packageId ?? ""}
          >
            <option value="">All packages</option>
            {packages.map((premiumPackage) => (
              <option value={premiumPackage.id} key={premiumPackage.id}>
                {premiumPackage.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Option name
          <input
            className={fieldClass}
            name="name"
            defaultValue={option?.name}
            required
          />
        </label>
        <label className={labelClass}>
          Slug
          <input
            className={fieldClass}
            name="slug"
            defaultValue={option?.slug}
            required
          />
        </label>
        <NumberField
          name="displayOrder"
          label="Display order"
          defaultValue={option?.displayOrder ?? 10}
        />
        <label className={`${labelClass} md:col-span-2`}>
          Description
          <textarea
            className={`${fieldClass} min-h-24`}
            name="description"
            defaultValue={option?.description}
            required
          />
        </label>
      </div>
      <fieldset className="border-border grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
        <legend className="px-2 font-bold">Pricing</legend>
        <label className={labelClass}>
          Option type
          <select
            className={fieldClass}
            name="optionType"
            defaultValue={option?.optionType ?? "ADDON"}
          >
            {Object.entries(premiumOptionTypeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Pricing mode
          <select
            className={fieldClass}
            name="pricingMode"
            defaultValue={option?.pricingMode ?? "FIXED_FEE"}
          >
            {Object.entries(premiumOptionPricingModeLabels).map(
              ([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <NumberField
          name="fixedPriceCents"
          label="Fixed cents"
          defaultValue={option?.fixedPriceCents ?? 500}
        />
        <NumberField
          name="percentBps"
          label="Percent bps"
          defaultValue={option?.percentBps ?? 0}
        />
        <NumberField
          name="perUnitPriceCents"
          label="Per-unit cents"
          defaultValue={option?.perUnitPriceCents ?? 0}
        />
        <NumberField
          name="minimumQuantity"
          label="Minimum quantity"
          defaultValue={option?.minimumQuantity ?? 1}
          min={1}
        />
        <NumberField
          name="maximumQuantity"
          label="Maximum quantity"
          defaultValue={option?.maximumQuantity ?? 1}
          min={1}
        />
        <NumberField
          name="defaultQuantity"
          label="Default quantity"
          defaultValue={option?.defaultQuantity ?? 1}
          min={1}
        />
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="customerInputRequired"
            defaultChecked={option?.customerInputRequired}
          />
          Quantity/input required
        </label>
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={option?.enabled ?? true}
          />
          Enabled publicly
        </label>
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={option?.needsClientReview ?? true}
          />
          Needs client review
        </label>
      </div>
      <Button type="submit">
        <Sparkles className="mr-2 size-4" aria-hidden="true" />
        Save option
      </Button>
    </form>
  );
}

export function PremiumPackageCard({
  premiumPackage,
  serviceId,
}: {
  premiumPackage: StagedPremiumPackage;
  serviceId: string;
}) {
  return (
    <div className="border-border bg-surface-1 rounded-2xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-bold">{premiumPackage.name}</h3>
          <p className="text-text-secondary mt-2 text-sm leading-6">
            {premiumPackage.shortDescription}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={premiumPackage.enabled ? "success" : "warning"}>
            {premiumPackage.enabled ? "Public" : "Hidden"}
          </Badge>
          <Badge variant="info">
            {premiumPackage.requirementGroups.length} group
            {premiumPackage.requirementGroups.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <a
            href={`/admin/catalogue/services/${serviceId}/premium/packages/${premiumPackage.id}`}
          >
            Edit package
          </a>
        </Button>
        <Button asChild variant="ghost">
          <a
            href={`/admin/catalogue/services/${serviceId}/premium/options/new`}
          >
            Add option
          </a>
        </Button>
      </div>
    </div>
  );
}

export function PremiumOptionCard({
  option,
  packages,
  serviceId,
}: {
  option: StagedPremiumOption;
  packages: StagedPremiumPackage[];
  serviceId: string;
}) {
  const packageName =
    packages.find((premiumPackage) => premiumPackage.id === option.packageId)
      ?.name ?? "All packages";
  return (
    <div className="border-border bg-surface-1 rounded-2xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-bold">{option.name}</h3>
          <p className="text-text-secondary mt-2 text-sm leading-6">
            {option.description}
          </p>
          <p className="text-text-muted mt-2 text-xs">{packageName}</p>
        </div>
        <Badge variant={option.enabled ? "success" : "warning"}>
          {option.enabled ? "Public" : "Hidden"}
        </Badge>
      </div>
      <Button asChild className="mt-4" variant="secondary">
        <a
          href={`/admin/catalogue/services/${serviceId}/premium/options/${option.id}`}
        >
          Edit option
        </a>
      </Button>
    </div>
  );
}

export function AdminPremiumPreview({
  estimate,
}: {
  estimate: {
    packageName: string;
    total: string;
    optionCount: number;
  } | null;
}) {
  return (
    <div className="border-primary/25 bg-primary/10 rounded-2xl border p-5">
      <div className="flex items-center gap-3">
        <Crown className="text-primary size-5" aria-hidden="true" />
        <h2 className="font-bold">Preview calculation</h2>
      </div>
      {estimate ? (
        <p className="text-text-secondary mt-3 text-sm leading-6">
          {estimate.packageName}: {estimate.total} with{" "}
          {estimate.optionCount.toLocaleString()} option
          {estimate.optionCount === 1 ? "" : "s"}.
        </p>
      ) : (
        <p className="text-text-secondary mt-3 text-sm leading-6">
          Enable a package and premium rules to show a staged preview.
        </p>
      )}
    </div>
  );
}

function requirementGroupText(premiumPackage?: StagedPremiumPackage) {
  return (
    premiumPackage?.requirementGroups
      .flatMap((group) =>
        group.requirements.map((requirement) =>
          [
            group.title,
            group.description ?? "",
            requirement.label,
            requirement.description,
            requirement.verificationMode,
            requirement.metricKey ?? "",
            requirement.requiredValue ?? "",
            requirement.customerGuidance ?? "",
          ].join("|"),
        ),
      )
      .join("\n") ?? ""
  );
}

function faqText(premiumPackage?: StagedPremiumPackage) {
  return (
    premiumPackage?.faqs
      .map((faq) => [faq.question, faq.answer].join("|"))
      .join("\n") ?? ""
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min = 0,
}: {
  name: string;
  label: string;
  defaultValue: number | string;
  min?: number;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        className={fieldClass}
        name={name}
        type="number"
        min={min}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function DeliveryFields({
  prefix,
  title,
  enabled,
  label,
  description,
  estimate,
  multiplierBps,
  fixedFeeCents,
}: {
  prefix: "standard" | "priority" | "express";
  title: string;
  enabled: boolean;
  label: string;
  description: string | null;
  estimate: string | null;
  multiplierBps: number;
  fixedFeeCents: number;
}) {
  const fieldPrefix =
    prefix === "standard"
      ? "standardDelivery"
      : prefix === "priority"
        ? "priorityDelivery"
        : "expressDelivery";
  return (
    <fieldset className="border-border grid gap-3 rounded-2xl border p-4">
      <legend className="px-2 font-bold">{title}</legend>
      <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          name={`${fieldPrefix}Enabled`}
          defaultChecked={enabled}
        />
        Enabled
      </label>
      <label className={labelClass}>
        Label
        <input
          className={fieldClass}
          name={`${fieldPrefix}Label`}
          defaultValue={label}
        />
      </label>
      <label className={labelClass}>
        Description
        <textarea
          className={`${fieldClass} min-h-20`}
          name={`${fieldPrefix}Description`}
          defaultValue={description ?? ""}
        />
      </label>
      <label className={labelClass}>
        Estimate
        <input
          className={fieldClass}
          name={`${fieldPrefix}Estimate`}
          defaultValue={estimate ?? ""}
        />
      </label>
      <NumberField
        name={`${fieldPrefix}MultiplierBps`}
        label="Multiplier bps"
        defaultValue={multiplierBps}
      />
      <NumberField
        name={`${fieldPrefix}FixedFeeCents`}
        label="Fixed fee cents"
        defaultValue={fixedFeeCents}
      />
    </fieldset>
  );
}

function defaultRule(): StagedPremiumRule {
  return {
    id: "new",
    normalModeMultiplierBps: 0,
    ironmanMultiplierBps: 1000,
    hardcoreIronmanMultiplierBps: 2000,
    ultimateIronmanMultiplierBps: 3000,
    discordStreamEnabled: true,
    discordStreamPercentBps: 200,
    rsnEligibilityEnabled: true,
    standardDeliveryEnabled: true,
    standardDeliveryLabel: "Standard",
    standardDeliveryDescription: "Standard review queue for premium work.",
    standardDeliveryEstimate: "Estimate confirmed before checkout",
    standardDeliveryMultiplierBps: 0,
    standardDeliveryFixedFeeCents: 0,
    priorityDeliveryEnabled: false,
    priorityDeliveryLabel: "Priority",
    priorityDeliveryDescription: "Faster queue when staff capacity allows.",
    priorityDeliveryEstimate: "Faster estimate, client review required",
    priorityDeliveryMultiplierBps: 1500,
    priorityDeliveryFixedFeeCents: 0,
    expressDeliveryEnabled: false,
    expressDeliveryLabel: "Express",
    expressDeliveryDescription:
      "Fastest configured queue for eligible premium work.",
    expressDeliveryEstimate: "Fastest estimate, client review required",
    expressDeliveryMultiplierBps: 3000,
    expressDeliveryFixedFeeCents: 0,
    needsClientReview: true,
  };
}

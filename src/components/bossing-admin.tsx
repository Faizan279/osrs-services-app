import {
  Calculator,
  CheckCircle2,
  SlidersHorizontal,
  Swords,
} from "lucide-react";

import { fieldClass, labelClass } from "@/components/catalogue-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type StagedBossingBoss,
  type StagedBossingMethod,
  type StagedBossingRule,
} from "@/lib/catalogue/staging";
import { bossingPriceModeLabels } from "@/lib/bossing/constants";

export type EditableBossingBoss = Omit<StagedBossingBoss, "methods"> & {
  methods: StagedBossingMethod[];
};

export function BossingRuleForm({
  serviceId,
  version,
  rule,
  action,
}: {
  serviceId: string;
  version: number;
  rule: StagedBossingRule | null;
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
      <fieldset className="grid gap-4 border-0 p-0 md:grid-cols-2">
        <legend className="display-type mb-2 text-2xl">Add-ons</legend>
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
        Save bossing rules
      </Button>
    </form>
  );
}

export function BossingBossForm({
  serviceId,
  version,
  boss,
  action,
}: {
  serviceId: string;
  version: number;
  boss?: EditableBossingBoss;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="expectedVersion" value={version} />
      {boss && <input type="hidden" name="bossId" value={boss.id} />}
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>
          Boss name
          <input
            className={fieldClass}
            name="name"
            defaultValue={boss?.name}
            required
          />
        </label>
        <label className={labelClass}>
          Boss key
          <input
            className={fieldClass}
            name="bossKey"
            defaultValue={boss?.bossKey}
            required
          />
        </label>
        <NumberField
          name="displayOrder"
          label="Display order"
          defaultValue={boss?.displayOrder ?? 10}
        />
        <label className={labelClass}>
          Group label
          <input
            className={fieldClass}
            name="groupLabel"
            defaultValue={boss?.groupLabel ?? ""}
          />
        </label>
        <label className={labelClass}>
          Icon key
          <input
            className={fieldClass}
            name="iconKey"
            defaultValue={boss?.iconKey ?? ""}
          />
        </label>
        <div className="grid gap-3 pt-8">
          <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={boss?.enabled ?? true}
            />
            Enabled publicly
          </label>
          <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              name="needsClientReview"
              defaultChecked={boss?.needsClientReview ?? true}
            />
            Needs client review
          </label>
        </div>
        <label className={`${labelClass} md:col-span-2`}>
          Description
          <textarea
            className={`${fieldClass} min-h-28`}
            name="description"
            defaultValue={boss?.description ?? ""}
          />
        </label>
      </div>
      <Button type="submit">
        <Swords className="mr-2 size-4" aria-hidden="true" />
        Save boss
      </Button>
    </form>
  );
}

export function BossingMethodForm({
  serviceId,
  version,
  bosses,
  method,
  methodBossId,
  action,
}: {
  serviceId: string;
  version: number;
  bosses: EditableBossingBoss[];
  method?: StagedBossingMethod;
  methodBossId?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const selectedBossId = methodBossId ?? bosses[0]?.id ?? "";
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="expectedVersion" value={version} />
      {method && <input type="hidden" name="methodId" value={method.id} />}
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>
          Boss
          <select
            className={fieldClass}
            name="bossId"
            defaultValue={selectedBossId}
            required
          >
            {bosses.map((boss) => (
              <option value={boss.id} key={boss.id}>
                {boss.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Method name
          <input
            className={fieldClass}
            name="name"
            defaultValue={method?.name}
            required
          />
        </label>
        <label className={labelClass}>
          Slug
          <input
            className={fieldClass}
            name="slug"
            defaultValue={method?.slug}
            required
          />
        </label>
        <NumberField
          name="displayOrder"
          label="Display order"
          defaultValue={method?.displayOrder ?? 10}
        />
        <label className={`${labelClass} md:col-span-2`}>
          Short description
          <textarea
            className={`${fieldClass} min-h-24`}
            name="shortDescription"
            defaultValue={method?.shortDescription}
            required
          />
        </label>
      </div>
      <fieldset className="border-border grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
        <legend className="px-2 font-bold">Kill range and price</legend>
        <label className={labelClass}>
          Price mode
          <select
            className={fieldClass}
            name="priceMode"
            defaultValue={method?.priceMode ?? "PER_KILL"}
          >
            {Object.entries(bossingPriceModeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          name="minimumKillCount"
          label="Minimum kills"
          defaultValue={method?.minimumKillCount ?? 1}
          min={1}
        />
        <NumberField
          name="maximumKillCount"
          label="Maximum kills"
          defaultValue={method?.maximumKillCount ?? ""}
          min={1}
        />
        <NumberField
          name="basePriceCentsPerKill"
          label="Cents per kill"
          defaultValue={method?.basePriceCentsPerKill ?? 100}
        />
        <NumberField
          name="fixedPackagePriceCents"
          label="Package cents"
          defaultValue={method?.fixedPackagePriceCents ?? 0}
        />
        <NumberField
          name="minimumPriceCents"
          label="Minimum cents"
          defaultValue={method?.minimumPriceCents ?? 500}
        />
        <NumberField
          name="setupFeeCents"
          label="Setup fee cents"
          defaultValue={method?.setupFeeCents ?? 0}
        />
        <NumberField
          name="estimatedKillsPerHour"
          label="Kills per hour"
          defaultValue={method?.estimatedKillsPerHour ?? ""}
          min={1}
        />
        <label className={labelClass}>
          Tier label
          <input
            className={fieldClass}
            name="difficultyTierLabel"
            defaultValue={method?.difficultyTierLabel ?? ""}
          />
        </label>
      </fieldset>
      <fieldset className="border-border grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
        <legend className="px-2 font-bold">Gear and supplies</legend>
        <label className="text-text-secondary flex items-center gap-3 pt-8 text-sm font-semibold">
          <input
            name="customerGearRequired"
            type="checkbox"
            defaultChecked={method?.customerGearRequired ?? true}
          />
          Gear confirmation enabled
        </label>
        <label className={labelClass}>
          Gear confirmation label
          <input
            className={fieldClass}
            name="customerGearLabel"
            defaultValue={method?.customerGearLabel ?? ""}
          />
        </label>
        <NumberField
          name="gearAdjustmentCents"
          label="Gear adjustment cents"
          defaultValue={method?.gearAdjustmentCents ?? 0}
        />
        <label className="text-text-secondary flex items-center gap-3 pt-8 text-sm font-semibold">
          <input
            name="suppliesEnabled"
            type="checkbox"
            defaultChecked={method?.suppliesEnabled}
          />
          Supplies option enabled
        </label>
        <label className={labelClass}>
          Supplies label
          <input
            className={fieldClass}
            name="suppliesLabel"
            defaultValue={method?.suppliesLabel ?? ""}
          />
        </label>
        <NumberField
          name="suppliesFeeCents"
          label="Supply fee cents"
          defaultValue={method?.suppliesFeeCents ?? 0}
        />
      </fieldset>
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>
          Requirement summary
          <textarea
            className={`${fieldClass} min-h-28`}
            name="expectedRequirementsSummary"
            defaultValue={method?.expectedRequirementsSummary ?? ""}
          />
        </label>
        <label className={labelClass}>
          Gear notes
          <textarea
            className={`${fieldClass} min-h-28`}
            name="gearNotes"
            defaultValue={method?.gearNotes ?? ""}
          />
        </label>
        <label className={labelClass}>
          Supply notes
          <textarea
            className={`${fieldClass} min-h-28`}
            name="supplyNotes"
            defaultValue={method?.supplyNotes ?? ""}
          />
        </label>
        <label className={labelClass}>
          Public stat requirements
          <textarea
            className={`${fieldClass} min-h-28 font-mono text-xs`}
            name="statRequirements"
            defaultValue={statRequirementText(method)}
            placeholder="skill.attack.level|Attack level|60|Optional guidance"
          />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Gear/support requirements
          <textarea
            className={`${fieldClass} min-h-28 font-mono text-xs`}
            name="gearRequirements"
            defaultValue={gearRequirementText(method)}
            placeholder="Gear confirmation|Confirm gear and supplies|CUSTOMER_CONFIRMED|Guidance"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={method?.enabled ?? true}
          />
          Enabled publicly
        </label>
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={method?.needsClientReview ?? true}
          />
          Needs client review
        </label>
      </div>
      <Button type="submit">
        <Calculator className="mr-2 size-4" aria-hidden="true" />
        Save method
      </Button>
    </form>
  );
}

export function AdminBossingPreview({
  estimate,
}: {
  estimate: {
    bossName: string;
    methodName: string;
    total: string;
    requestedKills: number;
  } | null;
}) {
  return (
    <div className="border-primary/25 bg-primary/10 rounded-2xl border p-5">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="text-primary size-5" aria-hidden="true" />
        <h2 className="font-bold">Preview calculation</h2>
      </div>
      {estimate ? (
        <p className="text-text-secondary mt-3 text-sm leading-6">
          {estimate.bossName} via {estimate.methodName}: {estimate.total} for{" "}
          {estimate.requestedKills.toLocaleString()} kills.
        </p>
      ) : (
        <p className="text-text-secondary mt-3 text-sm leading-6">
          Enable a boss, an active method and bossing rules to show a staged
          preview.
        </p>
      )}
    </div>
  );
}

export function BossingBossCard({
  boss,
  serviceId,
}: {
  boss: EditableBossingBoss;
  serviceId: string;
}) {
  return (
    <div className="border-border bg-surface-1 rounded-2xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-bold">{boss.name}</h3>
          <p className="text-text-secondary mt-2 text-sm leading-6">
            {boss.description || "No description configured."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={boss.enabled ? "success" : "warning"}>
            {boss.enabled ? "Public" : "Hidden"}
          </Badge>
          <Badge variant="info">
            {boss.methods.length} method{boss.methods.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <a
            href={`/admin/catalogue/services/${serviceId}/bossing/bosses/${boss.id}`}
          >
            Edit boss
          </a>
        </Button>
        <Button asChild variant="ghost">
          <a
            href={`/admin/catalogue/services/${serviceId}/bossing/methods/new`}
          >
            Add method
          </a>
        </Button>
      </div>
    </div>
  );
}

function statRequirementText(method?: StagedBossingMethod) {
  return (
    method?.statRequirements
      .map((requirement) =>
        [
          requirement.metricKey,
          requirement.label,
          requirement.requiredLevel,
          requirement.customerGuidance ?? "",
        ].join("|"),
      )
      .join("\n") ?? ""
  );
}

function gearRequirementText(method?: StagedBossingMethod) {
  return (
    method?.gearRequirements
      .map((requirement) =>
        [
          requirement.label,
          requirement.description,
          requirement.verificationMode,
          requirement.customerGuidance ?? "",
        ].join("|"),
      )
      .join("\n") ?? ""
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min = 0,
  max,
}: {
  name: string;
  label: string;
  defaultValue: number | string;
  min?: number;
  max?: number;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        className={fieldClass}
        name={name}
        type="number"
        min={min}
        max={max}
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
          required
        />
      </label>
      <label className={labelClass}>
        Description
        <input
          className={fieldClass}
          name={`${fieldPrefix}Description`}
          defaultValue={description ?? ""}
        />
      </label>
      <label className={labelClass}>
        Time estimate
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

function defaultRule(): StagedBossingRule {
  return {
    id: "new-rule",
    normalModeMultiplierBps: 0,
    ironmanMultiplierBps: 1000,
    hardcoreIronmanMultiplierBps: 2000,
    ultimateIronmanMultiplierBps: 3000,
    discordStreamEnabled: true,
    discordStreamPercentBps: 200,
    standardDeliveryEnabled: true,
    standardDeliveryLabel: "Standard",
    standardDeliveryDescription: "Queued with normal service review.",
    standardDeliveryEstimate: "Reviewed before confirmation",
    standardDeliveryMultiplierBps: 0,
    standardDeliveryFixedFeeCents: 0,
    priorityDeliveryEnabled: false,
    priorityDeliveryLabel: "Priority",
    priorityDeliveryDescription: "Faster queue where configured.",
    priorityDeliveryEstimate: null,
    priorityDeliveryMultiplierBps: 1500,
    priorityDeliveryFixedFeeCents: 0,
    expressDeliveryEnabled: false,
    expressDeliveryLabel: "Express",
    expressDeliveryDescription: "Fastest configured review queue.",
    expressDeliveryEstimate: null,
    expressDeliveryMultiplierBps: 3000,
    expressDeliveryFixedFeeCents: 0,
    needsClientReview: true,
  };
}

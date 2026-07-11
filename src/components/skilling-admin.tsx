import { Calculator, CheckCircle2, SlidersHorizontal } from "lucide-react";

import { fieldClass, labelClass } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type StagedSkillingMethod,
  type StagedSkillingRule,
  type StagedSkillingSkill,
} from "@/lib/catalogue/staging";
import { skillingSkillLabels } from "@/lib/skilling/constants";

export type EditableSkillingSkill = Omit<StagedSkillingSkill, "methods"> & {
  methods: StagedSkillingMethod[];
};

export function SkillingRuleForm({
  serviceId,
  version,
  rule,
  action,
}: {
  serviceId: string;
  version: number;
  rule: StagedSkillingRule | null;
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
        Save skilling rules
      </Button>
    </form>
  );
}

export function SkillingSkillCard({
  serviceId,
  version,
  skill,
  action,
}: {
  serviceId: string;
  version: number;
  skill: EditableSkillingSkill;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      className="border-border bg-surface-1 grid gap-4 rounded-2xl border p-5 md:grid-cols-[1fr_9rem_8rem_auto] md:items-end"
    >
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="skillId" value={skill.id} />
      <input type="hidden" name="expectedVersion" value={version} />
      <label className={labelClass}>
        Skill name
        <input
          className={fieldClass}
          name="name"
          defaultValue={skill.name}
          required
        />
      </label>
      <NumberField
        name="displayOrder"
        label="Order"
        defaultValue={skill.displayOrder}
      />
      <label className={labelClass}>
        Icon key
        <input
          className={fieldClass}
          name="iconKey"
          defaultValue={skill.iconKey ?? ""}
        />
      </label>
      <label className="text-text-secondary flex items-center gap-2 pb-3 text-sm font-semibold">
        <input name="enabled" type="checkbox" defaultChecked={skill.enabled} />
        Enabled
      </label>
      <div className="flex flex-wrap gap-2 md:col-span-3">
        <Badge variant={skill.enabled ? "success" : "warning"}>
          {skill.enabled ? "Public" : "Hidden"}
        </Badge>
        <Badge variant="info">
          {skill.methods.length} method{skill.methods.length === 1 ? "" : "s"}
        </Badge>
        <span className="text-text-muted text-sm">
          {skillingSkillLabels[skill.skillKey]}
        </span>
      </div>
      <Button type="submit" className="w-fit">
        Save skill
      </Button>
    </form>
  );
}

export function SkillingMethodForm({
  serviceId,
  version,
  skills,
  method,
  methodSkillId,
  action,
}: {
  serviceId: string;
  version: number;
  skills: EditableSkillingSkill[];
  method?: StagedSkillingMethod;
  methodSkillId?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const selectedSkillId = methodSkillId ?? skills[0]?.id ?? "";
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="expectedVersion" value={version} />
      {method && <input type="hidden" name="methodId" value={method.id} />}
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>
          Skill
          <select
            className={fieldClass}
            name="skillConfigId"
            defaultValue={selectedSkillId}
            required
          >
            {skills.map((skill) => (
              <option value={skill.id} key={skill.id}>
                {skill.name}
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
      <fieldset className="border-border grid gap-4 rounded-2xl border p-5 md:grid-cols-2">
        <legend className="px-2 font-bold">Level range and rate</legend>
        <NumberField
          name="minimumLevel"
          label="Minimum level"
          defaultValue={method?.minimumLevel ?? 1}
          min={1}
          max={99}
        />
        <NumberField
          name="maximumLevel"
          label="Maximum level"
          defaultValue={method?.maximumLevel ?? 99}
          min={1}
          max={99}
        />
        <NumberField
          name="xpPerHour"
          label="XP per hour estimate"
          defaultValue={method?.xpPerHour ?? ""}
          min={1}
        />
      </fieldset>
      <fieldset className="border-border grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
        <legend className="px-2 font-bold">Pricing preview rules</legend>
        <NumberField
          name="basePriceCentsPerMillionXp"
          label="Cents per 1m XP"
          defaultValue={method?.basePriceCentsPerMillionXp ?? 1800}
        />
        <NumberField
          name="minimumPriceCents"
          label="Minimum cents"
          defaultValue={method?.minimumPriceCents ?? 500}
        />
        <NumberField
          name="fixedFeeCents"
          label="Fixed method fee cents"
          defaultValue={method?.fixedFeeCents ?? 0}
        />
      </fieldset>
      <fieldset className="border-border grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
        <legend className="px-2 font-bold">Supplies</legend>
        <label className="text-text-secondary flex items-center gap-3 pt-8 text-sm font-semibold">
          <input
            name="suppliesEnabled"
            type="checkbox"
            defaultChecked={method?.suppliesEnabled}
          />
          Supplies option enabled
        </label>
        <label className={labelClass}>
          Label
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
      <label className={labelClass}>
        Admin notes
        <textarea
          className={`${fieldClass} min-h-28`}
          name="notes"
          defaultValue={method?.notes ?? ""}
        />
      </label>
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

export function AdminSkillingPreview({
  estimate,
}: {
  estimate: {
    skillName: string;
    methodName: string;
    total: string;
    xpRequired: number;
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
          {estimate.skillName} via {estimate.methodName}: {estimate.total} for{" "}
          {estimate.xpRequired.toLocaleString()} XP.
        </p>
      ) : (
        <p className="text-text-secondary mt-3 text-sm leading-6">
          Enable a skill, an active method and skilling rules to show a staged
          preview.
        </p>
      )}
    </div>
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

function defaultRule(): StagedSkillingRule {
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

import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormStateIndicator } from "@/components/form-state-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fieldClass,
  labelClass,
  StatusBadge,
} from "@/components/catalogue-admin";
import type {
  CatalogueEngineType,
  PricingRule,
  PricingRuleApplicability,
  PricingRuleSet,
} from "@/generated/prisma/client";
import {
  pricingRuleTypeLabels,
  pricingRuleTypes,
  pricingScopeLabels,
  pricingScopes,
} from "@/lib/pricing/admin";
import { formatCents } from "@/lib/pricing/engine";
import {
  catalogueEngineTypes,
  formatEnumLabel,
} from "@/lib/catalogue/constants";

type PricingRuleWithScopes = PricingRule & {
  applicability: Array<
    PricingRuleApplicability & {
      category?: { name: string; slug: string } | null;
      service?: {
        name: string;
        slug: string;
        engineType: CatalogueEngineType;
        category: { name: string; slug: string };
      } | null;
    }
  >;
};

type PricingOptions = {
  categories: Array<{ id: string; name: string; slug: string }>;
  services: Array<{
    id: string;
    name: string;
    slug: string;
    engineType: CatalogueEngineType;
    category: { name: string; slug: string };
  }>;
};

function bpsLabel(value: number | null) {
  if (value == null) return "n/a";
  return `${(value / 100).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}%`;
}

export function pricingRuleValue(rule: PricingRule) {
  if (rule.ruleType === "PERCENTAGE_ADDITION") return bpsLabel(rule.valueBps);
  return formatCents(rule.amountCents ?? 0);
}

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 16);
}

export function pricingScopeText(rule: PricingRuleWithScopes) {
  const scope = rule.applicability[0];
  if (!scope) return "No scope";
  if (scope.scope === "GLOBAL") return "Global";
  if (scope.scope === "ENGINE_TYPE") {
    return scope.engineType ? formatEnumLabel(scope.engineType) : "Engine type";
  }
  if (scope.scope === "CATEGORY") {
    return scope.category?.name ?? "Category";
  }
  return scope.service
    ? `${scope.service.name} (${formatEnumLabel(scope.service.engineType)})`
    : "Service";
}

export function PricingRuleList({ rules }: { rules: PricingRuleWithScopes[] }) {
  if (!rules.length) {
    return (
      <div className="border-border bg-surface-1 rounded-2xl border p-6">
        No draft pricing rules yet.
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {rules.map((rule) => (
        <article
          className="border-border bg-surface-1 rounded-2xl border p-5"
          key={rule.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">{rule.publicLabel}</h2>
              <p className="text-text-muted mt-1 text-sm">
                {pricingRuleTypeLabels[rule.ruleType]} -{" "}
                {pricingScopeText(rule)}
              </p>
            </div>
            <StatusBadge status={rule.enabled ? "ENABLED" : "DISABLED"} />
          </div>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Value</dt>
              <dd className="font-bold">{pricingRuleValue(rule)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Priority</dt>
              <dd className="font-bold">{rule.priority}</dd>
            </div>
            {rule.exclusiveGroupKey && (
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Exclusive group</dt>
                <dd className="font-bold">{rule.exclusiveGroupKey}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {rule.needsClientReview && (
              <Badge variant="warning">Needs client review</Badge>
            )}
            <Button asChild size="sm" variant="secondary">
              <Link href={`/admin/pricing/rules/${rule.id}`}>Edit rule</Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function PricingRuleForm({
  draft,
  rule,
  options,
  action,
}: {
  draft: PricingRuleSet;
  rule?: PricingRuleWithScopes | null;
  options: PricingOptions;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const scope = rule?.applicability[0];
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="ruleSetId" value={draft.id} />
      <input
        type="hidden"
        name="expectedDraftVersion"
        value={draft.draftVersion}
      />
      {rule && (
        <>
          <input type="hidden" name="ruleId" value={rule.id} />
          <input
            type="hidden"
            name="expectedRuleVersion"
            value={rule.version}
          />
        </>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <label className={`${labelClass} lg:col-span-2`}>
          Public label
          <input
            className={fieldClass}
            name="publicLabel"
            defaultValue={rule?.publicLabel ?? ""}
            maxLength={160}
            required
          />
        </label>
        <label className={labelClass}>
          Rule type
          <select
            className={fieldClass}
            name="ruleType"
            defaultValue={rule?.ruleType ?? "FIXED_ADDITION"}
          >
            {pricingRuleTypes.map((value) => (
              <option value={value} key={value}>
                {pricingRuleTypeLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Priority
          <input
            className={fieldClass}
            name="priority"
            type="number"
            defaultValue={rule?.priority ?? 0}
          />
        </label>
        <label className={labelClass}>
          Amount cents
          <input
            className={fieldClass}
            name="amountCents"
            type="number"
            min="0"
            max="100000000"
            defaultValue={rule?.amountCents ?? ""}
          />
        </label>
        <label className={labelClass}>
          Percentage basis points
          <input
            className={fieldClass}
            name="valueBps"
            type="number"
            min="0"
            max="100000"
            defaultValue={rule?.valueBps ?? ""}
          />
        </label>
        <label className={labelClass}>
          Scope
          <select
            className={fieldClass}
            name="scope"
            defaultValue={scope?.scope ?? "GLOBAL"}
          >
            {pricingScopes.map((value) => (
              <option value={value} key={value}>
                {pricingScopeLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Engine type
          <select
            className={fieldClass}
            name="engineType"
            defaultValue={scope?.engineType ?? ""}
          >
            <option value="">Not engine scoped</option>
            {catalogueEngineTypes.map((value) => (
              <option value={value} key={value}>
                {formatEnumLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Category
          <select
            className={fieldClass}
            name="categoryId"
            defaultValue={scope?.categoryId ?? ""}
          >
            <option value="">Not category scoped</option>
            {options.categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Service
          <select
            className={fieldClass}
            name="serviceId"
            defaultValue={scope?.serviceId ?? ""}
          >
            <option value="">Not service scoped</option>
            {options.services.map((service) => (
              <option value={service.id} key={service.id}>
                {service.name} - {formatEnumLabel(service.engineType)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Exclusive group
          <input
            className={fieldClass}
            name="exclusiveGroupKey"
            defaultValue={rule?.exclusiveGroupKey ?? ""}
            maxLength={120}
          />
        </label>
        <label className={labelClass}>
          Effective start
          <input
            className={fieldClass}
            name="effectiveStart"
            type="datetime-local"
            defaultValue={dateInputValue(rule?.effectiveStart ?? null)}
          />
        </label>
        <label className={labelClass}>
          Effective end
          <input
            className={fieldClass}
            name="effectiveEnd"
            type="datetime-local"
            defaultValue={dateInputValue(rule?.effectiveEnd ?? null)}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Internal description
          <textarea
            className={`${fieldClass} min-h-28`}
            name="internalDescription"
            defaultValue={rule?.internalDescription ?? ""}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={rule?.enabled ?? true}
          />
          Enabled
        </label>
        <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={rule?.needsClientReview ?? true}
          />
          Needs client review
        </label>
        <FormStateIndicator />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">{rule ? "Save rule" : "Create rule"}</Button>
        <Button asChild variant="secondary">
          <Link href="/admin/pricing/rules">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

export function PublishControls({
  draft,
  publishAction,
  discardAction,
}: {
  draft: PricingRuleSet | null;
  publishAction: (formData: FormData) => void | Promise<void>;
  discardAction: (formData: FormData) => void | Promise<void>;
}) {
  if (!draft) return null;
  return (
    <div className="flex flex-wrap gap-3">
      <form action={publishAction}>
        <input
          type="hidden"
          name="expectedDraftVersion"
          value={draft.draftVersion}
        />
        <ConfirmSubmitButton confirmation="Publish this pricing draft for public estimates?">
          Publish draft
        </ConfirmSubmitButton>
      </form>
      <form action={discardAction}>
        <input
          type="hidden"
          name="expectedDraftVersion"
          value={draft.draftVersion}
        />
        <ConfirmSubmitButton
          variant="danger"
          confirmation="Discard draft pricing changes and restore the latest published revision?"
        >
          Discard draft
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}

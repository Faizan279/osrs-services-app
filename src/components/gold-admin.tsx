import Link from "next/link";

import {
  fieldClass,
  labelClass,
  StatusBadge,
} from "@/components/catalogue-admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  goldAvailabilityLabels,
  goldAvailabilityStates,
  goldInventoryEntryTypeLabels,
  goldInventoryEntryTypes,
  goldSecureServicePricingModes,
  goldTradeDirectionLabels,
  goldTradeDirections,
} from "@/lib/gold/constants";
import { formatGoldQuantity } from "@/lib/gold/estimate";

type Rate = {
  id: string;
  direction: (typeof goldTradeDirections)[number];
  rateMinorUnitsPerMillion: number;
  minimumQuantityGp: bigint;
  maximumQuantityGp: bigint;
  automaticReviewMaximumGp: bigint;
  effectiveStart: Date;
  effectiveEnd: Date | null;
  enabled: boolean;
  needsClientReview: boolean;
};

type DraftRateSet = {
  id: string;
  concurrencyVersion: number;
  rates: Rate[];
} | null;

type GoldMarket = {
  id: string;
  publicName: string;
  slug: string;
  description: string;
  currencyCode: string;
  availabilityState: string;
  publicTradeInstructions: string;
  internalInstructions: string | null;
  rsnRequired: boolean;
  secureServiceEnabled: boolean;
  secureServicePricingMode: string;
  secureServiceFixedMinorUnits: number;
  secureServiceBps: number;
  secureServiceCustomerBuys: boolean;
  secureServiceCustomerSells: boolean;
  quoteValidityMinutes: number;
  stockQuantityGp: bigint;
  buyingCapacityGp: bigint;
  stockVersion: number;
  draftVersion: number;
  needsClientReview: boolean;
  service: {
    id: string;
    name: string;
    slug: string;
    category: { name: string; slug: string };
  };
};

type Preset = {
  id: string;
  direction: (typeof goldTradeDirections)[number];
  publicLabel: string;
  quantityGp: bigint;
  sortOrder: number;
  enabled: boolean;
  needsClientReview: boolean;
  concurrencyVersion: number;
};

type LedgerEntry = {
  id: string;
  entryType: keyof typeof goldInventoryEntryTypeLabels;
  quantityGp: bigint;
  resultingStockQuantityGp: bigint;
  resultingBuyingCapacityGp: bigint;
  reason: string;
  createdAt: Date;
  actor?: { name: string | null; email: string } | null;
};

type Revision = {
  id: string;
  revisionNumber: number;
  publishedAt: Date;
  publishedBy?: { name: string | null; email: string } | null;
};

export function GoldMarketTabs({ marketId }: { marketId: string }) {
  const tabs = [
    ["Overview", `/admin/gold/markets/${marketId}`],
    ["Rates", `/admin/gold/markets/${marketId}/rates`],
    ["Presets", `/admin/gold/markets/${marketId}/presets`],
    ["Inventory", `/admin/gold/markets/${marketId}/inventory`],
    ["History", `/admin/gold/markets/${marketId}/history`],
  ] as const;
  return (
    <nav
      aria-label="Gold market sections"
      className="mt-6 flex flex-wrap gap-2"
    >
      {tabs.map(([label, href]) => (
        <Button asChild key={href} size="sm" variant="secondary">
          <Link href={href}>{label}</Link>
        </Button>
      ))}
    </nav>
  );
}

export function GoldMarketSummary({ market }: { market: GoldMarket }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Availability"
        value={
          goldAvailabilityLabels[
            market.availabilityState as keyof typeof goldAvailabilityLabels
          ]
        }
      />
      <Stat
        label="Gold stock"
        value={formatGoldQuantity(market.stockQuantityGp)}
      />
      <Stat
        label="Buying capacity"
        value={formatGoldQuantity(market.buyingCapacityGp)}
      />
      <Stat label="Currency" value={market.currencyCode} />
    </div>
  );
}

export function GoldMarketForm({
  market,
  action,
}: {
  market: GoldMarket;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="marketId" value={market.id} />
      <input type="hidden" name="expectedVersion" value={market.draftVersion} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Public name
          <input
            className={fieldClass}
            name="publicName"
            defaultValue={market.publicName}
            required
          />
        </label>
        <label className={labelClass}>
          Availability
          <select
            className={fieldClass}
            name="availabilityState"
            defaultValue={market.availabilityState}
          >
            {goldAvailabilityStates.map((state) => (
              <option key={state} value={state}>
                {goldAvailabilityLabels[state]}
              </option>
            ))}
          </select>
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Description
          <textarea
            className={`${fieldClass} min-h-28`}
            name="description"
            defaultValue={market.description}
            required
          />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Public trade instructions
          <textarea
            className={`${fieldClass} min-h-28`}
            name="publicTradeInstructions"
            defaultValue={market.publicTradeInstructions}
            required
          />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Internal instructions
          <textarea
            className={`${fieldClass} min-h-28`}
            name="internalInstructions"
            defaultValue={market.internalInstructions ?? ""}
          />
        </label>
      </div>
      <fieldset className="border-border grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
        <legend className="px-2 font-bold">Secure service</legend>
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="secureServiceEnabled"
            defaultChecked={market.secureServiceEnabled}
          />
          Secure 100+ Combat available
        </label>
        <label className={labelClass}>
          Pricing mode
          <select
            className={fieldClass}
            name="secureServicePricingMode"
            defaultValue={market.secureServicePricingMode}
          >
            {goldSecureServicePricingModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode.replaceAll("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          name="secureServiceFixedMinorUnits"
          label="Fixed minor units"
          defaultValue={market.secureServiceFixedMinorUnits}
        />
        <NumberField
          name="secureServiceBps"
          label="Basis points"
          defaultValue={market.secureServiceBps}
        />
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="secureServiceCustomerBuys"
            defaultChecked={market.secureServiceCustomerBuys}
          />
          Applies when customer buys
        </label>
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="secureServiceCustomerSells"
            defaultChecked={market.secureServiceCustomerSells}
          />
          Applies when customer sells
        </label>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField
          name="quoteValidityMinutes"
          label="Quote validity minutes"
          defaultValue={market.quoteValidityMinutes}
          min={1}
        />
        <label className="text-text-secondary flex items-center gap-3 pt-8 text-sm font-semibold">
          <input
            type="checkbox"
            name="rsnRequired"
            defaultChecked={market.rsnRequired}
          />
          RSN required
        </label>
        <label className="text-text-secondary flex items-center gap-3 pt-8 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={market.needsClientReview}
          />
          Needs client review
        </label>
      </div>
      <Button type="submit" className="w-fit">
        Save market
      </Button>
    </form>
  );
}

export function GoldRateForm({
  marketId,
  draft,
  direction,
  action,
}: {
  marketId: string;
  draft: DraftRateSet;
  direction: (typeof goldTradeDirections)[number];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const rate = draft?.rates.find((item) => item.direction === direction);
  return (
    <form
      action={action}
      className="border-border bg-surface-1 rounded-2xl border p-5"
    >
      <input type="hidden" name="marketId" value={marketId} />
      <input
        type="hidden"
        name="expectedVersion"
        value={draft?.concurrencyVersion ?? 1}
      />
      <input type="hidden" name="direction" value={direction} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="display-type text-2xl">
          {goldTradeDirectionLabels[direction]}
        </h2>
        <StatusBadge status={rate?.enabled ? "ENABLED" : "DISABLED"} />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <NumberField
          name="rateMinorUnitsPerMillion"
          label="Rate minor units per 1M GP"
          defaultValue={rate?.rateMinorUnitsPerMillion ?? 0}
          min={1}
        />
        <TextField
          name="minimumQuantity"
          label="Minimum quantity"
          defaultValue={rate ? formatGoldQuantity(rate.minimumQuantityGp) : ""}
        />
        <TextField
          name="maximumQuantity"
          label="Maximum quantity"
          defaultValue={rate ? formatGoldQuantity(rate.maximumQuantityGp) : ""}
        />
        <TextField
          name="automaticReviewMaximum"
          label="Automatic-review maximum"
          defaultValue={
            rate ? formatGoldQuantity(rate.automaticReviewMaximumGp) : ""
          }
        />
        <label className={labelClass}>
          Effective start
          <input
            className={fieldClass}
            name="effectiveStart"
            type="datetime-local"
            defaultValue={dateInputValue(rate?.effectiveStart ?? new Date())}
            required
          />
        </label>
        <label className={labelClass}>
          Effective end
          <input
            className={fieldClass}
            name="effectiveEnd"
            type="datetime-local"
            defaultValue={dateInputValue(rate?.effectiveEnd ?? null)}
          />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-5">
        <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={rate?.enabled ?? true}
          />
          Enabled
        </label>
        <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={rate?.needsClientReview ?? true}
          />
          Needs client review
        </label>
      </div>
      <Button type="submit" className="mt-5">
        Save rate
      </Button>
    </form>
  );
}

export function GoldPublishControls({
  marketId,
  draft,
  publishAction,
  discardAction,
}: {
  marketId: string;
  draft: DraftRateSet;
  publishAction: (formData: FormData) => void | Promise<void>;
  discardAction: (formData: FormData) => void | Promise<void>;
}) {
  if (!draft) return null;
  return (
    <div className="flex flex-wrap gap-3">
      <form action={publishAction}>
        <input type="hidden" name="marketId" value={marketId} />
        <input
          type="hidden"
          name="expectedVersion"
          value={draft.concurrencyVersion}
        />
        <ConfirmSubmitButton confirmation="Publish this gold rate draft for public estimates?">
          Publish draft
        </ConfirmSubmitButton>
      </form>
      <form action={discardAction}>
        <input type="hidden" name="marketId" value={marketId} />
        <input
          type="hidden"
          name="expectedVersion"
          value={draft.concurrencyVersion}
        />
        <ConfirmSubmitButton
          variant="danger"
          confirmation="Discard draft gold rates and restore the latest published revision?"
        >
          Discard draft
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}

export function GoldPresetForm({
  marketId,
  preset,
  action,
}: {
  marketId: string;
  preset?: Preset;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      className="border-border bg-surface-1 rounded-2xl border p-5"
    >
      <input type="hidden" name="marketId" value={marketId} />
      {preset && (
        <>
          <input type="hidden" name="presetId" value={preset.id} />
          <input
            type="hidden"
            name="expectedPresetVersion"
            value={preset.concurrencyVersion}
          />
        </>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Direction
          <select
            className={fieldClass}
            name="direction"
            defaultValue={preset?.direction ?? "CUSTOMER_BUYS_GOLD"}
          >
            {goldTradeDirections.map((direction) => (
              <option key={direction} value={direction}>
                {goldTradeDirectionLabels[direction]}
              </option>
            ))}
          </select>
        </label>
        <TextField
          name="publicLabel"
          label="Public label"
          defaultValue={preset?.publicLabel ?? ""}
        />
        <TextField
          name="quantity"
          label="Quantity"
          defaultValue={preset ? formatGoldQuantity(preset.quantityGp) : ""}
        />
        <NumberField
          name="sortOrder"
          label="Sort order"
          defaultValue={preset?.sortOrder ?? 10}
        />
      </div>
      <div className="mt-5 flex flex-wrap gap-5">
        <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={preset?.enabled ?? true}
          />
          Enabled
        </label>
        <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={preset?.needsClientReview ?? true}
          />
          Needs client review
        </label>
      </div>
      <Button type="submit" className="mt-5">
        {preset ? "Save preset" : "Create preset"}
      </Button>
    </form>
  );
}

export function GoldPresetList({ presets }: { presets: Preset[] }) {
  if (!presets.length) {
    return <p className="text-text-muted">No quantity presets configured.</p>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {presets.map((preset) => (
        <article
          className="border-border bg-surface-1 rounded-2xl border p-5"
          key={preset.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">{preset.publicLabel}</h3>
              <p className="text-text-secondary mt-1 text-sm">
                {goldTradeDirectionLabels[preset.direction]} -{" "}
                {formatGoldQuantity(preset.quantityGp)}
              </p>
            </div>
            <Badge variant={preset.enabled ? "success" : "warning"}>
              {preset.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </article>
      ))}
    </div>
  );
}

export function GoldInventoryForm({
  market,
  action,
}: {
  market: GoldMarket;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      className="border-border bg-surface-1 rounded-2xl border p-5"
    >
      <input type="hidden" name="marketId" value={market.id} />
      <input type="hidden" name="expectedVersion" value={market.stockVersion} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Entry type
          <select className={fieldClass} name="entryType">
            {goldInventoryEntryTypes.map((type) => (
              <option key={type} value={type}>
                {goldInventoryEntryTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <TextField name="quantity" label="Quantity" defaultValue="" />
        <TextField name="reason" label="Reason" defaultValue="" />
        <TextField name="referenceKey" label="Reference key" defaultValue="" />
        <label className={`${labelClass} md:col-span-2`}>
          Internal note
          <textarea className={`${fieldClass} min-h-24`} name="internalNote" />
        </label>
      </div>
      <Button type="submit" className="mt-5">
        Record adjustment
      </Button>
    </form>
  );
}

export function GoldLedgerList({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) {
    return <p className="text-text-muted">No inventory ledger entries yet.</p>;
  }
  return (
    <div className="border-border bg-surface-1 overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-3xl text-left text-sm">
        <thead className="bg-surface-2 text-text-muted">
          <tr>
            <th className="p-4">Type</th>
            <th className="p-4">Quantity</th>
            <th className="p-4">Balances after</th>
            <th className="p-4">Reason</th>
            <th className="p-4">Actor</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="p-4 font-bold">
                {goldInventoryEntryTypeLabels[entry.entryType]}
              </td>
              <td className="p-4">{formatGoldQuantity(entry.quantityGp)}</td>
              <td className="text-text-secondary p-4">
                Stock {formatGoldQuantity(entry.resultingStockQuantityGp)} / Buy
                cap {formatGoldQuantity(entry.resultingBuyingCapacityGp)}
              </td>
              <td className="text-text-secondary p-4">{entry.reason}</td>
              <td className="text-text-muted p-4">
                {entry.actor?.name ?? entry.actor?.email ?? "system"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GoldRevisionList({
  marketId,
  revisions,
  draft,
  restoreAction,
}: {
  marketId: string;
  revisions: Revision[];
  draft: DraftRateSet;
  restoreAction: (formData: FormData) => void | Promise<void>;
}) {
  if (!revisions.length) {
    return <p className="text-text-muted">No published gold revisions yet.</p>;
  }
  return (
    <div className="border-border bg-surface-1 overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-3xl text-left text-sm">
        <thead className="bg-surface-2 text-text-muted">
          <tr>
            <th className="p-4">Revision</th>
            <th className="p-4">Published</th>
            <th className="p-4">Publisher</th>
            <th className="p-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {revisions.map((revision) => (
            <tr key={revision.id}>
              <td className="p-4 font-bold">#{revision.revisionNumber}</td>
              <td className="text-text-secondary p-4">
                {revision.publishedAt.toLocaleString()}
              </td>
              <td className="text-text-secondary p-4">
                {revision.publishedBy?.name ??
                  revision.publishedBy?.email ??
                  "system"}
              </td>
              <td className="p-4">
                {draft && (
                  <form action={restoreAction} className="flex justify-end">
                    <input type="hidden" name="marketId" value={marketId} />
                    <input
                      type="hidden"
                      name="revisionId"
                      value={revision.id}
                    />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={draft.concurrencyVersion}
                    />
                    <ConfirmSubmitButton
                      size="sm"
                      variant="secondary"
                      confirmation={`Restore revision #${revision.revisionNumber} into the draft?`}
                    >
                      Restore
                    </ConfirmSubmitButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-surface-1 rounded-2xl border p-5">
      <p className="text-text-muted text-sm font-semibold">{label}</p>
      <p className="display-type mt-2 text-2xl">{value}</p>
    </div>
  );
}

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 16);
}

function TextField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        className={fieldClass}
        name={name}
        defaultValue={defaultValue}
        required={name !== "referenceKey"}
      />
    </label>
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
  defaultValue: number;
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

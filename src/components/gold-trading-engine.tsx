"use client";

import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Coins,
  HandCoins,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  goldAvailabilityLabels,
  goldTradeDirectionDescriptions,
  goldTradeDirectionLabels,
} from "@/lib/gold/constants";
import {
  formatGoldQuantity,
  type GoldAvailabilityState,
  type GoldTradeDirection,
  type PublishedGoldRateRevisionSnapshotV1,
} from "@/lib/gold/estimate";
import { formatCents } from "@/lib/pricing/engine";

type GoldPreset = {
  id: string;
  direction: GoldTradeDirection;
  publicLabel: string;
  quantityGp: string;
  quantityLabel: string;
  sortOrder: number;
};

type GoldMarket = {
  id: string;
  publicName: string;
  description: string;
  currencyCode: string;
  availabilityState: GoldAvailabilityState;
  publicTradeInstructions: string;
  rsnRequired: boolean;
  secureServiceEnabled: boolean;
  secureServicePricingMode: string;
  secureServiceCustomerBuys: boolean;
  secureServiceCustomerSells: boolean;
  quoteValidityMinutes: number;
};

type GoldService = {
  id: string;
  name: string;
  content: string;
  requirements: Array<{
    id: string;
    title: string;
    description: string;
    isRequired: boolean;
    verificationMode: string;
  }>;
};

type EstimateResponse = {
  ok: boolean;
  message?: string;
  estimate?: {
    direction: GoldTradeDirection;
    directionLabel: string;
    quantityLabel: string;
    rateMinorUnitsPerMillion: number;
    lineItems: Array<{ label: string; amountCents: number }>;
    estimatedTotalMinorUnits: number;
    estimatedTotal: string;
    availabilityState: GoldAvailabilityState;
    manualReviewRequired: boolean;
    availabilityMessage: string;
    finalPriceNote: string;
    tradeInstructions: string;
    validUntil: string;
  };
};

const directions: GoldTradeDirection[] = [
  "CUSTOMER_BUYS_GOLD",
  "CUSTOMER_SELLS_GOLD",
];

export function GoldTradingEngine({
  service,
  market,
  presets,
  latestRevision,
  featureEnabled,
  requestHref,
}: {
  service: GoldService;
  market: GoldMarket;
  presets: GoldPreset[];
  latestRevision: PublishedGoldRateRevisionSnapshotV1 | null;
  featureEnabled: boolean;
  requestHref: string;
}) {
  const [direction, setDirection] =
    useState<GoldTradeDirection>("CUSTOMER_BUYS_GOLD");
  const [presetId, setPresetId] = useState<string>("");
  const [customQuantity, setCustomQuantity] = useState("");
  const [secureServiceSelected, setSecureServiceSelected] = useState(false);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [pending, startTransition] = useTransition();

  const directionPresets = useMemo(
    () => presets.filter((preset) => preset.direction === direction),
    [presets, direction],
  );
  const activeRate = latestRevision?.rates.find(
    (rate) => rate.direction === direction,
  );
  const secureAvailable =
    market.secureServiceEnabled &&
    market.secureServicePricingMode !== "DISABLED" &&
    ((direction === "CUSTOMER_BUYS_GOLD" && market.secureServiceCustomerBuys) ||
      (direction === "CUSTOMER_SELLS_GOLD" &&
        market.secureServiceCustomerSells));

  function switchDirection(next: GoldTradeDirection) {
    setDirection(next);
    setPresetId("");
    setCustomQuantity("");
    setSecureServiceSelected(false);
    setResult(null);
  }

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/gold/estimate", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            serviceId: service.id,
            marketId: market.id,
            direction,
            presetId: presetId || undefined,
            quantity: presetId ? "1" : customQuantity,
            secureServiceSelected,
            rsn: market.rsnRequired
              ? String(formData.get("rsn") ?? "").trim()
              : undefined,
          }),
        });
        setResult((await response.json()) as EstimateResponse);
      } catch {
        setResult({
          ok: false,
          message: "The gold estimate could not be calculated.",
        });
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Gold engine</Badge>
            <Badge variant={featureEnabled ? "success" : "warning"}>
              {featureEnabled ? "Published rates required" : "Review mode"}
            </Badge>
          </div>
          <h2 className="display-type mt-5 text-3xl">{market.publicName}</h2>
          <div className="text-text-secondary mt-4 space-y-4 leading-7">
            {(market.description || service.content)
              .split(/\n{2,}/)
              .map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
          </div>
          {service.requirements.length > 0 && (
            <div className="mt-6 grid gap-3">
              {service.requirements.map((requirement) => (
                <div
                  className="border-border bg-surface-1 rounded-2xl border p-4"
                  key={requirement.id}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className="text-primary size-4"
                      aria-hidden="true"
                    />
                    <h3 className="text-sm font-bold">{requirement.title}</h3>
                  </div>
                  <p className="text-text-secondary mt-2 text-sm leading-6">
                    {requirement.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <aside className="border-gold/25 bg-gold/5 h-fit rounded-2xl border p-6">
          <p className="text-gold kicker-type">Availability</p>
          <h2 className="display-type mt-3 text-2xl">
            {goldAvailabilityLabels[market.availabilityState]}
          </h2>
          <p className="text-text-secondary mt-3 text-sm leading-6">
            Estimates are server-authoritative previews. They do not reserve
            stock, buying capacity or a final trade price.
          </p>
          <Button asChild className="mt-6 w-full" variant="secondary">
            <a href={requestHref}>Request review</a>
          </Button>
        </aside>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          action={submit}
          className="border-primary/25 rounded-3xl border bg-[linear-gradient(135deg,rgba(15,34,22,.94),rgba(4,9,7,.98))] p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-primary kicker-type">Gold trading</p>
              <h2 className="display-type mt-3 text-3xl">
                Estimate a gold trade
              </h2>
            </div>
            <Coins className="text-gold size-8" aria-hidden="true" />
          </div>

          {!featureEnabled || !latestRevision ? (
            <div
              className="border-warning/30 bg-warning/10 text-text-secondary mt-6 rounded-2xl border p-5"
              role="status"
            >
              Gold trading is in review mode. Admin configuration remains
              available, but live rates are not presented publicly.
            </div>
          ) : (
            <>
              <div
                aria-label="Gold trade direction"
                className="border-border bg-background/40 mt-6 grid gap-2 rounded-2xl border p-2 sm:grid-cols-2"
                role="tablist"
              >
                {directions.map((item) => {
                  const active = item === direction;
                  const Icon =
                    item === "CUSTOMER_BUYS_GOLD" ? Banknote : HandCoins;
                  return (
                    <button
                      aria-selected={active}
                      className={`focus-visible:ring-primary min-h-12 rounded-xl px-4 text-left text-sm font-bold focus-visible:ring-2 focus-visible:outline-none ${active ? "bg-primary text-background" : "text-text-secondary hover:bg-surface-2"}`}
                      key={item}
                      role="tab"
                      type="button"
                      onClick={() => switchDirection(item)}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="size-4" aria-hidden="true" />
                        {goldTradeDirectionLabels[item]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-text-muted mt-3 text-xs leading-5">
                {goldTradeDirectionDescriptions[direction]}
              </p>

              <fieldset className="mt-6 grid gap-3 border-0 p-0">
                <legend className="text-sm font-bold">Quantity presets</legend>
                {directionPresets.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {directionPresets.map((preset) => (
                      <label
                        className={`border-border bg-background/45 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold ${presetId === preset.id ? "border-primary" : ""}`}
                        key={preset.id}
                      >
                        <input
                          type="radio"
                          name="presetId"
                          checked={presetId === preset.id}
                          onChange={() => {
                            setPresetId(preset.id);
                            setCustomQuantity("");
                            setResult(null);
                          }}
                        />
                        <span>
                          {preset.publicLabel}
                          <span className="text-text-muted block text-xs">
                            {preset.quantityLabel}
                          </span>
                        </span>
                      </label>
                    ))}
                    <label
                      className={`border-border bg-background/45 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold ${!presetId ? "border-primary" : ""}`}
                    >
                      <input
                        type="radio"
                        name="presetId"
                        checked={!presetId}
                        onChange={() => {
                          setPresetId("");
                          setResult(null);
                        }}
                      />
                      Custom quantity
                    </label>
                  </div>
                ) : (
                  <p className="text-text-muted text-sm">
                    No active presets are configured for this direction.
                  </p>
                )}
              </fieldset>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <label className="text-sm font-bold">
                  Custom quantity in millions of GP
                  <input
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    name="quantity"
                    value={customQuantity}
                    onChange={(event) => {
                      setPresetId("");
                      setCustomQuantity(event.target.value);
                      setResult(null);
                    }}
                    placeholder="Enter amount"
                    disabled={Boolean(presetId)}
                    aria-describedby="gold-quantity-help"
                  />
                  <span
                    className="text-text-muted mt-2 block text-xs"
                    id="gold-quantity-help"
                  >
                    Whole GP is calculated on the server from this display
                    value.
                  </span>
                </label>
                {market.rsnRequired && (
                  <label className="text-sm font-bold">
                    RuneScape name
                    <input
                      className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                      name="rsn"
                      maxLength={12}
                      autoComplete="off"
                      required
                      placeholder="No password, PIN or authenticator code"
                    />
                  </label>
                )}
              </div>

              {activeRate && (
                <div className="border-border bg-background/35 mt-5 grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-3">
                  <SummaryText
                    label="Published rate"
                    value={`${formatCents(activeRate.rateMinorUnitsPerMillion, market.currencyCode)} / 1M GP`}
                  />
                  <SummaryText
                    label="Minimum"
                    value={formatGoldQuantity(activeRate.minimumQuantityGp)}
                  />
                  <SummaryText
                    label="Maximum"
                    value={formatGoldQuantity(activeRate.maximumQuantityGp)}
                  />
                </div>
              )}

              {secureAvailable && (
                <label className="border-border bg-background/45 mt-5 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={secureServiceSelected}
                    onChange={(event) => {
                      setSecureServiceSelected(event.target.checked);
                      setResult(null);
                    }}
                  />
                  Secure 100+ Combat Service
                </label>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={pending}>
                  <Coins className="mr-2 size-4" aria-hidden="true" />
                  {pending ? "Calculating..." : "Estimate trade"}
                </Button>
                <p
                  id="gold-estimate-status"
                  role="status"
                  aria-live="polite"
                  className="text-text-muted text-sm"
                >
                  {pending
                    ? "Server calculation in progress."
                    : result?.message}
                </p>
              </div>
            </>
          )}
        </form>

        <GoldEstimatePanel result={result} requestHref={requestHref} />
      </section>
    </div>
  );
}

function GoldEstimatePanel({
  result,
  requestHref,
}: {
  result: EstimateResponse | null;
  requestHref: string;
}) {
  if (!result) {
    return (
      <aside className="border-border bg-surface-1 h-fit rounded-2xl border p-6">
        <div className="flex items-center gap-3">
          <Coins className="text-gold size-5" aria-hidden="true" />
          <h2 className="font-bold">Estimate summary</h2>
        </div>
        <p className="text-text-secondary mt-4 text-sm leading-6">
          Select buy or sell, choose a configured preset or custom quantity,
          then run a server estimate.
        </p>
      </aside>
    );
  }
  if (!result.ok || !result.estimate) {
    return (
      <aside
        className="border-danger/30 bg-danger/10 h-fit rounded-2xl border p-6"
        role="alert"
      >
        <div className="flex gap-3">
          <AlertCircle
            className="text-danger mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <p>{result.message}</p>
        </div>
      </aside>
    );
  }
  const estimate = result.estimate;
  return (
    <aside
      className="border-border bg-surface-1 h-fit rounded-2xl border p-6"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-gold kicker-type">
            {estimate.direction === "CUSTOMER_BUYS_GOLD"
              ? "Estimated payment"
              : "Estimated payout"}
          </p>
          <h2 className="display-type mt-2 text-4xl">
            {estimate.estimatedTotal}
          </h2>
        </div>
        <CheckCircle2 className="text-success size-7" aria-hidden="true" />
      </div>
      <dl className="mt-6 grid gap-3 text-sm">
        <SummaryRow label="Direction" value={estimate.directionLabel} />
        <SummaryRow label="Quantity" value={estimate.quantityLabel} />
        <SummaryRow
          label="Availability"
          value={goldAvailabilityLabels[estimate.availabilityState]}
        />
      </dl>
      {estimate.manualReviewRequired && (
        <div className="border-warning/30 bg-warning/10 mt-5 rounded-xl border p-4 text-sm">
          Manual review is required for this amount before any final trade
          instruction.
        </div>
      )}
      <div className="border-border mt-6 border-t pt-5">
        <h3 className="text-sm font-bold">Estimate breakdown</h3>
        <ul className="mt-3 space-y-2">
          {estimate.lineItems.map((item) => (
            <li
              className="text-text-secondary flex items-center justify-between gap-4 text-sm"
              key={item.label}
            >
              <span>{item.label}</span>
              <span className="font-bold">{formatCents(item.amountCents)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-border mt-5 border-t pt-5">
        <h3 className="text-sm font-bold">Trade instructions</h3>
        <p className="text-text-secondary mt-2 text-sm leading-6">
          {estimate.tradeInstructions}
        </p>
      </div>
      <p className="text-text-muted mt-5 text-xs leading-5">
        {estimate.availabilityMessage} {estimate.finalPriceNote} Valid until{" "}
        {new Date(estimate.validUntil).toLocaleTimeString()}.
      </p>
      <Button asChild className="mt-6 w-full">
        <a href={requestHref}>Request review</a>
      </Button>
    </aside>
  );
}

function SummaryText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-text-muted text-xs font-bold uppercase">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border flex items-start justify-between gap-4 border-b pb-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}

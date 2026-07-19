"use client";

import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Clock3,
  Crown,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gameModeLabels } from "@/lib/catalogue/constants";
import {
  premiumDeliveryLabels,
  premiumPublicStatLabels,
  type PremiumDeliverySpeed,
  type PremiumPublicStatMetricKey,
} from "@/lib/premium/constants";
import { formatCents } from "@/lib/premium/estimate";

type GameMode = keyof typeof gameModeLabels;

type PremiumService = {
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
  gameModes: Array<{ gameMode: GameMode }>;
};

type PremiumRequirement = {
  label: string;
  description: string;
  requirementType: string;
  isRequired: boolean;
  verificationMode: string;
  metricKey: string | null;
  comparisonOperator: string | null;
  requiredValue: number | null;
  customerGuidance: string | null;
};

type PremiumPackage = {
  slug: string;
  name: string;
  shortDescription: string;
  estimatedHours: number | null;
  difficultyTierLabel: string | null;
  requirementsSummary: string | null;
  gearNotes: string | null;
  unlockNotes: string | null;
  customerGearRequired: boolean;
  customerGearLabel: string | null;
  requirementGroups: Array<{
    title: string;
    description: string | null;
    requirements: PremiumRequirement[];
  }>;
  faqs: Array<{ question: string; answer: string }>;
};

type PremiumOption = {
  packageId: string | null;
  package: { slug: string } | null;
  slug: string;
  name: string;
  description: string;
  optionType: string;
  pricingMode: "FIXED_FEE" | "PERCENT_OF_BASE" | "PER_UNIT";
  minimumQuantity: number;
  maximumQuantity: number;
  defaultQuantity: number;
  customerInputRequired: boolean;
};

type PremiumRule = {
  configuratorType: string;
  enabled: boolean;
  discordStreamEnabled: boolean;
  rsnEligibilityEnabled: boolean;
  supportsManualStatFallback: boolean;
  standardDeliveryEnabled: boolean;
  standardDeliveryLabel: string;
  standardDeliveryDescription: string | null;
  standardDeliveryEstimate: string | null;
  priorityDeliveryEnabled: boolean;
  priorityDeliveryLabel: string;
  priorityDeliveryDescription: string | null;
  priorityDeliveryEstimate: string | null;
  expressDeliveryEnabled: boolean;
  expressDeliveryLabel: string;
  expressDeliveryDescription: string | null;
  expressDeliveryEstimate: string | null;
};

type EstimateResponse = {
  ok: boolean;
  message?: string;
  estimate?: {
    selectedPackage: string;
    selectedOptions: Array<{ slug: string; name: string; quantity: number }>;
    accountMode: string;
    customerGearConfirmed: boolean;
    includesDiscordStream: boolean;
    estimatedHours: number | null;
    delivery: {
      speed: PremiumDeliverySpeed;
      label: string;
      description: string | null;
      estimate: string | null;
    };
    lineItems: Array<{ label: string; amountCents: number }>;
    estimatedTotalCents: number;
    estimatedTotal: string;
    finalPriceNote: string;
  };
  eligibility?: {
    ok: boolean;
    message?: string;
    source?: "OFFICIAL_PUBLIC_STATS" | "MANUAL_STATS";
    verificationLabel?: string;
    profile?: { displayName: string };
    results?: Array<{ id: string; title: string; status: string }>;
  } | null;
};

type StatCheckMode = "RSN" | "MANUAL" | "NONE";

export function PremiumConfiguratorEngine({
  service,
  packages,
  options,
  rule,
  requestHref,
  eligibilityEnabled,
}: {
  service: PremiumService;
  packages: PremiumPackage[];
  options: PremiumOption[];
  rule: PremiumRule | null;
  requestHref: string;
  eligibilityEnabled: boolean;
}) {
  const [packageSlug, setPackageSlug] = useState(packages[0]?.slug ?? "");
  const [deliverySpeed, setDeliverySpeed] =
    useState<PremiumDeliverySpeed>("STANDARD");
  const [statCheckMode, setStatCheckMode] = useState<StatCheckMode>("NONE");
  const [customerGearConfirmed, setCustomerGearConfirmed] = useState(false);
  const [includeDiscordStream, setIncludeDiscordStream] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<
    Array<{ slug: string; quantity: number }>
  >([]);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedPackage =
    packages.find((premiumPackage) => premiumPackage.slug === packageSlug) ??
    packages[0] ??
    null;
  const packageOptions = useMemo(
    () =>
      selectedPackage
        ? options.filter(
            (option) =>
              !option.package || option.package.slug === selectedPackage.slug,
          )
        : [],
    [options, selectedPackage],
  );
  const delivery = deliveryOptions(rule);
  const manualMetricRequirements = useMemo(
    () => automaticManualRequirements(selectedPackage),
    [selectedPackage],
  );

  function changePackage(value: string) {
    setPackageSlug(value);
    setStatCheckMode("NONE");
    setCustomerGearConfirmed(false);
    setSelectedOptions([]);
    setResult(null);
  }

  function toggleOption(option: PremiumOption, checked: boolean) {
    setResult(null);
    setSelectedOptions((current) => {
      if (!checked) return current.filter((item) => item.slug !== option.slug);
      if (current.some((item) => item.slug === option.slug)) return current;
      return [
        ...current,
        { slug: option.slug, quantity: option.defaultQuantity },
      ];
    });
  }

  function updateOptionQuantity(option: PremiumOption, quantity: number) {
    setResult(null);
    setSelectedOptions((current) =>
      current.map((item) =>
        item.slug === option.slug
          ? {
              ...item,
              quantity: Math.min(
                option.maximumQuantity,
                Math.max(option.minimumQuantity, quantity),
              ),
            }
          : item,
      ),
    );
  }

  function submit(formData: FormData) {
    const packageValue = selectedPackage?.slug;
    if (!packageValue) return;
    const manualStats =
      statCheckMode === "MANUAL"
        ? manualMetricRequirements.flatMap((requirement) => {
            const rawValue = String(
              formData.get(`manualStat:${requirement.metricKey}`) ?? "",
            ).trim();
            if (!rawValue || !requirement.metricKey) return [];
            return [
              {
                metricKey: requirement.metricKey,
                value: Number(rawValue),
              },
            ];
          })
        : [];
    startTransition(async () => {
      const response = await fetch("/api/premium/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          packageSlug: packageValue,
          optionSelections: selectedOptions,
          gameMode: formData.get("gameMode"),
          customerGearConfirmed,
          includeDiscordStream,
          deliverySpeed,
          statCheckMode,
          rsn:
            statCheckMode === "RSN"
              ? String(formData.get("rsn") ?? "").trim() || undefined
              : undefined,
          manualStats,
        }),
      });
      const body = (await response.json()) as EstimateResponse;
      setResult(body);
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Premium configurator</Badge>
            <Badge variant="warning">Review required</Badge>
          </div>
          <h2 className="display-type mt-5 text-3xl">
            Build the service request
          </h2>
          <div className="text-text-secondary mt-4 space-y-4 leading-7">
            {service.content.split(/\n{2,}/).map((paragraph) => (
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
        <aside className="border-gold/25 bg-gold/5 rounded-2xl border p-6">
          <p className="text-gold kicker-type">Quote preview</p>
          <h2 className="display-type mt-3 text-2xl">Server-backed estimate</h2>
          <p className="text-text-secondary mt-3 text-sm leading-6">
            Estimated totals use the currently published premium configuration.
            Final scope is confirmed before checkout.
          </p>
          <div className="mt-5">
            <h3 className="text-sm font-bold">Supported account modes</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {service.gameModes.map(({ gameMode }) => (
                <Badge variant="info" key={gameMode}>
                  {gameModeLabels[gameMode]}
                </Badge>
              ))}
            </div>
          </div>
          <Button asChild className="mt-6 w-full" variant="secondary">
            <a href={requestHref}>Request quote</a>
          </Button>
        </aside>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          action={submit}
          className="border-primary/25 rounded-3xl border bg-[linear-gradient(135deg,rgba(24,35,21,.92),rgba(5,12,8,.98))] p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-primary kicker-type">Premium service</p>
              <h2 className="display-type mt-3 text-3xl">{service.name}</h2>
            </div>
            <Crown className="text-gold size-8" aria-hidden="true" />
          </div>

          {!packages.length || !rule ? (
            <div className="border-warning/30 bg-warning/10 text-text-secondary mt-6 rounded-2xl border p-5">
              This configurator is waiting for enabled packages and review-ready
              rules.
            </div>
          ) : (
            <>
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="text-sm font-bold">
                  Package
                  <select
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    value={selectedPackage?.slug ?? ""}
                    onChange={(event) => changePackage(event.target.value)}
                  >
                    {packages.map((premiumPackage) => (
                      <option
                        value={premiumPackage.slug}
                        key={premiumPackage.slug}
                      >
                        {premiumPackage.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-bold">
                  Account game mode
                  <select
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    name="gameMode"
                  >
                    {service.gameModes.map(({ gameMode }) => (
                      <option value={gameMode} key={gameMode}>
                        {gameModeLabels[gameMode]} account
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedPackage && (
                <div className="border-border bg-background/35 mt-5 rounded-2xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedPackage.difficultyTierLabel && (
                      <Badge variant="success">
                        {selectedPackage.difficultyTierLabel}
                      </Badge>
                    )}
                    {selectedPackage.estimatedHours && (
                      <Badge variant="info">
                        {selectedPackage.estimatedHours.toLocaleString()} hr
                        estimate
                      </Badge>
                    )}
                  </div>
                  <p className="text-text-secondary mt-3 text-sm leading-6">
                    {selectedPackage.shortDescription}
                  </p>
                </div>
              )}

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <label className="text-sm font-bold">
                  Delivery speed
                  <select
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    value={deliverySpeed}
                    onChange={(event) => {
                      setDeliverySpeed(
                        event.target.value as PremiumDeliverySpeed,
                      );
                      setResult(null);
                    }}
                  >
                    {delivery.map((option) => (
                      <option value={option.speed} key={option.speed}>
                        {option.label}
                        {option.estimate ? ` - ${option.estimate}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="border-border bg-background/35 mt-5 grid gap-3 rounded-2xl border p-4">
                <legend className="px-2 text-sm font-bold">Stat check</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  {eligibilityEnabled && rule.rsnEligibilityEnabled && (
                    <label className="border-border bg-background/45 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold">
                      <input
                        type="radio"
                        name="statCheckMode"
                        checked={statCheckMode === "RSN"}
                        onChange={() => {
                          setStatCheckMode("RSN");
                          setResult(null);
                        }}
                      />
                      Check public stats using RSN
                    </label>
                  )}
                  {rule.supportsManualStatFallback &&
                    manualMetricRequirements.length > 0 && (
                      <label className="border-border bg-background/45 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold">
                        <input
                          type="radio"
                          name="statCheckMode"
                          checked={statCheckMode === "MANUAL"}
                          onChange={() => {
                            setStatCheckMode("MANUAL");
                            setResult(null);
                          }}
                        />
                        Enter stats manually
                      </label>
                    )}
                  <label className="border-border bg-background/45 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold">
                    <input
                      type="radio"
                      name="statCheckMode"
                      checked={statCheckMode === "NONE"}
                      onChange={() => {
                        setStatCheckMode("NONE");
                        setResult(null);
                      }}
                    />
                    Continue without a stat check
                  </label>
                </div>
                {statCheckMode === "RSN" &&
                  eligibilityEnabled &&
                  rule.rsnEligibilityEnabled && (
                    <label className="text-sm font-bold">
                      RuneScape name
                      <input
                        className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                        name="rsn"
                        maxLength={12}
                        placeholder="No password, PIN or authenticator code"
                      />
                    </label>
                  )}
                {statCheckMode === "MANUAL" &&
                  rule.supportsManualStatFallback &&
                  manualMetricRequirements.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {manualMetricRequirements.map((requirement) => (
                        <label
                          className="text-sm font-bold"
                          key={requirement.metricKey}
                        >
                          {requirement.label}
                          <input
                            className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                            name={`manualStat:${requirement.metricKey}`}
                            type="number"
                            min={0}
                            max={
                              requirement.metricKey === "total.level"
                                ? 2277
                                : 99
                            }
                            step={1}
                          />
                        </label>
                      ))}
                      <p className="text-text-muted text-xs leading-5 sm:col-span-2">
                        Customer-entered / not independently verified.
                      </p>
                    </div>
                  )}
              </fieldset>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {selectedPackage?.customerGearRequired && (
                  <label className="border-border bg-background/45 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={customerGearConfirmed}
                      onChange={(event) => {
                        setCustomerGearConfirmed(event.target.checked);
                        setResult(null);
                      }}
                    />
                    {selectedPackage.customerGearLabel ||
                      "Customer-provided gear confirmed"}
                  </label>
                )}
                {rule.discordStreamEnabled && (
                  <label className="border-border bg-background/45 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={includeDiscordStream}
                      onChange={(event) => {
                        setIncludeDiscordStream(event.target.checked);
                        setResult(null);
                      }}
                    />
                    Discord Stream add-on
                  </label>
                )}
              </div>

              {packageOptions.length > 0 && (
                <fieldset className="mt-6 border-0 p-0">
                  <legend className="text-sm font-bold">
                    Options and add-ons
                  </legend>
                  <div className="mt-3 grid gap-3">
                    {packageOptions.map((option) => {
                      const selected = selectedOptions.find(
                        (item) => item.slug === option.slug,
                      );
                      return (
                        <div
                          className="border-border bg-background/35 rounded-2xl border p-4"
                          key={option.slug}
                        >
                          <label className="flex items-start gap-3 text-sm font-semibold">
                            <input
                              className="mt-1"
                              type="checkbox"
                              checked={Boolean(selected)}
                              onChange={(event) =>
                                toggleOption(option, event.target.checked)
                              }
                            />
                            <span>
                              {option.name}
                              <span className="text-text-secondary mt-1 block leading-6 font-normal">
                                {option.description}
                              </span>
                            </span>
                          </label>
                          {selected && option.pricingMode === "PER_UNIT" && (
                            <label className="text-text-secondary mt-3 block text-sm font-semibold">
                              Quantity
                              <input
                                className="border-border bg-background mt-2 min-h-10 w-full rounded-xl border px-3"
                                type="number"
                                min={option.minimumQuantity}
                                max={option.maximumQuantity}
                                value={selected.quantity}
                                onChange={(event) =>
                                  updateOptionQuantity(
                                    option,
                                    Number(event.target.value),
                                  )
                                }
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <RequirementPanels premiumPackage={selectedPackage} />

              {selectedPackage?.faqs.length ? (
                <section className="mt-6">
                  <h3 className="text-sm font-bold">FAQ</h3>
                  <div className="mt-3 grid gap-3">
                    {selectedPackage.faqs.map((faq) => (
                      <details
                        className="border-border bg-background/35 rounded-xl border p-4"
                        key={faq.question}
                      >
                        <summary className="cursor-pointer font-semibold">
                          {faq.question}
                        </summary>
                        <p className="text-text-secondary mt-3 text-sm leading-6">
                          {faq.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={pending || !selectedPackage}>
                  <Calculator className="mr-2 size-4" aria-hidden="true" />
                  {pending ? "Calculating..." : "Estimate total"}
                </Button>
                <p
                  id="premium-configurator-status"
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

        <EstimatePanel result={result} requestHref={requestHref} />
      </section>
    </div>
  );
}

function RequirementPanels({
  premiumPackage,
}: {
  premiumPackage: PremiumPackage | null;
}) {
  if (!premiumPackage) return null;
  const automatic = premiumPackage.requirementGroups.flatMap((group) =>
    group.requirements.filter(
      (requirement) => requirement.verificationMode === "AUTOMATIC",
    ),
  );
  const manual = premiumPackage.requirementGroups.flatMap((group) =>
    group.requirements.filter(
      (requirement) => requirement.verificationMode !== "AUTOMATIC",
    ),
  );
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="border-border bg-background/35 rounded-2xl border p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-4" aria-hidden="true" />
          <h3 className="text-sm font-bold">Public stat requirements</h3>
        </div>
        {automatic.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {automatic.map((requirement) => (
              <li
                className="text-text-secondary flex justify-between gap-4"
                key={`${requirement.metricKey}:${requirement.label}`}
              >
                <span>
                  {premiumPublicStatLabels[
                    requirement.metricKey as PremiumPublicStatMetricKey
                  ] ?? requirement.label}
                </span>
                <strong>{formatRequirementTarget(requirement)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-secondary mt-3 text-sm">
            No automatic public stat checks are configured.
          </p>
        )}
      </section>
      <section className="border-border bg-background/35 rounded-2xl border p-4">
        <div className="flex items-center gap-2">
          <PackageCheck className="text-gold size-4" aria-hidden="true" />
          <h3 className="text-sm font-bold">Gear and unlock requirements</h3>
        </div>
        <ul className="mt-3 space-y-3 text-sm">
          {manual.map((requirement) => (
            <li key={requirement.label}>
              <p className="font-semibold">{requirement.label}</p>
              <p className="text-text-secondary mt-1 leading-5">
                {requirement.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EstimatePanel({
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
          <Clock3 className="text-gold size-5" aria-hidden="true" />
          <h2 className="font-bold">Estimate summary</h2>
        </div>
        <p className="text-text-secondary mt-4 text-sm leading-6">
          Select a package, options and delivery before requesting review.
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-gold kicker-type">Estimated total</p>
          <h2 className="display-type mt-2 text-4xl">
            {estimate.estimatedTotal}
          </h2>
        </div>
        <CheckCircle2 className="text-success size-7" aria-hidden="true" />
      </div>
      <dl className="mt-6 grid gap-3 text-sm">
        <SummaryRow label="Package" value={estimate.selectedPackage} />
        <SummaryRow label="Account mode" value={estimate.accountMode} />
        <SummaryRow label="Delivery" value={estimate.delivery.label} />
        {estimate.delivery.estimate && (
          <SummaryRow
            label="Time estimate"
            value={estimate.delivery.estimate}
          />
        )}
        {estimate.estimatedHours && (
          <SummaryRow
            label="Estimated hours"
            value={`${estimate.estimatedHours.toLocaleString()} hrs`}
          />
        )}
      </dl>
      {estimate.selectedOptions.length ? (
        <div className="border-border mt-5 border-t pt-5">
          <h3 className="text-sm font-bold">Selected options</h3>
          <ul className="text-text-secondary mt-3 space-y-2 text-sm">
            {estimate.selectedOptions.map((option) => (
              <li key={option.slug}>
                {option.name}
                {option.quantity > 1 ? ` x ${option.quantity}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
      <EligibilityPanel result={result} />
      <p className="text-text-muted mt-5 text-xs leading-5">
        {estimate.finalPriceNote}
      </p>
      <Button asChild className="mt-6 w-full">
        <a href={requestHref}>Request quote</a>
      </Button>
    </aside>
  );
}

function EligibilityPanel({ result }: { result: EstimateResponse }) {
  if (!result.eligibility) return null;
  if (!result.eligibility.ok) {
    return (
      <div className="border-warning/30 bg-warning/10 text-text-secondary mt-5 rounded-xl border p-4 text-sm">
        {result.eligibility.message}
      </div>
    );
  }
  const manual = result.eligibility.source === "MANUAL_STATS";
  return (
    <div className="border-primary/30 bg-primary/10 mt-5 rounded-xl border p-4">
      <h3 className="text-sm font-bold">
        {manual
          ? "Manual stat check"
          : `Public stat check: ${result.eligibility.profile?.displayName ?? "RSN"}`}
      </h3>
      {result.eligibility.verificationLabel && (
        <p className="text-text-secondary mt-2 text-xs leading-5">
          {result.eligibility.verificationLabel}
        </p>
      )}
      <ul className="mt-3 space-y-2 text-sm">
        {result.eligibility.results?.map((item) => (
          <li
            className="text-text-secondary flex items-center justify-between gap-4"
            key={item.id}
          >
            <span>{item.title}</span>
            <strong>{item.status.replaceAll("_", " ")}</strong>
          </li>
        ))}
      </ul>
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

function deliveryOptions(rule: PremiumRule | null) {
  if (!rule) return [];
  return [
    {
      speed: "STANDARD" as const,
      enabled: rule.standardDeliveryEnabled,
      label: rule.standardDeliveryLabel || premiumDeliveryLabels.STANDARD,
      description: rule.standardDeliveryDescription,
      estimate: rule.standardDeliveryEstimate,
    },
    {
      speed: "PRIORITY" as const,
      enabled: rule.priorityDeliveryEnabled,
      label: rule.priorityDeliveryLabel || premiumDeliveryLabels.PRIORITY,
      description: rule.priorityDeliveryDescription,
      estimate: rule.priorityDeliveryEstimate,
    },
    {
      speed: "EXPRESS" as const,
      enabled: rule.expressDeliveryEnabled,
      label: rule.expressDeliveryLabel || premiumDeliveryLabels.EXPRESS,
      description: rule.expressDeliveryDescription,
      estimate: rule.expressDeliveryEstimate,
    },
  ].filter((option) => option.enabled);
}

function automaticManualRequirements(premiumPackage: PremiumPackage | null) {
  if (!premiumPackage) return [];
  const seen = new Set<string>();
  return premiumPackage.requirementGroups.flatMap((group) =>
    group.requirements.filter((requirement) => {
      if (
        requirement.verificationMode !== "AUTOMATIC" ||
        !["SKILL", "ACCOUNT"].includes(requirement.requirementType) ||
        !requirement.metricKey ||
        !premiumPublicStatLabels[
          requirement.metricKey as PremiumPublicStatMetricKey
        ] ||
        seen.has(requirement.metricKey)
      ) {
        return false;
      }
      seen.add(requirement.metricKey);
      return true;
    }),
  );
}

function formatRequirementTarget(requirement: PremiumRequirement) {
  const value = requirement.requiredValue;
  if (value == null) return "Review";
  switch (requirement.comparisonOperator) {
    case "GREATER_THAN_OR_EQUAL":
      return `${value}+`;
    case "GREATER_THAN":
      return `>${value}`;
    case "EQUAL":
      return `${value}`;
    case "LESS_THAN_OR_EQUAL":
      return `<=${value}`;
    case "LESS_THAN":
      return `<${value}`;
    default:
      return `${value}+`;
  }
}

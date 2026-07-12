"use client";

import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Clock3,
  Crosshair,
  Radio,
  ShieldCheck,
  Swords,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { catalogueGameModes, gameModeLabels } from "@/lib/catalogue/constants";
import {
  bossingDeliveryLabels,
  bossingPublicStatLabels,
  type BossingDeliverySpeed,
  type BossingKillMode,
  type BossingPublicStatMetricKey,
} from "@/lib/bossing/constants";

type CatalogueGameMode = (typeof catalogueGameModes)[number];

type BossingMethod = {
  slug: string;
  name: string;
  shortDescription: string;
  priceMode: "PER_KILL" | "FIXED_PACKAGE";
  minimumKillCount: number;
  maximumKillCount: number | null;
  difficultyTierLabel: string | null;
  expectedRequirementsSummary: string | null;
  gearNotes: string | null;
  supplyNotes: string | null;
  suppliesEnabled: boolean;
  suppliesLabel: string | null;
  customerGearRequired: boolean;
  customerGearLabel: string | null;
  estimatedKillsPerHour: number | null;
  statRequirements: Array<{
    metricKey: string;
    label: string;
    requiredLevel: number;
    verificationMode: string;
    customerGuidance: string | null;
  }>;
  gearRequirements: Array<{
    label: string;
    description: string;
    isRequired: boolean;
    verificationMode: string;
    customerGuidance: string | null;
  }>;
};

type Boss = {
  bossKey: string;
  name: string;
  groupLabel: string | null;
  iconKey: string | null;
  description: string | null;
  methods: BossingMethod[];
};

type PublicRule = {
  discordStreamEnabled: boolean;
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
    selectedBoss: string;
    selectedMethod: string;
    accountMode: string;
    requestedKills: number;
    currentKillCount: number | null;
    targetKillCount: number | null;
    killMode: BossingKillMode;
    customerGearConfirmed: boolean;
    includesSupplies: boolean;
    includesDiscordStream: boolean;
    estimatedHours: number | null;
    delivery: {
      speed: BossingDeliverySpeed;
      label: string;
      description: string | null;
      estimate: string | null;
    };
    lineItems: Array<{ label: string; amountCents: number }>;
    estimatedTotal: string;
    finalPriceNote: string;
  };
  eligibility?: null | {
    ok: boolean;
    message?: string;
    profile?: {
      displayName: string;
      fetchedAt: string;
      provider: string;
      cached: boolean;
    };
    summary?: Record<string, number>;
    results?: Array<{
      id: string;
      title: string;
      status: string;
      actualValue: number | null;
      requiredValue: number | null;
      customerGuidance: string | null;
    }>;
  };
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCents(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

function deliveryOptions(rule: PublicRule | null) {
  if (!rule) return [];
  return [
    {
      speed: "STANDARD" as const,
      enabled: rule.standardDeliveryEnabled,
      label: rule.standardDeliveryLabel || bossingDeliveryLabels.STANDARD,
      description: rule.standardDeliveryDescription,
      estimate: rule.standardDeliveryEstimate,
    },
    {
      speed: "PRIORITY" as const,
      enabled: rule.priorityDeliveryEnabled,
      label: rule.priorityDeliveryLabel || bossingDeliveryLabels.PRIORITY,
      description: rule.priorityDeliveryDescription,
      estimate: rule.priorityDeliveryEstimate,
    },
    {
      speed: "EXPRESS" as const,
      enabled: rule.expressDeliveryEnabled,
      label: rule.expressDeliveryLabel || bossingDeliveryLabels.EXPRESS,
      description: rule.expressDeliveryDescription,
      estimate: rule.expressDeliveryEstimate,
    },
  ].filter((option) => option.enabled);
}

export function BossingCalculatorEngine({
  service,
  bosses,
  rule,
  requestHref,
  eligibilityEnabled,
}: {
  service: {
    id: string;
    name: string;
    content: string;
    requirements: Array<{
      id: string;
      title: string;
      description: string;
      isRequired: boolean;
    }>;
    gameModes: Array<{ gameMode: CatalogueGameMode }>;
  };
  bosses: Boss[];
  rule: PublicRule | null;
  requestHref: string;
  eligibilityEnabled: boolean;
}) {
  const initialBoss = bosses[0]?.bossKey ?? "";
  const [bossKey, setBossKey] = useState(initialBoss);
  const selectedBoss =
    bosses.find((boss) => boss.bossKey === bossKey) ?? bosses[0] ?? null;
  const [methodSlug, setMethodSlug] = useState(
    selectedBoss?.methods[0]?.slug ?? "",
  );
  const selectedMethod =
    selectedBoss?.methods.find((method) => method.slug === methodSlug) ??
    selectedBoss?.methods[0] ??
    null;
  const [killMode, setKillMode] = useState<BossingKillMode>("DIRECT");
  const [includeSupplies, setIncludeSupplies] = useState(false);
  const [includeDiscordStream, setIncludeDiscordStream] = useState(false);
  const [customerGearConfirmed, setCustomerGearConfirmed] = useState(false);
  const delivery = useMemo(() => deliveryOptions(rule), [rule]);
  const [deliverySpeed, setDeliverySpeed] = useState<BossingDeliverySpeed>(
    delivery[0]?.speed ?? "STANDARD",
  );
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [pending, startTransition] = useTransition();

  function changeBoss(nextBossKey: string) {
    const nextBoss = bosses.find((boss) => boss.bossKey === nextBossKey);
    setBossKey(nextBossKey);
    setMethodSlug(nextBoss?.methods[0]?.slug ?? "");
    setIncludeSupplies(false);
    setCustomerGearConfirmed(false);
    setResult(null);
  }

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      try {
        const rsn = String(formData.get("rsn") ?? "").trim();
        const response = await fetch("/api/bossing/estimate", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: service.id,
            bossKey,
            methodSlug,
            killMode,
            killQuantity:
              killMode === "DIRECT"
                ? Number(formData.get("killQuantity"))
                : undefined,
            currentKillCount:
              killMode === "TARGET_KC"
                ? Number(formData.get("currentKillCount"))
                : undefined,
            targetKillCount:
              killMode === "TARGET_KC"
                ? Number(formData.get("targetKillCount"))
                : undefined,
            gameMode: formData.get("gameMode"),
            customerGearConfirmed,
            includeSupplies,
            includeDiscordStream,
            deliverySpeed,
            rsn: rsn || undefined,
          }),
        });
        setResult((await response.json()) as EstimateResponse);
      } catch {
        setResult({
          ok: false,
          message: "The estimate could not be calculated. Please try again.",
        });
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="border-border bg-surface-1 rounded-2xl border p-6">
          <h2 className="display-type text-3xl">About this service</h2>
          <div className="text-text-secondary mt-4 space-y-3 leading-7">
            {service.content.split(/\n{2,}/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {service.requirements.length > 0 && (
            <ul className="mt-6 grid gap-3">
              {service.requirements.map((requirement) => (
                <li
                  key={requirement.id}
                  className="border-border bg-background/40 flex gap-3 rounded-xl border p-4"
                >
                  <ShieldCheck
                    className="text-primary mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-bold">{requirement.title}</h3>
                    <p className="text-text-secondary mt-1 text-sm leading-6">
                      {requirement.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="border-gold/25 bg-gold/5 rounded-2xl border p-6">
          <p className="text-gold kicker-type">Estimate preview</p>
          <h2 className="display-type mt-3 text-2xl">
            Server-backed PvM calculator
          </h2>
          <p className="text-text-secondary mt-3 text-sm leading-6">
            Estimated total is calculated from current published bossing rules.
            Final price is confirmed before checkout.
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
          className="border-primary/25 rounded-3xl border bg-[linear-gradient(135deg,rgba(20,38,22,.92),rgba(5,12,8,.98))] p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-primary kicker-type">Bossing calculator</p>
              <h2 className="display-type mt-3 text-3xl">{service.name}</h2>
            </div>
            <Badge variant="info">Estimated total</Badge>
          </div>

          {!bosses.length || !rule ? (
            <div className="border-warning/30 bg-warning/10 text-text-secondary mt-6 rounded-2xl border p-5">
              This calculator is waiting for enabled bosses, methods and
              review-ready rules.
            </div>
          ) : (
            <>
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="text-sm font-bold">
                  Boss
                  <select
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    value={bossKey}
                    onChange={(event) => changeBoss(event.target.value)}
                  >
                    {bosses.map((boss) => (
                      <option value={boss.bossKey} key={boss.bossKey}>
                        {boss.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-bold">
                  Method or package
                  <select
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    value={selectedMethod?.slug ?? ""}
                    onChange={(event) => {
                      setMethodSlug(event.target.value);
                      setIncludeSupplies(false);
                      setCustomerGearConfirmed(false);
                      setResult(null);
                    }}
                  >
                    {selectedBoss?.methods.map((method) => (
                      <option value={method.slug} key={method.slug}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedMethod && (
                <div className="border-border bg-background/35 mt-5 rounded-2xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedMethod.difficultyTierLabel && (
                      <Badge variant="success">
                        {selectedMethod.difficultyTierLabel}
                      </Badge>
                    )}
                    <Badge variant="info">
                      {selectedMethod.minimumKillCount.toLocaleString()}
                      {selectedMethod.maximumKillCount
                        ? `-${selectedMethod.maximumKillCount.toLocaleString()}`
                        : "+"}{" "}
                      kills
                    </Badge>
                    {selectedMethod.estimatedKillsPerHour && (
                      <Badge variant="info">
                        {formatNumber(selectedMethod.estimatedKillsPerHour)}{" "}
                        kills/hr estimate
                      </Badge>
                    )}
                  </div>
                  <p className="text-text-secondary mt-3 text-sm leading-6">
                    {selectedMethod.shortDescription}
                  </p>
                </div>
              )}

              <fieldset className="mt-6 border-0 p-0">
                <legend className="text-sm font-bold">Kill request mode</legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {[
                    ["DIRECT", "Direct kills"],
                    ["TARGET_KC", "Current KC to target KC"],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className={`border-border flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${killMode === value ? "bg-primary/15 text-primary" : "bg-background/45 text-text-secondary"}`}
                    >
                      <input
                        type="radio"
                        name="killMode"
                        value={value}
                        checked={killMode === value}
                        onChange={() => {
                          setKillMode(value as BossingKillMode);
                          setResult(null);
                        }}
                      />
                      <Radio className="size-4" aria-hidden="true" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {killMode === "DIRECT" ? (
                <label className="mt-5 block text-sm font-bold">
                  Desired kill count
                  <input
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    name="killQuantity"
                    type="number"
                    min="1"
                    max="1000000"
                    defaultValue="25"
                    required
                  />
                </label>
              ) : (
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    Current KC
                    <input
                      className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                      name="currentKillCount"
                      type="number"
                      min="0"
                      max="1000000"
                      defaultValue="0"
                      required
                    />
                  </label>
                  <label className="text-sm font-bold">
                    Target KC
                    <input
                      className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                      name="targetKillCount"
                      type="number"
                      min="1"
                      max="1000000"
                      defaultValue="25"
                      required
                    />
                  </label>
                </div>
              )}

              <div className="mt-5 grid gap-5 md:grid-cols-2">
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
                <label className="text-sm font-bold">
                  Delivery speed
                  <select
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    value={deliverySpeed}
                    onChange={(event) => {
                      setDeliverySpeed(
                        event.target.value as BossingDeliverySpeed,
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

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {selectedMethod?.customerGearRequired && (
                  <label className="border-border bg-background/45 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={customerGearConfirmed}
                      onChange={(event) => {
                        setCustomerGearConfirmed(event.target.checked);
                        setResult(null);
                      }}
                    />
                    {selectedMethod.customerGearLabel ||
                      "Customer-provided gear confirmed"}
                  </label>
                )}
                {selectedMethod?.suppliesEnabled && (
                  <label className="border-border bg-background/45 flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={includeSupplies}
                      onChange={(event) => {
                        setIncludeSupplies(event.target.checked);
                        setResult(null);
                      }}
                    />
                    {selectedMethod.suppliesLabel || "Supplies and materials"}
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

              {eligibilityEnabled && (
                <label className="mt-5 block text-sm font-bold">
                  Optional RSN public stat check
                  <input
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    name="rsn"
                    maxLength={12}
                    placeholder="Do not enter a password"
                  />
                </label>
              )}

              <RequirementPanels method={selectedMethod} />

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={pending || !selectedMethod}>
                  <Calculator className="mr-2 size-4" aria-hidden="true" />
                  {pending ? "Calculating..." : "Estimate total"}
                </Button>
                <p
                  id="bossing-calculator-status"
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

function RequirementPanels({ method }: { method: BossingMethod | null }) {
  if (!method) return null;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="border-border bg-background/35 rounded-2xl border p-4">
        <div className="flex items-center gap-2">
          <Crosshair className="text-primary size-4" aria-hidden="true" />
          <h3 className="text-sm font-bold">Public stat requirements</h3>
        </div>
        {method.statRequirements.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {method.statRequirements.map((requirement) => (
              <li
                className="text-text-secondary flex justify-between gap-4"
                key={requirement.metricKey}
              >
                <span>
                  {bossingPublicStatLabels[
                    requirement.metricKey as BossingPublicStatMetricKey
                  ] ?? requirement.label}
                </span>
                <strong>{requirement.requiredLevel}+</strong>
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
          <Swords className="text-gold size-4" aria-hidden="true" />
          <h3 className="text-sm font-bold">Customer/support requirements</h3>
        </div>
        <ul className="mt-3 space-y-3 text-sm">
          {method.gearRequirements.map((requirement) => (
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
          Select a boss, method and kill count before requesting review.
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
        <SummaryRow label="Boss" value={estimate.selectedBoss} />
        <SummaryRow label="Method" value={estimate.selectedMethod} />
        <SummaryRow
          label="Requested kills"
          value={formatNumber(estimate.requestedKills)}
        />
        {estimate.currentKillCount != null && (
          <SummaryRow label="Current KC">
            {formatNumber(estimate.currentKillCount)} to{" "}
            {formatNumber(estimate.targetKillCount ?? 0)}
          </SummaryRow>
        )}
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
  return (
    <div className="border-primary/30 bg-primary/10 mt-5 rounded-xl border p-4">
      <h3 className="text-sm font-bold">
        Public stat check: {result.eligibility.profile?.displayName}
      </h3>
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

function SummaryRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-border flex items-start justify-between gap-4 border-b pb-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-bold">{children ?? value}</dd>
    </div>
  );
}

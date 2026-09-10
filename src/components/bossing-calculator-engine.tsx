"use client";

import { Crosshair, Search, Swords } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { StoreNumberField } from "@/components/store-number-field";
import {
  AddEstimateToCart,
  MobileEstimateCart,
} from "@/components/add-estimate-to-cart";
import { serviceReferenceIcon } from "@/components/service-reference-icon";
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
  const initialBoss =
    bosses.find((b) => b.name === "Zulrah")?.bossKey ??
    bosses[0]?.bossKey ??
    "";
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
  const [cartSource, setCartSource] = useState<Record<string, unknown> | null>(
    null,
  );
  const [bossSearch, setBossSearch] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const requestIdRef = useRef(0);
  const [estimateRevision, setEstimateRevision] = useState(0);
  const [pending, startTransition] = useTransition();
  const filteredBosses = useMemo(() => {
    const query = bossSearch.trim().toLowerCase();
    return query
      ? bosses.filter((boss) =>
          [boss.name, boss.groupLabel, boss.description]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : bosses;
  }, [bossSearch, bosses]);

  useEffect(() => {
    if (!rule || !selectedMethod) return;
    const timeout = window.setTimeout(
      () => formRef.current?.requestSubmit(),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [estimateRevision, rule, selectedMethod]);

  function changeBoss(nextBossKey: string) {
    const nextBoss = bosses.find((boss) => boss.bossKey === nextBossKey);
    setBossKey(nextBossKey);
    setMethodSlug(nextBoss?.methods[0]?.slug ?? "");
    setIncludeSupplies(false);
    setCustomerGearConfirmed(false);
    setResult(null);
  }

  function submit(formData: FormData) {
    const requestId = ++requestIdRef.current;
    setResult(null);
    setCartSource(null);
    const rsn = String(formData.get("rsn") ?? "").trim();
    const cartSelection = {
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
    };
    const estimateSource = { ...cartSelection, rsn: rsn || undefined };
    startTransition(async () => {
      try {
        const response = await fetch("/api/bossing/estimate", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(estimateSource),
        });
        const payload = (await response.json()) as EstimateResponse;
        if (requestId !== requestIdRef.current) return;
        setResult(payload);
        setCartSource(payload.ok && payload.estimate ? cartSelection : null);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setResult({
          ok: false,
          message: "The estimate could not be calculated. Please try again.",
        });
      }
    });
  }

  function invalidate() {
    requestIdRef.current++;
    setResult(null);
    setCartSource(null);
    setEstimateRevision((v) => v + 1);
  }
  const groups = [...new Set(bosses.map((b) => b.groupLabel).filter(Boolean))];
  return (
    <div className="reference-boss-layout">
      <section className="reference-boss-catalogue">
        <label className="store-search">
          <Search size={18} />
          <input
            aria-label="Search and select a boss"
            placeholder="Try zul, vork or nex…"
            value={bossSearch}
            onChange={(e) => setBossSearch(e.target.value)}
          />
        </label>
        <div className="reference-filter-row">
          <button
            className={
              "service-filter-chip " + (!bossSearch ? "is-active" : "")
            }
            onClick={() => setBossSearch("")}
          >
            All
          </button>
          {groups.map((group) => (
            <button
              key={group}
              className={
                "service-filter-chip " +
                (bossSearch === group ? "is-active" : "")
              }
              onClick={() => setBossSearch(group ?? "")}
            >
              {group}
            </button>
          ))}
        </div>
        <div className="reference-boss-grid">
          {filteredBosses.map((boss) => (
            <button
              type="button"
              key={boss.bossKey}
              aria-pressed={bossKey === boss.bossKey}
              aria-label={boss.name}
              onClick={() => {
                changeBoss(boss.bossKey);
                invalidate();
              }}
            >
              <span
                className="reference-boss-portrait"
                style={serviceReferenceIcon(boss.name, "boss", boss.iconKey)}
              >
                {!serviceReferenceIcon(boss.name, "boss", boss.iconKey) && (
                  <Swords aria-hidden="true" />
                )}
              </span>
              <strong>{boss.name}</strong>
            </button>
          ))}
        </div>
        {!filteredBosses.length && (
          <p className="store-empty">No bosses match your search.</p>
        )}
      </section>
      <form
        ref={formRef}
        className="store-panel reference-boss-config"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        onChangeCapture={invalidate}
      >
        <div className="reference-selected-boss">
          <span
            className="reference-boss-portrait"
            style={serviceReferenceIcon(
              selectedBoss?.name ?? "",
              "boss",
              selectedBoss?.iconKey,
            )}
          />
          <div>
            <h2>{selectedBoss?.name ?? "Bossing Services"}</h2>
            <p>{selectedBoss?.description}</p>
          </div>
        </div>
        {!rule || !bosses.length ? (
          <p>Bossing services are currently unavailable.</p>
        ) : (
          <>
            <label className="store-field">
              Select Service
              <select
                value={methodSlug}
                onChange={(e) => {
                  setMethodSlug(e.target.value);
                  setCustomerGearConfirmed(false);
                  setIncludeSupplies(false);
                }}
              >
                {selectedBoss?.methods.map((method) => (
                  <option key={method.slug} value={method.slug}>
                    {method.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="store-inline-options">
              <label>
                <input
                  type="radio"
                  checked={killMode === "DIRECT"}
                  onChange={() => setKillMode("DIRECT")}
                />
                Number of kills
              </label>
              <label>
                <input
                  type="radio"
                  checked={killMode === "TARGET_KC"}
                  onChange={() => setKillMode("TARGET_KC")}
                />
                Target KC
              </label>
            </div>
            {killMode === "DIRECT" ? (
              <StoreNumberField
                label="Desired kill count"
                name="killQuantity"
                initial={25}
                min={1}
                max={selectedMethod?.maximumKillCount ?? 1000000}
                onAdjust={invalidate}
              />
            ) : (
              <div className="store-fields-two">
                <StoreNumberField
                  label="Current kill count"
                  name="currentKillCount"
                  initial={0}
                  min={0}
                  max={1000000}
                  onAdjust={invalidate}
                />
                <StoreNumberField
                  label="Target kill count"
                  name="targetKillCount"
                  initial={25}
                  max={1000000}
                  onAdjust={invalidate}
                />
              </div>
            )}
            <div className="store-fields-two">
              <label className="store-field">
                Account type
                <select name="gameMode">
                  {service.gameModes.map(({ gameMode }) => (
                    <option key={gameMode} value={gameMode}>
                      {gameModeLabels[gameMode]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="store-field">
                Delivery speed
                <select
                  value={deliverySpeed}
                  onChange={(e) =>
                    setDeliverySpeed(e.target.value as BossingDeliverySpeed)
                  }
                >
                  {delivery.map((d) => (
                    <option key={d.speed} value={d.speed}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <h3 className="mt-4">Additional Options</h3>
            <div className="store-inline-options">
              {selectedMethod?.customerGearRequired && (
                <label>
                  <input
                    type="checkbox"
                    checked={customerGearConfirmed}
                    onChange={(e) => setCustomerGearConfirmed(e.target.checked)}
                  />
                  {selectedMethod.customerGearLabel ??
                    "I confirm I have the required gear"}
                </label>
              )}
              {selectedMethod?.suppliesEnabled && (
                <label>
                  <input
                    type="checkbox"
                    checked={includeSupplies}
                    onChange={(e) => setIncludeSupplies(e.target.checked)}
                  />
                  {selectedMethod.suppliesLabel ?? "Include supplies"}
                </label>
              )}
              {rule.discordStreamEnabled && (
                <label>
                  <input
                    type="checkbox"
                    checked={includeDiscordStream}
                    onChange={(e) => setIncludeDiscordStream(e.target.checked)}
                  />
                  Stream add-on
                </label>
              )}
            </div>
            {eligibilityEnabled && (
              <details className="store-details">
                <summary>Check account stats (optional)</summary>
                <label className="store-field">
                  RuneScape name
                  <input name="rsn" maxLength={12} />
                </label>
              </details>
            )}
            <section className="reference-boss-summary">
              <h2>Order Summary</h2>
              {result?.estimate && (
                <dl className="reference-summary-lines">
                  <div>
                    <dt>Service</dt>
                    <dd>{result.estimate.selectedBoss}</dd>
                  </div>
                  <div>
                    <dt>Kills</dt>
                    <dd>{result.estimate.requestedKills}</dd>
                  </div>
                  <div>
                    <dt>Account</dt>
                    <dd>{result.estimate.accountMode}</dd>
                  </div>
                  <div>
                    <dt>Estimated time</dt>
                    <dd>
                      {result.estimate.delivery.estimate ??
                        (result.estimate.estimatedHours
                          ? result.estimate.estimatedHours + " hours"
                          : "Confirmed after review")}
                    </dd>
                  </div>
                </dl>
              )}
              {result && !result.ok && (
                <p role="alert" className="store-error">
                  {result.message}
                </p>
              )}
              <div className="reference-total">
                <span>Total Price:</span>
                <strong>
                  {result?.estimate?.estimatedTotal ??
                    (pending ? "Calculating…" : "—")}
                </strong>
              </div>
              <AddEstimateToCart kind="BOSSING_ESTIMATE" source={cartSource} />
              {result?.estimate && (
                <details className="store-details">
                  <summary>Price breakdown</summary>
                  {result.estimate.lineItems.map((line, i) => (
                    <p key={i}>
                      {line.label}: {formatCents(line.amountCents)}
                    </p>
                  ))}
                  <p>{result.estimate.finalPriceNote}</p>
                </details>
              )}
              {result && <EligibilityPanel result={result} />}
            </section>
            <details className="store-details">
              <summary>Requirements & Information</summary>
              <p>{selectedMethod?.expectedRequirementsSummary}</p>
              <p>{selectedMethod?.gearNotes}</p>
              <p>{selectedMethod?.supplyNotes}</p>
              <RequirementPanels method={selectedMethod} />
              {service.requirements.map((r) => (
                <p key={r.id}>
                  {r.title}: {r.description}
                </p>
              ))}
            </details>
            <a href={requestHref} className="text-primary text-sm">
              Need a custom order?
            </a>
            <MobileEstimateCart
              kind="BOSSING_ESTIMATE"
              source={cartSource}
              total={result?.estimate?.estimatedTotal ?? "—"}
            />
          </>
        )}
      </form>
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

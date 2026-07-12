"use client";

import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Clock3,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { catalogueGameModes, gameModeLabels } from "@/lib/catalogue/constants";
import {
  skillingDeliveryLabels,
  type SkillingDeliverySpeed,
  type SkillingSkillKey,
} from "@/lib/skilling/constants";

type CatalogueGameMode = (typeof catalogueGameModes)[number];

type Skill = {
  skillKey: SkillingSkillKey;
  name: string;
  iconKey: string | null;
  methods: Array<{
    slug: string;
    name: string;
    shortDescription: string;
    minimumLevel: number;
    maximumLevel: number;
    xpPerHour: number | null;
    suppliesEnabled: boolean;
    suppliesLabel: string | null;
  }>;
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
    selectedSkill: string;
    selectedMethod: string;
    accountMode: string;
    currentLevel: number;
    targetLevel: number;
    currentXp: number;
    targetXp: number;
    xpRequired: number;
    estimatedHours: number | null;
    delivery: {
      speed: SkillingDeliverySpeed;
      label: string;
      description: string | null;
      estimate: string | null;
    };
    lineItems: Array<{ label: string; amountCents: number }>;
    estimatedTotal: string;
    finalPriceNote: string;
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
      label: rule.standardDeliveryLabel || skillingDeliveryLabels.STANDARD,
      description: rule.standardDeliveryDescription,
      estimate: rule.standardDeliveryEstimate,
    },
    {
      speed: "PRIORITY" as const,
      enabled: rule.priorityDeliveryEnabled,
      label: rule.priorityDeliveryLabel || skillingDeliveryLabels.PRIORITY,
      description: rule.priorityDeliveryDescription,
      estimate: rule.priorityDeliveryEstimate,
    },
    {
      speed: "EXPRESS" as const,
      enabled: rule.expressDeliveryEnabled,
      label: rule.expressDeliveryLabel || skillingDeliveryLabels.EXPRESS,
      description: rule.expressDeliveryDescription,
      estimate: rule.expressDeliveryEstimate,
    },
  ].filter((option) => option.enabled);
}

export function SkillingCalculatorEngine({
  service,
  skills,
  rule,
  requestHref,
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
  skills: Skill[];
  rule: PublicRule | null;
  requestHref: string;
}) {
  const initialSkill = skills[0]?.skillKey ?? "ATTACK";
  const [skillKey, setSkillKey] = useState<SkillingSkillKey>(initialSkill);
  const selectedSkill =
    skills.find((skill) => skill.skillKey === skillKey) ?? skills[0] ?? null;
  const [methodSlug, setMethodSlug] = useState(
    selectedSkill?.methods[0]?.slug ?? "",
  );
  const selectedMethod =
    selectedSkill?.methods.find((method) => method.slug === methodSlug) ??
    selectedSkill?.methods[0] ??
    null;
  const [inputMode, setInputMode] = useState<"LEVEL" | "XP">("LEVEL");
  const [includeSupplies, setIncludeSupplies] = useState(false);
  const [includeDiscordStream, setIncludeDiscordStream] = useState(false);
  const delivery = useMemo(() => deliveryOptions(rule), [rule]);
  const [deliverySpeed, setDeliverySpeed] = useState<SkillingDeliverySpeed>(
    delivery[0]?.speed ?? "STANDARD",
  );
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [pending, startTransition] = useTransition();

  function changeSkill(nextSkillKey: SkillingSkillKey) {
    const nextSkill = skills.find((skill) => skill.skillKey === nextSkillKey);
    setSkillKey(nextSkillKey);
    setMethodSlug(nextSkill?.methods[0]?.slug ?? "");
    setIncludeSupplies(false);
    setResult(null);
  }

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/skilling/estimate", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: service.id,
            skillKey,
            methodSlug,
            inputMode,
            currentLevel:
              inputMode === "LEVEL"
                ? Number(formData.get("currentLevel"))
                : undefined,
            targetLevel:
              inputMode === "LEVEL"
                ? Number(formData.get("targetLevel"))
                : undefined,
            currentXp:
              inputMode === "XP"
                ? Number(formData.get("currentXp"))
                : undefined,
            targetXp:
              inputMode === "XP" ? Number(formData.get("targetXp")) : undefined,
            gameMode: formData.get("gameMode"),
            includeSupplies,
            includeDiscordStream,
            deliverySpeed,
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
            Server-confirmed calculator
          </h2>
          <p className="text-text-secondary mt-3 text-sm leading-6">
            Estimated total is calculated from the current published skilling
            rules. Final price is confirmed before checkout.
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
              <p className="text-primary kicker-type">Skilling calculator</p>
              <h2 className="display-type mt-3 text-3xl">{service.name}</h2>
            </div>
            <Badge variant="info">Estimated total</Badge>
          </div>

          {!skills.length || !rule ? (
            <div className="border-warning/30 bg-warning/10 text-text-secondary mt-6 rounded-2xl border p-5">
              This calculator is waiting for enabled methods and review-ready
              rules.
            </div>
          ) : (
            <>
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="text-sm font-bold">
                  Skill
                  <select
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    value={skillKey}
                    onChange={(event) =>
                      changeSkill(event.target.value as SkillingSkillKey)
                    }
                  >
                    {skills.map((skill) => (
                      <option value={skill.skillKey} key={skill.skillKey}>
                        {skill.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-bold">
                  Training method
                  <select
                    className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                    value={selectedMethod?.slug ?? ""}
                    onChange={(event) => {
                      setMethodSlug(event.target.value);
                      setIncludeSupplies(false);
                      setResult(null);
                    }}
                  >
                    {selectedSkill?.methods.map((method) => (
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
                    <Badge variant="success">
                      Levels {selectedMethod.minimumLevel}-
                      {selectedMethod.maximumLevel}
                    </Badge>
                    {selectedMethod.xpPerHour && (
                      <Badge variant="info">
                        {formatNumber(selectedMethod.xpPerHour)} XP/hr estimate
                      </Badge>
                    )}
                  </div>
                  <p className="text-text-secondary mt-3 text-sm leading-6">
                    {selectedMethod.shortDescription}
                  </p>
                </div>
              )}

              <fieldset className="mt-6 border-0 p-0">
                <legend className="text-sm font-bold">Input mode</legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {[
                    ["LEVEL", "Level"],
                    ["XP", "XP"],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className={`border-border flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${inputMode === value ? "bg-primary/15 text-primary" : "bg-background/45 text-text-secondary"}`}
                    >
                      <input
                        type="radio"
                        name="inputMode"
                        value={value}
                        checked={inputMode === value}
                        onChange={() => {
                          setInputMode(value as "LEVEL" | "XP");
                          setResult(null);
                        }}
                      />
                      <Radio className="size-4" aria-hidden="true" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {inputMode === "LEVEL" ? (
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    Current level
                    <input
                      className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                      name="currentLevel"
                      type="number"
                      min="1"
                      max="99"
                      defaultValue="1"
                      required
                    />
                  </label>
                  <label className="text-sm font-bold">
                    Target level
                    <input
                      className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                      name="targetLevel"
                      type="number"
                      min="2"
                      max="99"
                      defaultValue="50"
                      required
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    Current XP
                    <input
                      className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                      name="currentXp"
                      type="number"
                      min="0"
                      max="200000000"
                      defaultValue="0"
                      required
                    />
                  </label>
                  <label className="text-sm font-bold">
                    Target XP
                    <input
                      className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                      name="targetXp"
                      type="number"
                      min="1"
                      max="200000000"
                      defaultValue="101333"
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
                        event.target.value as SkillingDeliverySpeed,
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

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={pending || !selectedMethod}>
                  <Calculator className="mr-2 size-4" aria-hidden="true" />
                  {pending ? "Calculating..." : "Estimate total"}
                </Button>
                <p
                  id="skilling-calculator-status"
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
          Select a method and calculate an estimate before requesting review.
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
        <SummaryRow label="Skill" value={estimate.selectedSkill} />
        <SummaryRow label="Method" value={estimate.selectedMethod} />
        <SummaryRow label="Progress">
          Level {estimate.currentLevel} to {estimate.targetLevel}
        </SummaryRow>
        <SummaryRow label="XP required">
          {formatNumber(estimate.xpRequired)}
        </SummaryRow>
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
            label="Training hours"
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
      <p className="text-text-muted mt-5 text-xs leading-5">
        {estimate.finalPriceNote}
      </p>
      <Button asChild className="mt-6 w-full">
        <a href={requestHref}>Request quote</a>
      </Button>
    </aside>
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

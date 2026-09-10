"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Search } from "lucide-react";
import { StoreNumberField } from "@/components/store-number-field";
import {
  AddEstimateToCart,
  MobileEstimateCart,
} from "@/components/add-estimate-to-cart";
import { serviceReferenceIcon } from "@/components/service-reference-icon";
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
  const [skillSearch, setSkillSearch] = useState("");
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
  const [cartSource, setCartSource] = useState<Record<string, unknown> | null>(
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const requestIdRef = useRef(0);
  const [estimateRevision, setEstimateRevision] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!rule || !selectedMethod) return;
    const timeout = window.setTimeout(
      () => formRef.current?.requestSubmit(),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [estimateRevision, rule, selectedMethod]);

  function changeSkill(nextSkillKey: SkillingSkillKey) {
    const nextSkill = skills.find((skill) => skill.skillKey === nextSkillKey);
    setSkillKey(nextSkillKey);
    setMethodSlug(nextSkill?.methods[0]?.slug ?? "");
    setIncludeSupplies(false);
    setResult(null);
  }

  function submit(formData: FormData) {
    const requestId = ++requestIdRef.current;
    setResult(null);
    setCartSource(null);
    const source = {
      serviceId: service.id,
      skillKey,
      methodSlug,
      inputMode,
      currentLevel:
        inputMode === "LEVEL"
          ? Number(formData.get("currentLevel"))
          : undefined,
      targetLevel:
        inputMode === "LEVEL" ? Number(formData.get("targetLevel")) : undefined,
      currentXp:
        inputMode === "XP" ? Number(formData.get("currentXp")) : undefined,
      targetXp:
        inputMode === "XP" ? Number(formData.get("targetXp")) : undefined,
      gameMode: formData.get("gameMode"),
      includeSupplies,
      includeDiscordStream,
      deliverySpeed,
    };
    startTransition(async () => {
      try {
        const response = await fetch("/api/skilling/estimate", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(source),
        });
        const payload = (await response.json()) as EstimateResponse;
        if (requestId !== requestIdRef.current) return;
        setResult(payload);
        setCartSource(payload.ok && payload.estimate ? source : null);
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
    requestIdRef.current += 1;
    setCartSource(null);
    setResult(null);
    setEstimateRevision((v) => v + 1);
  }
  return (
    <div className="reference-skill-layout">
      <div className="reference-skill-left">
        <section className="store-panel">
          <label className="store-search">
            <Search size={18} />
            <input
              aria-label="Search skills"
              placeholder="Search for a skill..."
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
            />
          </label>
          <div className="reference-skill-grid">
            {skills
              .filter((skill) =>
                skill.name.toLowerCase().includes(skillSearch.toLowerCase()),
              )
              .map((skill) => (
                <button
                  key={skill.skillKey}
                  type="button"
                  aria-pressed={skillKey === skill.skillKey}
                  className={skillKey === skill.skillKey ? "is-selected" : ""}
                  onClick={() => {
                    changeSkill(skill.skillKey);
                    invalidate();
                  }}
                >
                  <span
                    className="skill-reference-art"
                    style={serviceReferenceIcon(
                      skill.name,
                      "skill",
                      skill.iconKey,
                    )}
                  />
                  <span>{skill.name}</span>
                </button>
              ))}
          </div>
        </section>
        <section className="store-panel reference-skill-info">
          <h2>Skill Information</h2>
          <div className="reference-selected-skill">
            <span
              className="skill-reference-art"
              style={serviceReferenceIcon(
                selectedSkill?.name ?? "",
                "skill",
                selectedSkill?.iconKey,
              )}
            />
            <div>
              <h3>{selectedSkill?.name}</h3>
              <p>{selectedMethod?.shortDescription}</p>
            </div>
          </div>
          <ul>
            <li>Maximum level: 99</li>
            <li>
              Available methods:{" "}
              {selectedSkill?.methods.map((m) => m.name).join(", ")}
            </li>
            {service.requirements.map((r) => (
              <li key={r.id}>
                <strong>{r.title}</strong> — {r.description}
              </li>
            ))}
          </ul>
          <a href={requestHref}>Need help choosing a method?</a>
        </section>
      </div>
      <form
        ref={formRef}
        className="store-panel reference-skill-config"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        onChangeCapture={invalidate}
      >
        <div className="reference-selected-skill">
          <span
            className="skill-reference-art"
            style={serviceReferenceIcon(
              selectedSkill?.name ?? "",
              "skill",
              selectedSkill?.iconKey,
            )}
          />
          <div>
            <h2>{selectedSkill?.name} Training</h2>
            <p>Choose your levels and training method.</p>
          </div>
        </div>
        {!rule || !skills.length ? (
          <p role="status">Training methods are currently unavailable.</p>
        ) : (
          <>
            <div className="reference-level-settings">
              {inputMode === "LEVEL" ? (
                <>
                  <StoreNumberField
                    label="Current level"
                    name="currentLevel"
                    initial={1}
                    onAdjust={invalidate}
                  />
                  <StoreNumberField
                    label="Target level"
                    name="targetLevel"
                    initial={50}
                    min={2}
                    onAdjust={invalidate}
                  />
                </>
              ) : (
                <>
                  <StoreNumberField
                    label="Current XP"
                    name="currentXp"
                    initial={0}
                    min={0}
                    max={200000000}
                    onAdjust={invalidate}
                  />
                  <StoreNumberField
                    label="Target XP"
                    name="targetXp"
                    initial={101333}
                    max={200000000}
                    onAdjust={invalidate}
                  />
                </>
              )}
              <fieldset className="store-training-type">
                <legend>Training Type</legend>
                {[
                  ["LEVEL", "Level to Level"],
                  ["XP", "Buy XP"],
                ].map(([mode, label]) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="inputMode"
                      checked={inputMode === mode}
                      onChange={() => setInputMode(mode as "LEVEL" | "XP")}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </div>
            <h3 className="reference-method-heading">Select Training Method</h3>
            <div className="reference-training-methods">
              {selectedSkill?.methods.map((method) => (
                <label
                  className={
                    selectedMethod?.slug === method.slug ? "is-selected" : ""
                  }
                  key={method.slug}
                >
                  <span
                    className="skill-reference-art"
                    style={serviceReferenceIcon(
                      selectedSkill.name,
                      "skill",
                      selectedSkill.iconKey,
                    )}
                  />
                  <span>
                    <strong>{method.name}</strong>
                    <p>{method.shortDescription}</p>
                    <small>
                      Levels {method.minimumLevel}–{method.maximumLevel}
                      {method.xpPerHour
                        ? " · " + formatNumber(method.xpPerHour) + " XP/hr"
                        : ""}
                    </small>
                  </span>
                  <input
                    type="radio"
                    name="methodChoice"
                    value={method.slug}
                    checked={selectedMethod?.slug === method.slug}
                    onChange={() => {
                      setMethodSlug(method.slug);
                      setIncludeSupplies(false);
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="store-fields-two">
              <label className="store-field">
                Account game mode
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
                    setDeliverySpeed(e.target.value as SkillingDeliverySpeed)
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
            <div className="store-inline-options">
              {selectedMethod?.suppliesEnabled && (
                <label>
                  <input
                    type="checkbox"
                    checked={includeSupplies}
                    onChange={(e) => setIncludeSupplies(e.target.checked)}
                  />
                  {selectedMethod.suppliesLabel || "Include supplies"}
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
            {result && !result.ok && (
              <p role="alert" className="store-error">
                {result.message}
              </p>
            )}
            <div className="reference-price-footer">
              <div>
                <span>Total Price: </span>
                <strong>
                  {result?.estimate?.estimatedTotal ??
                    (pending ? "Calculating…" : "—")}
                </strong>
                {result?.estimate?.estimatedHours && (
                  <small>
                    Estimated training:{" "}
                    {formatNumber(result.estimate.estimatedHours)} hours
                  </small>
                )}
              </div>
              <AddEstimateToCart kind="SKILLING_ESTIMATE" source={cartSource} />
            </div>
            <details className="store-details">
              <summary>Price breakdown & requirements</summary>
              {result?.estimate?.lineItems.map((line, i) => (
                <p key={i}>
                  {line.label}: {formatCents(line.amountCents)}
                </p>
              ))}
              <p>{result?.estimate?.finalPriceNote}</p>
            </details>
            <MobileEstimateCart
              kind="SKILLING_ESTIMATE"
              source={cartSource}
              total={result?.estimate?.estimatedTotal ?? "—"}
            />
          </>
        )}
      </form>
    </div>
  );
}

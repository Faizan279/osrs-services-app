"use client";

import {
  BookOpenCheck,
  Clock3,
  Search,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AddEstimateToCart } from "@/components/add-estimate-to-cart";
import { ReferenceArt } from "@/components/reference-art";
import {
  calculateDirectOrderEstimate,
  diaryPrerequisiteSlugs,
  facetLabel,
  facetValue,
  formatDirectOrderPrice,
  matchesDirectOrderFilters,
  type DirectOrderOffering,
  type DirectOrderSelection,
} from "@/lib/direct-order/core";

type Mode = "QUESTS" | "DIARIES" | "GATHERING";

type DirectOrderService = {
  id: string;
  name: string;
  shortSummary: string;
  content: string;
  requirements: Array<{
    id: string;
    title: string;
    description: string;
    isRequired: boolean;
    customerGuidance: string | null;
  }>;
  gameModes: Array<{ gameMode: string }>;
  offerings: DirectOrderOffering[];
};

const modeCopy = {
  QUESTS: {
    title: "Quest selector",
    search: "Search quests by name…",
    empty: "No quests match these filters.",
    select: "Select quests",
  },
  DIARIES: {
    title: "Diary selector",
    search: "Search regions or tiers…",
    empty: "No diary packages match these filters.",
    select: "Select diary tiers",
  },
  GATHERING: {
    title: "Gathering services",
    search: "Search gathering services…",
    empty: "No gathering services match this search.",
    select: "Select services",
  },
} as const;

function displayTier(offering: DirectOrderOffering, mode: Mode) {
  if (mode === "QUESTS") {
    return facetLabel(offering, "difficulty") ?? offering.tierLabel;
  }
  return facetLabel(offering, "tier") ?? offering.tierLabel;
}

function offeringGroup(offering: DirectOrderOffering, mode: Mode) {
  if (mode === "DIARIES") {
    return facetLabel(offering, "region") ?? offering.groupLabel ?? "Other";
  }
  return offering.groupLabel ?? "Services";
}

function gatheringArt(name: string): [number, number, number, number] {
  const value = name.toLowerCase();
  if (/fish|karambwan/.test(value)) return [933, 329, 59, 70];
  if (/wood|log/.test(value)) return [47, 532, 61, 67];
  if (/ore|mining/.test(value)) return [268, 532, 60, 67];
  if (/birdhouse/.test(value)) return [490, 329, 61, 70];
  if (/seaweed/.test(value)) return [710, 331, 61, 68];
  if (/flax/.test(value)) return [710, 532, 61, 66];
  if (/chinchompa/.test(value)) return [936, 532, 60, 67];
  if (/herb|fungus/.test(value)) return [45, 330, 62, 69];
  return [267, 329, 61, 69];
}

export function DirectOrderEngine({
  mode,
  service,
}: {
  mode: Mode;
  service: DirectOrderService;
}) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<{
    key: string;
    totalCents?: number;
    error?: string;
  } | null>(null);
  const [gameMode, setGameMode] = useState(
    service.gameModes.some((item) => item.gameMode === "NORMAL")
      ? "NORMAL"
      : (service.gameModes[0]?.gameMode ?? "NORMAL"),
  );
  const copy = modeCopy[mode];

  const filterOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const offering of service.offerings) {
      const key =
        mode === "QUESTS"
          ? (facetValue(offering, "difficulty") ??
            offering.tierLabel?.toLowerCase())
          : mode === "DIARIES"
            ? (facetValue(offering, "tier") ??
              offering.tierLabel?.toLowerCase())
            : (facetValue(offering, "reference-group") ??
              offering.tierLabel?.toLowerCase());
      const label =
        mode === "QUESTS"
          ? (facetLabel(offering, "difficulty") ?? offering.tierLabel)
          : mode === "DIARIES"
            ? (facetLabel(offering, "tier") ?? offering.tierLabel)
            : (facetLabel(offering, "reference-group") ?? offering.tierLabel);
      if (key && label) options.set(key, label);
    }
    return [...options.entries()].map(([value, label]) => ({ value, label }));
  }, [mode, service.offerings]);

  const visibleOfferings = useMemo(() => {
    return service.offerings.filter((offering) =>
      matchesDirectOrderFilters({ offering, search, activeFilter }),
    );
  }, [activeFilter, search, service.offerings]);

  const selections = useMemo<DirectOrderSelection[]>(
    () =>
      Object.entries(selected).map(([slug, quantity]) => ({
        slug,
        quantity: Number(quantity),
      })),
    [selected],
  );
  const calculation = useMemo(() => {
    if (!selections.length) return { estimate: null, error: null };
    try {
      return {
        estimate: calculateDirectOrderEstimate(service.offerings, selections),
        error: null,
      };
    } catch (error) {
      return {
        estimate: null,
        error:
          error instanceof Error ? error.message : "Check your selections.",
      };
    }
  }, [selections, service.offerings]);
  const { estimate } = calculation;

  const selectedOfferings = useMemo(
    () =>
      selections.flatMap((selection) => {
        const offering = service.offerings.find(
          (candidate) => candidate.slug === selection.slug,
        );
        return offering ? [{ offering, selection }] : [];
      }),
    [selections, service.offerings],
  );

  function toggle(offering: DirectOrderOffering) {
    setSelected((current) => {
      if (current[offering.slug] != null) {
        const next = { ...current };
        delete next[offering.slug];
        for (const candidate of service.offerings) {
          if (
            diaryPrerequisiteSlugs(service.offerings, candidate).includes(
              offering.slug,
            )
          ) {
            delete next[candidate.slug];
          }
        }
        return next;
      }
      const next = {
        ...current,
        [offering.slug]: String(
          offering.quantityEnabled
            ? Math.max(1, offering.minimumQuantity ?? 1)
            : 1,
        ),
      };
      if (mode === "DIARIES") {
        for (const slug of diaryPrerequisiteSlugs(
          service.offerings,
          offering,
        )) {
          next[slug] = "1";
        }
      }
      return next;
    });
  }

  function updateQuantity(offering: DirectOrderOffering, value: string) {
    setSelected((current) => ({ ...current, [offering.slug]: value }));
  }

  const cartSource = estimate
    ? {
        serviceId: service.id,
        selections,
        gameMode,
      }
    : null;
  const quoteKey = cartSource ? JSON.stringify(cartSource) : "";
  useEffect(() => {
    if (!quoteKey) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/catalogue/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: quoteKey,
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok)
          throw new Error(payload.message ?? "Price could not be confirmed.");
        if (!controller.signal.aborted)
          setQuote({ key: quoteKey, totalCents: payload.totalCents });
      } catch (error) {
        if (!controller.signal.aborted)
          setQuote({
            key: quoteKey,
            error:
              error instanceof Error
                ? error.message
                : "Price could not be confirmed.",
          });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [quoteKey]);
  const currentQuote = quote?.key === quoteKey ? quote : null;
  const ready = !!estimate && currentQuote?.totalCents != null;
  const displayedTotal = ready
    ? formatDirectOrderPrice(currentQuote.totalCents!)
    : (estimate?.estimatedTotal ?? "$0.00");

  const regionNames = [
    "Ardougne",
    "Desert",
    "Falador",
    "Fremennik",
    "Kandarin",
    "Karamja",
    "Kourend",
    "Lumbridge",
    "Morytania",
    "Varrock",
    "Western",
    "Wilderness",
  ];
  const regionIndex = (name: string) =>
    regionNames.findIndex((region) =>
      name.toLowerCase().startsWith(region.toLowerCase()),
    );
  const regions = [
    ...new Set(visibleOfferings.map((item) => offeringGroup(item, mode))),
  ].sort((a, b) => regionIndex(a) - regionIndex(b));
  const summaryRequirements = selectedOfferings.flatMap(
    ({ offering }) => offering.requirements,
  );
  const orderButton = (
    <AddEstimateToCart
      kind="CATALOGUE_OFFERING_ESTIMATE"
      source={ready ? cartSource : null}
    />
  );
  function requirementList(offering: DirectOrderOffering) {
    return (
      <details className="store-details">
        <summary>Requirements</summary>
        {offering.requirements.map((r) => (
          <p key={r.id}>
            <strong>{r.title}:</strong> {r.description}
          </p>
        ))}
        {!offering.requirements.length && (
          <p>Contact support to confirm requirements.</p>
        )}
      </details>
    );
  }
  return (
    <div
      className={"reference-order-layout reference-order-" + mode.toLowerCase()}
    >
      <section className="store-panel reference-catalogue">
        <div className="reference-filter-row">
          <button
            className={
              "service-filter-chip " +
              (activeFilter === "all" ? "is-active" : "")
            }
            onClick={() => setActiveFilter("all")}
          >
            All
          </button>
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={
                "service-filter-chip " +
                (activeFilter === option.value ? "is-active" : "")
              }
              onClick={() => setActiveFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="reference-catalogue-search">
          <label className="store-search">
            <Search size={18} />
            <input
              placeholder={copy.search}
              aria-label={copy.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="store-field">
            <span className="sr-only">Account mode</span>
            <select
              aria-label="Account mode"
              value={gameMode}
              onChange={(e) => setGameMode(e.target.value)}
            >
              {service.gameModes.map((item) => (
                <option value={item.gameMode} key={item.gameMode}>
                  {item.gameMode.toLowerCase().replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!visibleOfferings.length && (
          <p className="store-empty">{copy.empty}</p>
        )}
        {mode === "QUESTS" && (
          <div className="reference-quest-table-wrap">
            <table className="reference-quest-table">
              <thead>
                <tr>
                  <th>Quest Name</th>
                  <th>Quest Points</th>
                  <th>Difficulty</th>
                  <th>Price</th>
                  <th>ETA</th>
                  <th>Requirements</th>
                  <th>Select</th>
                </tr>
              </thead>
              <tbody>
                {visibleOfferings.map((offering) => (
                  <tr
                    key={offering.slug}
                    className={
                      "direct-order-card " +
                      (selected[offering.slug] != null ? "is-selected" : "")
                    }
                  >
                    <td>
                      <BookOpenCheck size={22} />
                      <strong>{offering.name}</strong>
                    </td>
                    <td data-label="Quest points">
                      {facetLabel(offering, "quest-points") ?? "—"}
                    </td>
                    <td data-label="Difficulty">
                      <span
                        className={
                          "reference-difficulty difficulty-" +
                          (facetValue(offering, "difficulty") ?? "other")
                        }
                      >
                        {displayTier(offering, mode) ?? "Special"}
                      </span>
                    </td>
                    <td data-label="Price">
                      {formatDirectOrderPrice(offering.basePriceCents ?? 0)}
                    </td>
                    <td data-label="ETA">
                      {offering.estimatedDeliveryText ?? "Confirm with support"}
                    </td>
                    <td>{requirementList(offering)}</td>
                    <td>
                      <button
                        className="direct-order-card-main reference-select-button"
                        aria-label={offering.name}
                        aria-pressed={selected[offering.slug] != null}
                        onClick={() => toggle(offering)}
                      >
                        {selected[offering.slug] != null ? "✓" : "+"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {mode === "DIARIES" && (
          <div className="reference-diary-grid">
            {regions.map((region) => {
              const index = Math.max(0, regionIndex(region));
              const tiers = ["easy", "medium", "hard", "elite"];
              const offerings = visibleOfferings
                .filter((item) => offeringGroup(item, mode) === region)
                .sort(
                  (a, b) =>
                    tiers.indexOf((displayTier(a, mode) ?? "").toLowerCase()) -
                    tiers.indexOf((displayTier(b, mode) ?? "").toLowerCase()),
                );
              return (
                <article
                  key={region}
                  className={
                    "reference-diary-card " +
                    (offerings.some((o) => selected[o.slug] != null)
                      ? "is-selected"
                      : "")
                  }
                >
                  <ReferenceArt
                    board="diary"
                    crop={[
                      28 + (index % 4) * 255,
                      258 + Math.floor(index / 4) * 210,
                      244,
                      96,
                    ]}
                    className="reference-diary-art"
                  />
                  <h3>{region}</h3>
                  <div className="reference-diary-tiers">
                    {offerings.map((offering) => (
                      <button
                        className="direct-order-card-main"
                        key={offering.slug}
                        aria-label={offering.name}
                        aria-pressed={selected[offering.slug] != null}
                        onClick={() => toggle(offering)}
                      >
                        <span>
                          {displayTier(offering, mode) ?? offering.name}
                        </span>
                        <small>
                          {formatDirectOrderPrice(offering.basePriceCents ?? 0)}
                        </small>
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {mode === "GATHERING" && (
          <div className="reference-gathering-grid">
            {visibleOfferings.map((offering) => (
              <article
                className={
                  "direct-order-card reference-gathering-card " +
                  (selected[offering.slug] != null ? "is-selected" : "")
                }
                key={offering.slug}
              >
                <ReferenceArt
                  board="gathering"
                  crop={gatheringArt(offering.name)}
                  className="reference-gathering-art"
                />
                <h3>
                  <strong>{offering.name}</strong>
                </h3>
                <p>
                  {offering.quantityEnabled
                    ? (offering.minimumQuantity ?? 1).toLocaleString() +
                      " " +
                      (offering.quantityUnit ?? "units")
                    : offering.pricingUnit}
                </p>
                <strong className="store-price">
                  {formatDirectOrderPrice(offering.basePriceCents ?? 0)}
                </strong>
                <small>
                  <Clock3 size={13} />{" "}
                  {offering.estimatedDeliveryText ??
                    "Timing confirmed after review"}
                </small>
                <button
                  className="direct-order-card-main reference-primary-button"
                  aria-pressed={selected[offering.slug] != null}
                  onClick={() => toggle(offering)}
                >
                  {selected[offering.slug] != null
                    ? "Selected ✓"
                    : "Select Service"}
                </button>
                {selected[offering.slug] != null &&
                  offering.quantityEnabled && (
                    <label className="store-field">
                      Amount
                      <input
                        type="number"
                        min={offering.minimumQuantity ?? 1}
                        max={offering.maximumQuantity ?? undefined}
                        value={selected[offering.slug]}
                        onChange={(e) =>
                          updateQuantity(offering, e.target.value)
                        }
                      />
                    </label>
                  )}
                {requirementList(offering)}
              </article>
            ))}
          </div>
        )}
      </section>
      <aside className="reference-order-side">
        <section className="store-panel">
          <h2>
            <ShoppingCart size={23} />{" "}
            {mode === "QUESTS" ? "Quest Calculator" : "Order Summary"}
          </h2>
          <dl className="reference-summary-lines">
            <div>
              <dt>Selected {mode === "QUESTS" ? "quests" : "services"}</dt>
              <dd>{selectedOfferings.length}</dd>
            </div>
            {mode === "QUESTS" && (
              <div>
                <dt>Quest points</dt>
                <dd>
                  {selectedOfferings.reduce(
                    (sum, { offering }) =>
                      sum + Number(facetLabel(offering, "quest-points") || 0),
                    0,
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>Account type</dt>
              <dd>{gameMode.toLowerCase().replaceAll("_", " ")}</dd>
            </div>
          </dl>
          <div className="reference-selections">
            {selectedOfferings.map(({ offering, selection }) => (
              <div key={offering.slug}>
                <span>
                  {offering.name}
                  {offering.quantityEnabled ? " × " + selection.quantity : ""}
                </span>
                <button
                  aria-label={"Remove " + offering.name}
                  onClick={() => toggle(offering)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {calculation.error && (
            <p role="alert" className="store-error">
              {calculation.error}
            </p>
          )}
          {currentQuote?.error && (
            <p role="alert" className="store-error">
              {currentQuote.error}
            </p>
          )}
          <div className="reference-total">
            <span>Total Price:</span>
            <strong>{displayedTotal}</strong>
          </div>
          {orderButton}
          {!!estimate && !ready && !currentQuote?.error && (
            <p role="status">Confirming price…</p>
          )}
        </section>
        <section className="store-panel">
          <h2>
            <ShieldCheck size={22} /> Requirements & Information
          </h2>
          {mode === "DIARIES" && (
            <p>
              Earlier tiers must already be complete unless the selected package
              automatically includes them.
            </p>
          )}
          {selectedOfferings.map(({ offering }) => (
            <div key={offering.slug}>
              <h3>{offering.name}</h3>
              <p>
                ETA:{" "}
                {offering.estimatedDeliveryText ?? "Confirmed after review"}
              </p>
            </div>
          ))}
          {summaryRequirements.slice(0, 12).map((r, i) => (
            <p key={i}>
              ✓ {r.title}: {r.description}
            </p>
          ))}
          {!summaryRequirements.length && (
            <p>
              Select a service to view its requirements and delivery
              information.
            </p>
          )}
        </section>
      </aside>
      {selectedOfferings.length > 0 && (
        <div className="service-mobile-checkout-bar">
          <strong>{displayedTotal}</strong>
          {orderButton}
        </div>
      )}
    </div>
  );
}

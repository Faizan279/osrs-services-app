"use client";

import {
  BookOpenCheck,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  Leaf,
  MapPinned,
  Search,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AddEstimateToCart } from "@/components/add-estimate-to-cart";
import { Badge } from "@/components/ui/badge";
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

function difficultyTone(value: string | null) {
  if (value === "grandmaster") return "danger" as const;
  if (value === "master") return "warning" as const;
  if (value === "experienced") return "info" as const;
  if (value === "novice") return "success" as const;
  return "neutral" as const;
}

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

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <section className="service-order-layout">
        <div className="service-catalogue-panel">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-primary kicker-type">{copy.select}</p>
              <h2 className="display-type mt-2 text-3xl uppercase">
                {copy.title}
              </h2>
            </div>
            <p className="text-text-muted text-sm">
              {service.offerings.length.toLocaleString()} available options
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <span className="sr-only">{copy.search}</span>
              <Search
                className="text-text-muted absolute top-1/2 left-4 size-5 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                className="service-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.search}
              />
            </label>
            <div className="text-text-muted flex items-center gap-2 text-xs font-bold">
              <Filter className="size-4" aria-hidden="true" />
              Fast client-side filtering
            </div>
          </div>
          {service.gameModes.length > 1 ? (
            <label className="mt-4 block max-w-xs text-xs font-bold">
              Account mode
              <select
                className="service-number-input mt-2"
                value={gameMode}
                onChange={(event) => setGameMode(event.target.value)}
              >
                {service.gameModes.map((item) => (
                  <option value={item.gameMode} key={item.gameMode}>
                    {item.gameMode
                      .toLowerCase()
                      .split("_")
                      .map((part) => part[0]?.toUpperCase() + part.slice(1))
                      .join(" ")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {filterOptions.length ? (
            <div
              className="mt-4 flex gap-2 overflow-x-auto pb-2"
              aria-label="Filters"
            >
              <button
                className={`service-filter-chip ${activeFilter === "all" ? "is-active" : ""}`}
                type="button"
                onClick={() => setActiveFilter("all")}
              >
                All
              </button>
              {filterOptions.map((option) => (
                <button
                  className={`service-filter-chip ${activeFilter === option.value ? "is-active" : ""}`}
                  key={option.value}
                  type="button"
                  onClick={() => setActiveFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {visibleOfferings.length ? (
            <div
              className={`mt-5 ${mode === "QUESTS" ? "quest-order-list" : "direct-order-grid"}`}
            >
              {visibleOfferings.map((offering) => {
                const isSelected = selected[offering.slug] != null;
                const tier = displayTier(offering, mode);
                const difficulty = facetValue(offering, "difficulty");
                const questPoints = facetLabel(offering, "quest-points");
                const GroupIcon =
                  mode === "QUESTS"
                    ? BookOpenCheck
                    : mode === "DIARIES"
                      ? MapPinned
                      : Leaf;
                return (
                  <article
                    className={`direct-order-card ${isSelected ? "is-selected" : ""}`}
                    key={offering.slug}
                  >
                    <button
                      className="direct-order-card-main"
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggle(offering)}
                    >
                      <span className="direct-order-card-icon">
                        <GroupIcon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="flex flex-wrap items-center gap-2">
                          <strong className="break-words">
                            {offering.name}
                          </strong>
                          {tier ? (
                            <Badge variant={difficultyTone(difficulty)}>
                              {tier}
                            </Badge>
                          ) : null}
                          {questPoints ? (
                            <Badge variant="info">{questPoints} QP</Badge>
                          ) : null}
                        </span>
                        <span className="text-text-secondary mt-1 line-clamp-2 text-xs leading-5">
                          {offering.shortSummary}
                        </span>
                        <span className="text-text-muted mt-2 block text-[0.7rem] font-bold uppercase">
                          {offeringGroup(offering, mode)}
                        </span>
                        <span className="text-text-muted mt-1 block text-[0.7rem]">
                          ETA:{" "}
                          {offering.estimatedDeliveryText ??
                            "Confirmed after review"}
                        </span>
                      </span>
                      <span className="text-right">
                        <strong className="text-primary block text-lg">
                          {formatDirectOrderPrice(offering.basePriceCents ?? 0)}
                        </strong>
                        <span className="text-text-muted text-[0.65rem]">
                          {offering.pricingUnit ?? "configured service"}
                        </span>
                      </span>
                      <span className="direct-order-check" aria-hidden="true">
                        {isSelected ? <Check className="size-4" /> : "+"}
                      </span>
                    </button>
                    {isSelected && offering.quantityEnabled ? (
                      <label className="border-border mt-3 grid gap-2 border-t pt-3 text-xs font-bold">
                        Amount ({offering.quantityUnit ?? "units"})
                        <input
                          className="service-number-input"
                          type="number"
                          min={offering.minimumQuantity ?? 1}
                          max={offering.maximumQuantity ?? undefined}
                          step={offering.minimumQuantity ?? 1}
                          value={selected[offering.slug]}
                          onChange={(event) =>
                            updateQuantity(offering, event.target.value)
                          }
                        />
                      </label>
                    ) : null}
                    {offering.requirements.length ? (
                      <details className="direct-order-requirements">
                        <summary>
                          Requirements{" "}
                          <ChevronDown className="size-4" aria-hidden="true" />
                        </summary>
                        <ul>
                          {offering.requirements.map((requirement) => (
                            <li key={requirement.id}>
                              <ShieldCheck
                                className="text-success size-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                <strong>{requirement.title}:</strong>{" "}
                                {requirement.description}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border-border bg-background/40 text-text-secondary mt-5 rounded-xl border p-8 text-center">
              {copy.empty}
            </div>
          )}
        </div>

        <aside className="service-order-summary" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="service-summary-icon">
              <ShoppingCart className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-primary kicker-type">Order summary</p>
              <h2 className="font-black">
                {mode === "QUESTS"
                  ? "Selected quests"
                  : mode === "DIARIES"
                    ? "Selected diary tiers"
                    : "Gathering order"}
              </h2>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Selected</dt>
              <dd className="font-bold">{selectedOfferings.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Account</dt>
              <dd className="font-bold">
                {gameMode
                  .toLowerCase()
                  .split("_")
                  .map((part) => part[0]?.toUpperCase() + part.slice(1))
                  .join(" ")}
              </dd>
            </div>
            {mode === "QUESTS" ? (
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Quest points</dt>
                <dd className="font-bold">
                  {selectedOfferings.reduce(
                    (total, { offering }) =>
                      total + Number(facetValue(offering, "quest-points") ?? 0),
                    0,
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="service-summary-selection mt-5">
            {selectedOfferings.length ? (
              <ul>
                {selectedOfferings
                  .slice(0, 8)
                  .map(({ offering, selection }) => (
                    <li key={offering.slug}>
                      <span>{offering.name}</span>
                      <strong>
                        {offering.quantityEnabled
                          ? selection.quantity?.toLocaleString()
                          : formatDirectOrderPrice(
                              offering.basePriceCents ?? 0,
                            )}
                      </strong>
                    </li>
                  ))}
                {selectedOfferings.length > 8 ? (
                  <li className="text-text-muted">
                    +{selectedOfferings.length - 8} more selected
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="text-text-secondary text-sm leading-6">
                Choose one or more options to see the total instantly.
              </p>
            )}
          </div>
          {mode === "DIARIES" ? (
            <div className="border-warning/30 bg-warning/10 text-text-secondary mt-4 rounded-lg border p-3 text-xs leading-5">
              {service.offerings.some(
                (offering) =>
                  facetValue(offering, "dependency-behavior") ===
                  "auto-include",
              )
                ? "Configured rule: selecting a tier automatically includes its earlier regional tiers."
                : "Configured rule: earlier tiers must already be complete unless they are also selected. Staff verifies dependencies before work starts."}
            </div>
          ) : null}
          <div className="border-border mt-5 border-t pt-5">
            <div className="flex items-end justify-between gap-4">
              <span className="font-black">Total price</span>
              <strong className="display-type text-primary text-3xl">
                {displayedTotal}
              </strong>
            </div>
            <p className="text-text-muted mt-2 flex items-center gap-2 text-xs">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Completion time depends on your selected services.
            </p>
            {estimate && !ready && !currentQuote?.error ? (
              <p className="text-text-muted mt-2 text-xs">
                Updating final price…
              </p>
            ) : null}
            {calculation.error || currentQuote?.error ? (
              <p role="alert" className="text-danger mt-2 text-sm">
                {calculation.error ?? currentQuote?.error}
              </p>
            ) : null}
          </div>
          <div className="mt-5">
            <AddEstimateToCart
              kind="CATALOGUE_OFFERING_ESTIMATE"
              source={cartSource}
              disabled={!ready}
            />
          </div>
        </aside>
      </section>
      {estimate && cartSource ? (
        <div className="service-mobile-checkout-bar">
          <div>
            <span className="text-text-muted block text-[0.65rem] font-bold uppercase">
              {selectedOfferings.length} selected
            </span>
            <strong className="text-primary text-xl">{displayedTotal}</strong>
          </div>
          <AddEstimateToCart
            kind="CATALOGUE_OFFERING_ESTIMATE"
            source={cartSource}
            disabled={!ready}
          />
        </div>
      ) : null}
    </div>
  );
}

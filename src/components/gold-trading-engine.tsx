"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ReferenceArt } from "@/components/reference-art";
import {
  AddEstimateToCart,
  MobileEstimateCart,
} from "@/components/add-estimate-to-cart";
import {
  goldAvailabilityLabels,
  goldTradeDirectionDescriptions,
  goldTradeDirectionLabels,
} from "@/lib/gold/constants";
import {
  formatGoldQuantity,
  calculateRateMinorUnits,
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
  const [cartSource, setCartSource] = useState<Record<string, unknown> | null>(
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const requestIdRef = useRef(0);
  const [estimateRevision, setEstimateRevision] = useState(0);
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

  useEffect(() => {
    if (!activeRate || (!presetId && !customQuantity.trim())) return;
    const timeout = window.setTimeout(
      () => formRef.current?.requestSubmit(),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [activeRate, customQuantity, estimateRevision, presetId]);

  function switchDirection(next: GoldTradeDirection) {
    setDirection(next);
    setPresetId("");
    setCustomQuantity("");
    setSecureServiceSelected(false);
    setResult(null);
  }

  function submit(formData: FormData) {
    const requestId = ++requestIdRef.current;
    setResult(null);
    setCartSource(null);
    const source = {
      serviceId: service.id,
      marketId: market.id,
      direction,
      presetId: presetId || undefined,
      quantity: presetId ? "1" : customQuantity,
      secureServiceSelected,
      rsn: market.rsnRequired
        ? String(formData.get("rsn") ?? "").trim()
        : undefined,
    };
    startTransition(async () => {
      try {
        const response = await fetch("/api/gold/estimate", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...source,
            rsn: market.rsnRequired
              ? String(formData.get("rsn") ?? "").trim()
              : undefined,
          }),
        });
        const payload = (await response.json()) as EstimateResponse;
        if (requestId !== requestIdRef.current) return;
        setResult(payload);
        setCartSource(
          payload.ok &&
            payload.estimate &&
            direction === "CUSTOMER_BUYS_GOLD" &&
            !payload.estimate.manualReviewRequired &&
            ["AVAILABLE", "LIMITED_AVAILABILITY"].includes(
              payload.estimate.availabilityState,
            )
            ? source
            : null,
        );
      } catch {
        if (requestId !== requestIdRef.current) return;
        setResult({
          ok: false,
          message: "The gold estimate could not be calculated.",
        });
      }
    });
  }

  function invalidate() {
    requestIdRef.current++;
    setCartSource(null);
    setResult(null);
    setEstimateRevision((v) => v + 1);
  }
  return (
    <div className="reference-order-layout reference-gold-layout">
      <form
        ref={formRef}
        className="reference-gold-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        onChangeCapture={invalidate}
      >
        {!featureEnabled || !latestRevision ? (
          <section className="store-panel">
            <p role="status">
              Gold trading is currently in review mode. Contact our team for
              availability.
            </p>
          </section>
        ) : (
          <>
            <div
              className="reference-filter-row"
              role="tablist"
              aria-label="Gold trade direction"
            >
              {directions.map((item) => (
                <button
                  type="button"
                  role="tab"
                  key={item}
                  aria-selected={direction === item}
                  className={
                    "service-filter-chip " +
                    (direction === item ? "is-active" : "")
                  }
                  onClick={() => {
                    switchDirection(item);
                    invalidate();
                  }}
                >
                  {goldTradeDirectionLabels[item]}
                </button>
              ))}
            </div>
            <div className="reference-gold-packs">
              {directionPresets.map((preset, i) => (
                <label
                  className={presetId === preset.id ? "is-selected" : ""}
                  key={preset.id}
                >
                  <ReferenceArt
                    board="gold"
                    crop={[50 + Math.min(i, 5) * 177, 280, 115, 95]}
                    className="reference-gold-coins"
                  />
                  <strong>{preset.publicLabel}</strong>
                  <small>{preset.quantityLabel}</small>
                  {activeRate && (
                    <>
                      <span className="store-price">
                        {formatCents(
                          calculateRateMinorUnits({
                            rateMinorUnitsPerMillion:
                              activeRate.rateMinorUnitsPerMillion,
                            quantityGp: preset.quantityGp,
                          }),
                          market.currencyCode,
                        )}
                      </span>
                      <small>
                        {formatCents(
                          activeRate.rateMinorUnitsPerMillion,
                          market.currencyCode,
                        )}{" "}
                        / M · base price
                      </small>
                    </>
                  )}
                  <input
                    type="radio"
                    name="presetId"
                    checked={presetId === preset.id}
                    onChange={() => {
                      setPresetId(preset.id);
                      setCustomQuantity("");
                    }}
                  />
                </label>
              ))}
            </div>
            <section className="store-panel reference-gold-custom">
              <h2>Custom Amount</h2>
              <label className="store-inline-options">
                <input
                  type="radio"
                  name="presetId"
                  checked={!presetId}
                  onChange={() => setPresetId("")}
                />{" "}
                Custom quantity
              </label>
              <div className="store-fields-two">
                <label className="store-field">
                  Custom quantity in millions of GP
                  <input
                    name="quantity"
                    placeholder="Enter amount"
                    value={customQuantity}
                    onChange={(e) => {
                      setPresetId("");
                      setCustomQuantity(e.target.value);
                    }}
                    disabled={Boolean(presetId)}
                  />
                </label>
                {market.rsnRequired && (
                  <label className="store-field">
                    RuneScape name
                    <input
                      name="rsn"
                      maxLength={12}
                      required
                      autoComplete="off"
                      placeholder="Your in-game name"
                    />
                  </label>
                )}
              </div>
              {activeRate && (
                <dl className="reference-summary-lines mt-4">
                  <div>
                    <dt>Price per million</dt>
                    <dd>
                      {formatCents(
                        activeRate.rateMinorUnitsPerMillion,
                        market.currencyCode,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Minimum order</dt>
                    <dd>{formatGoldQuantity(activeRate.minimumQuantityGp)}</dd>
                  </div>
                  <div>
                    <dt>Maximum order</dt>
                    <dd>{formatGoldQuantity(activeRate.maximumQuantityGp)}</dd>
                  </div>
                </dl>
              )}
              {secureAvailable && (
                <label className="store-inline-options">
                  <input
                    type="checkbox"
                    checked={secureServiceSelected}
                    onChange={(e) => setSecureServiceSelected(e.target.checked)}
                  />
                  Secure 100+ Combat Service
                </label>
              )}
              {pending && <p role="status">Updating price…</p>}
            </section>
          </>
        )}
        <section className="store-panel">
          <h2>Delivery Information</h2>
          <p>{market.publicTradeInstructions}</p>
          {service.requirements.map((r) => (
            <p key={r.id}>
              ✓ {r.title}: {r.description}
            </p>
          ))}
        </section>
      </form>
      <aside className="reference-order-side">
        <section className="store-panel">
          <h2>Order Summary</h2>
          {result && !result.ok && (
            <p role="alert" className="store-error">
              {result.message}
            </p>
          )}
          <dl className="reference-summary-lines">
            <div>
              <dt>Selected amount</dt>
              <dd>{result?.estimate?.quantityLabel ?? "Choose an amount"}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>
                {
                  goldAvailabilityLabels[
                    result?.estimate?.availabilityState ??
                      market.availabilityState
                  ]
                }
              </dd>
            </div>
          </dl>
          <div className="reference-total">
            <span>Total Price:</span>
            <strong>{result?.estimate?.estimatedTotal ?? "—"}</strong>
          </div>
          {result?.estimate?.manualReviewRequired && (
            <p role="status">
              Manual review is required for this amount before the trade.
            </p>
          )}
          <AddEstimateToCart
            kind="GOLD_BUY_ESTIMATE"
            source={cartSource}
            label="Buy gold · Add to cart"
          />
          {result?.estimate && (
            <details className="store-details">
              <summary>Price breakdown</summary>
              {result.estimate.lineItems.map((line, i) => (
                <p key={i}>
                  {line.label}: {formatCents(line.amountCents)}
                </p>
              ))}
              <p>
                {result.estimate.availabilityMessage}{" "}
                {result.estimate.finalPriceNote}
              </p>
            </details>
          )}
        </section>
        <section className="store-panel">
          <h2>Important Information</h2>
          <p>{goldTradeDirectionDescriptions[direction]}</p>
          <p>
            Never share your account password, bank PIN or authenticator code
            for a gold trade.
          </p>
          <p>
            Rates and availability are checked again when ordering. A preview
            does not reserve stock.
          </p>
          <a
            className="reference-secondary-button mt-4 w-full"
            href={requestHref}
          >
            Contact our team
          </a>
        </section>
      </aside>
      <MobileEstimateCart
        kind="GOLD_BUY_ESTIMATE"
        source={cartSource}
        total={result?.estimate?.estimatedTotal ?? "—"}
      />
    </div>
  );
}

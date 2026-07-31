"use client";

import { Calculator, ShoppingCart } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { PublicProductVariantSnapshot } from "@/lib/products/estimate";
import { productPriceModeLabels } from "@/lib/products/constants";

type EstimatePayload = {
  state: string;
  quantityLabel: string;
  estimatedTotal: string | null;
  lineItems: Array<{ label: string; amountCents: number }>;
  globalPricingLines: Array<{ label: string; amountCents: number }>;
  availabilityMessage: string;
  finalPriceNote: string;
  estimateCreatesReservation: false;
};

function formatCents(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}

export function ProductEstimatePanel({
  productSlug,
  variants,
}: {
  productSlug: string;
  variants: PublicProductVariantSnapshot[];
}) {
  const sortedVariants = useMemo(
    () =>
      [...variants]
        .filter((variant) => variant.enabled)
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }
          return left.publicName.localeCompare(right.publicName);
        }),
    [variants],
  );
  const [variantStableKey, setVariantStableKey] = useState(
    sortedVariants[0]?.stableKey ?? "",
  );
  const selectedVariant =
    sortedVariants.find((variant) => variant.stableKey === variantStableKey) ??
    sortedVariants[0];
  const [quantity, setQuantity] = useState(
    selectedVariant?.minimumQuantity ?? "1",
  );
  const [estimate, setEstimate] = useState<EstimatePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCartPending, startCartTransition] = useTransition();

  function submitEstimate() {
    setError(null);
    setCartMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/products/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug,
          variantStableKey,
          quantity,
        }),
      });
      const payload = (await response.json()) as
        | { ok: true; estimate: EstimatePayload }
        | { ok: false; message: string };
      if (!response.ok || !payload.ok) {
        setEstimate(null);
        setError(
          payload.ok
            ? "The estimate could not be calculated."
            : payload.message,
        );
        return;
      }
      setEstimate(payload.estimate);
    });
  }

  function addToCart() {
    setCartMessage(null);
    startCartTransition(async () => {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "PRODUCT_ESTIMATE",
          source: {
            productSlug,
            variantStableKey,
            quantity,
          },
          quantity,
          idempotencyKey: `product-${productSlug}-${variantStableKey}-${quantity}-${crypto.randomUUID()}`,
        }),
      });
      const payload = (await response.json()) as
        { ok: true } | { ok: false; message: string };
      if (!response.ok || !payload.ok) {
        setCartMessage(
          payload.ok ? "Item could not be added." : payload.message,
        );
        return;
      }
      setCartMessage("Added to cart.");
    });
  }

  if (!selectedVariant) {
    return (
      <div className="border-warning/30 bg-warning/10 rounded-xl border p-5">
        No public variants are available for estimates.
      </div>
    );
  }

  return (
    <section
      className="border-gold/25 bg-gold/5 rounded-2xl border p-5"
      aria-labelledby="product-estimate-heading"
    >
      <div className="flex items-center gap-2">
        <Calculator className="text-gold size-5" aria-hidden="true" />
        <h2 id="product-estimate-heading" className="font-bold">
          Price estimate
        </h2>
      </div>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Variant
          <select
            className="border-border bg-background min-h-11 rounded-xl border px-3"
            value={variantStableKey}
            onChange={(event) => {
              const next = event.target.value;
              const nextVariant = sortedVariants.find(
                (variant) => variant.stableKey === next,
              );
              setVariantStableKey(next);
              setQuantity(nextVariant?.minimumQuantity ?? "1");
              setEstimate(null);
              setError(null);
            }}
          >
            {sortedVariants.map((variant) => (
              <option key={variant.stableKey} value={variant.stableKey}>
                {variant.publicName} -{" "}
                {productPriceModeLabels[variant.priceMode]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Quantity
          <input
            className="border-border bg-background min-h-11 rounded-xl border px-3"
            aria-describedby="quantity-help quantity-error"
            inputMode="numeric"
            min={selectedVariant.minimumQuantity}
            max={selectedVariant.maximumQuantity}
            step={selectedVariant.quantityIncrement}
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <p id="quantity-help" className="text-text-muted text-xs">
          Minimum {selectedVariant.minimumQuantity}, maximum{" "}
          {selectedVariant.maximumQuantity}, increment{" "}
          {selectedVariant.quantityIncrement}. Estimates do not reserve stock.
        </p>
        {error && (
          <p id="quantity-error" className="text-danger text-sm" role="alert">
            {error}
          </p>
        )}
        <Button type="button" onClick={submitEstimate} disabled={isPending}>
          {isPending ? "Estimating" : "Calculate estimate"}
        </Button>
      </div>
      <div className="mt-5" aria-live="polite">
        {estimate ? (
          <div className="space-y-4">
            <div>
              <p className="text-text-muted text-xs font-bold uppercase">
                Estimated total
              </p>
              <p className="display-type mt-1 text-3xl">
                {estimate.estimatedTotal ?? "Manual review required"}
              </p>
            </div>
            <p className="text-text-secondary text-sm">
              {estimate.availabilityMessage}
            </p>
            {estimate.lineItems.length > 0 && (
              <ul className="divide-border divide-y text-sm">
                {estimate.lineItems.map((line) => (
                  <li
                    className="flex justify-between gap-3 py-2"
                    key={`${line.label}:${line.amountCents}`}
                  >
                    <span>{line.label}</span>
                    <strong>{formatCents(line.amountCents)}</strong>
                  </li>
                ))}
              </ul>
            )}
            {estimate.globalPricingLines.length > 0 && (
              <p className="text-primary text-sm font-semibold">
                Global pricing adjustments are included above.
              </p>
            )}
            <p className="text-text-muted text-xs">{estimate.finalPriceNote}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={addToCart}
              disabled={isCartPending || estimate.estimatedTotal == null}
            >
              <ShoppingCart className="size-4" aria-hidden="true" />
              {isCartPending ? "Adding" : "Add to cart"}
            </Button>
            {cartMessage && (
              <p
                className="text-text-secondary text-sm font-semibold"
                role="status"
              >
                {cartMessage}
              </p>
            )}
          </div>
        ) : (
          <p className="text-text-muted text-sm">
            Choose a variant and quantity to calculate a server-authoritative
            preview estimate.
          </p>
        )}
      </div>
    </section>
  );
}

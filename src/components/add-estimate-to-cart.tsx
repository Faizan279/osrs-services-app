"use client";

import { Check, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export type CartKind =
  | "SKILLING_ESTIMATE"
  | "BOSSING_ESTIMATE"
  | "PREMIUM_ESTIMATE"
  | "GOLD_BUY_ESTIMATE"
  | "CATALOGUE_OFFERING_ESTIMATE";

export function AddEstimateToCart({
  kind,
  source,
  disabled = false,
  label = "Add to cart",
}: {
  kind: CartKind;
  source: Record<string, unknown> | null;
  disabled?: boolean;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [addedSource, setAddedSource] = useState<string | null>(null);
  const sourceKey = JSON.stringify({ kind, source });
  const added = addedSource === sourceKey;
  const [message, setMessage] = useState<string | null>(null);

  function add() {
    if (!source) return;
    setMessage(null);
    setAddedSource(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/cart/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            source,
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok: boolean;
          message?: string;
        } | null;
        if (!response.ok || !payload?.ok) {
          setMessage(
            payload?.message ?? "This configuration could not be added.",
          );
          return;
        }
        setAddedSource(sourceKey);
      } catch {
        setMessage("This configuration could not be added. Please try again.");
      }
    });
  }

  return (
    <div className="grid gap-2" aria-live="polite">
      {added ? (
        <Button asChild className="w-full">
          <Link href="/cart" prefetch={false}>
            <Check className="size-4" aria-hidden="true" />
            Added · View cart
          </Link>
        </Button>
      ) : (
        <Button
          className="w-full"
          type="button"
          disabled={disabled || pending || !source}
          onClick={add}
        >
          <ShoppingCart className="size-4" aria-hidden="true" />
          {pending ? "Adding…" : label}
        </Button>
      )}
      {message ? <p className="text-danger text-xs">{message}</p> : null}
    </div>
  );
}

export function MobileEstimateCart({
  kind,
  source,
  total,
}: {
  kind: CartKind;
  source: Record<string, unknown> | null;
  total: string;
}) {
  if (!source) return null;
  return (
    <div className="service-mobile-checkout-bar">
      <div>
        <span className="text-text-muted block text-[0.65rem] font-bold uppercase">
          Total price
        </span>
        <strong className="text-primary text-xl">{total}</strong>
      </div>
      <AddEstimateToCart kind={kind} source={source} />
    </div>
  );
}

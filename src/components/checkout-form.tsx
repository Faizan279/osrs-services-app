"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PaymentMethod = {
  stableKey: string;
  publicName: string;
  publicDescription: string;
};

type CheckoutResult =
  | {
      ok: true;
      order: {
        orderNumber: string;
        trackingUrl: string | null;
        paymentReviewMessage: string;
      };
      idempotent: boolean;
    }
  | {
      ok: true;
      repriceRequired: true;
      cart: { warnings: string[] };
    }
  | { ok: false; message: string };

export function CheckoutForm({
  paymentMethods,
  disabled,
}: {
  paymentMethods: PaymentMethod[];
  disabled: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => {
    const random =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `checkout-${random}`;
  });
  const [isPending, startTransition] = useTransition();
  const firstPaymentMethod = paymentMethods[0]?.stableKey ?? "";

  function onSubmit(formData: FormData) {
    setMessage(null);
    setTrackingUrl(null);
    startTransition(async () => {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          contact: {
            displayName: formData.get("displayName"),
            email: formData.get("email"),
            discordUsername: formData.get("discordUsername"),
            rsn: formData.get("rsn"),
          },
          paymentMethodStableKey:
            String(formData.get("paymentMethodStableKey") ?? "") ||
            firstPaymentMethod,
          termsAccepted: formData.get("termsAccepted") === "on",
          privacyAccepted: formData.get("privacyAccepted") === "on",
          acceptedUpdatedTotals: formData.get("acceptedUpdatedTotals") === "on",
          serviceDetails: {
            safeServiceNotes: formData.get("safeServiceNotes"),
          },
        }),
      });
      const payload = (await response.json()) as CheckoutResult;
      if (!payload.ok) {
        setMessage(payload.message);
        return;
      }
      if ("repriceRequired" in payload) {
        setMessage(
          payload.cart.warnings[0] ??
            "Review the updated cart total before checkout.",
        );
        return;
      }
      setMessage(
        `${payload.order.orderNumber} created. ${payload.order.paymentReviewMessage}`,
      );
      setTrackingUrl(payload.order.trackingUrl);
    });
  }

  return (
    <form
      action={onSubmit}
      className="grid gap-5"
      aria-describedby="checkout-state"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Display name
          <Input
            name="displayName"
            required
            maxLength={120}
            disabled={disabled}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Email
          <Input
            name="email"
            type="email"
            required
            maxLength={191}
            disabled={disabled}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Discord username
          <Input name="discordUsername" maxLength={80} disabled={disabled} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          RSN / game ID
          <Input name="rsn" maxLength={12} disabled={disabled} />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold">
        Safe service notes
        <textarea
          name="safeServiceNotes"
          maxLength={500}
          disabled={disabled}
          className="border-border-strong/70 bg-background/35 text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-primary/20 min-h-28 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 disabled:opacity-50"
        />
      </label>

      <fieldset className="border-border bg-surface-2/55 rounded-xl border p-4">
        <legend className="px-2 text-sm font-bold">Payment review</legend>
        <div className="mt-3 grid gap-3">
          {paymentMethods.map((method, index) => (
            <label
              key={method.stableKey}
              className="border-border bg-background/35 flex gap-3 rounded-xl border p-3 text-sm"
            >
              <input
                type="radio"
                name="paymentMethodStableKey"
                value={method.stableKey}
                defaultChecked={index === 0}
                disabled={disabled}
              />
              <span>
                <strong className="block">{method.publicName}</strong>
                <span className="text-text-muted">
                  {method.publicDescription}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3">
        <label className="flex gap-3 text-sm">
          <input
            name="acceptedUpdatedTotals"
            type="checkbox"
            disabled={disabled}
          />
          <span>I reviewed the current cart total.</span>
        </label>
        <label className="flex gap-3 text-sm">
          <input
            name="termsAccepted"
            type="checkbox"
            required
            disabled={disabled}
          />
          <span>I accept the current terms version.</span>
        </label>
        <label className="flex gap-3 text-sm">
          <input
            name="privacyAccepted"
            type="checkbox"
            required
            disabled={disabled}
          />
          <span>I consent to the privacy policy for this guest order.</span>
        </label>
      </div>

      <Button type="submit" disabled={disabled || isPending}>
        <ShieldCheck className="size-4" aria-hidden="true" />
        {isPending ? "Creating order" : "Submit for review"}
      </Button>

      <div id="checkout-state" aria-live="polite">
        {message && (
          <div className="border-primary/30 bg-primary/10 rounded-xl border p-4 text-sm">
            <CheckCircle2
              className="text-primary mr-2 inline size-4"
              aria-hidden="true"
            />
            {message}
            {trackingUrl && (
              <a className="text-primary ml-2 font-bold" href={trackingUrl}>
                Open tracking
              </a>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

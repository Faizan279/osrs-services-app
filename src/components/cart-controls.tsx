"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CartControlItem = {
  id: string;
  kind: string;
  quantity: string;
};

function canUpdateQuantity(kind: string) {
  return kind === "PRODUCT_ESTIMATE" || kind === "GOLD_BUY_ESTIMATE";
}

export function CartItemControls({ item }: { item: CartControlItem }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(item.quantity);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function mutate(request: () => Promise<Response>, fallbackMessage: string) {
    setMessage(null);
    startTransition(async () => {
      const response = await request();
      const payload = (await response.json().catch(() => null)) as {
        ok: boolean;
        message?: string;
      } | null;
      if (!response.ok || !payload?.ok) {
        setMessage(payload?.message ?? fallbackMessage);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-4 grid gap-3" aria-live="polite">
      <div className="flex flex-wrap items-end gap-3">
        {canUpdateQuantity(item.kind) && (
          <label className="grid max-w-36 gap-1 text-xs font-semibold">
            Quantity
            <Input
              type="number"
              min="1"
              value={quantity}
              disabled={isPending}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
        )}
        {canUpdateQuantity(item.kind) && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() =>
              mutate(
                () =>
                  fetch(`/api/cart/items/${item.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ quantity }),
                  }),
                "Quantity could not be updated.",
              )
            }
          >
            Update
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() =>
            mutate(
              () => fetch(`/api/cart/items/${item.id}`, { method: "DELETE" }),
              "Item could not be removed.",
            )
          }
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Remove
        </Button>
      </div>
      {message && <p className="text-danger text-xs">{message}</p>}
    </div>
  );
}

export function CartRevalidateButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function revalidate() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/cart/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptUpdatedTotals: true }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok: boolean;
        message?: string;
      } | null;
      if (!response.ok || !payload?.ok) {
        setMessage(payload?.message ?? "Cart could not be refreshed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-5 grid gap-2" aria-live="polite">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={isPending}
        onClick={revalidate}
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {isPending ? "Refreshing" : "Refresh cart"}
      </Button>
      {message && <p className="text-danger text-xs">{message}</p>}
    </div>
  );
}

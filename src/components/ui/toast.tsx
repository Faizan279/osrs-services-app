"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        },
      }}
    />
  );
}

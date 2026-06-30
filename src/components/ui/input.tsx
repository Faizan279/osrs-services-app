import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "border-border bg-surface-1 text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-primary/20 aria-invalid:border-danger aria-invalid:ring-danger/20 h-12 w-full rounded-xl border px-4 text-sm transition outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

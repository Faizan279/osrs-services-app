import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-xl border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-info/35 bg-info/10 text-text-primary",
      success: "border-success/35 bg-success/10 text-text-primary",
      warning: "border-warning/35 bg-warning/10 text-text-primary",
      danger: "border-danger/35 bg-danger/10 text-text-primary",
    },
  },
  defaultVariants: { variant: "info" },
});

type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants>;

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

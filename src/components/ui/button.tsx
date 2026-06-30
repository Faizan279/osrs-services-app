import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary px-5 text-primary-foreground hover:border-primary-hover hover:bg-primary-hover",
        secondary:
          "border-border bg-surface-2 px-5 text-text-primary hover:bg-surface-3",
        ghost:
          "border-transparent bg-transparent px-4 text-text-secondary hover:bg-surface-2 hover:text-text-primary",
        danger: "border-danger bg-danger px-5 text-white hover:brightness-110",
      },
      size: {
        default: "h-11 text-sm",
        sm: "h-9 min-h-9 rounded-lg px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

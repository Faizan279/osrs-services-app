import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-primary/90 bg-primary px-5 text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.2)] hover:border-primary-hover hover:bg-primary-hover hover:shadow-[0_8px_24px_rgb(166_215_25_/_0.12)]",
        secondary:
          "border-border-strong/70 bg-surface-2 px-5 text-text-primary shadow-[inset_0_1px_0_rgb(255_255_255_/_0.025)] hover:border-gold/30 hover:bg-surface-3",
        ghost:
          "border-transparent bg-transparent px-4 text-text-secondary hover:border-border hover:bg-surface-2/70 hover:text-text-primary",
        danger:
          "border-danger/60 bg-danger/90 px-5 text-white hover:border-danger hover:bg-danger",
        destructive:
          "border-danger/60 bg-danger/90 px-5 text-white hover:border-danger hover:bg-danger",
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

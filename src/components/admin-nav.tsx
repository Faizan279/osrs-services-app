"use client";

import {
  Blocks,
  CircleDollarSign,
  Coins,
  CreditCard,
  Hammer,
  LayoutDashboard,
  Library,
  ReceiptText,
  PackageSearch,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    href: "/admin/catalogue",
    label: "Catalogue",
    icon: Library,
    exact: false,
  },
  {
    href: "/admin/pricing",
    label: "Pricing",
    icon: CircleDollarSign,
    exact: false,
  },
  {
    href: "/admin/gold",
    label: "Gold",
    icon: Coins,
    exact: false,
  },
  {
    href: "/admin/accounts",
    label: "Accounts",
    icon: Store,
    exact: false,
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: PackageSearch,
    exact: false,
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: ReceiptText,
    exact: false,
  },
  {
    href: "/admin/checkout",
    label: "Checkout",
    icon: CreditCard,
    exact: false,
  },
  {
    href: "/admin/custom-builds",
    label: "Custom builds",
    icon: Hammer,
    exact: false,
  },
  {
    href: "/admin/design-system",
    label: "Design system",
    icon: Blocks,
    exact: false,
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin navigation"
      className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1.5 lg:overflow-visible lg:px-5 lg:pb-0"
    >
      {navigation.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-primary flex min-h-11 shrink-0 items-center gap-3 rounded-xl border px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none lg:w-full",
              active
                ? "border-primary/20 bg-primary-muted/70 text-primary shadow-[inset_3px_0_0_var(--primary)]"
                : "text-text-secondary hover:border-border hover:bg-surface-2 hover:text-text-primary border-transparent",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

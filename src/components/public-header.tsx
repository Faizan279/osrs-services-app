"use client";

import {
  ArrowRight,
  ChevronDown,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import {
  primaryNavigation,
  publicCtaLinks,
  serviceNavigation,
} from "@/config/public-navigation";
import { cn } from "@/lib/utils";

export function PublicHeader({ discordHref }: { discordHref: string }) {
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const servicesMenuRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        servicesMenuRef.current &&
        !servicesMenuRef.current.contains(event.target as Node)
      ) {
        setServicesOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setServicesOpen(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function keepFocusInPanel(event: KeyboardEvent) {
      if (event.key !== "Tab" || !mobilePanelRef.current) return;

      const focusable = Array.from(
        mobilePanelRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInPanel);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keepFocusInPanel);
      menuButton?.focus();
    };
  }, [mobileOpen]);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <>
      <div className="border-primary/10 border-b bg-[#06140f]">
        <div className="mx-auto flex min-h-9 max-w-7xl items-center justify-center gap-x-5 px-4 py-1.5 text-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-text-secondary flex items-center gap-2 text-[0.7rem] font-semibold tracking-[0.04em] sm:text-xs">
            <ShieldCheck aria-hidden="true" className="text-primary size-3.5" />
            Secure ordering, clear communication and order tracking from one
            dashboard.
          </p>
          <Link
            href={discordHref}
            className="text-primary hover:text-primary-hover hidden min-h-7 items-center gap-1.5 text-xs font-bold transition sm:flex"
          >
            <MessageCircle aria-hidden="true" className="size-3.5" />
            Discord &amp; support
          </Link>
        </div>
      </div>

      <header className="border-border/70 sticky top-0 z-40 border-b bg-[#020b12]/92 shadow-[0_12px_36px_rgb(0_0_0_/_0.28)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="OSRS Services home"
            className="focus-visible:ring-primary shrink-0 rounded-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            <BrandLogo priority className="w-[9.75rem] sm:w-44" />
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden h-full items-center gap-0.5 lg:flex"
          >
            <div
              ref={servicesMenuRef}
              className="relative flex h-full items-center"
            >
              <button
                type="button"
                className="text-text-secondary hover:text-text-primary focus-visible:ring-primary flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
                aria-expanded={servicesOpen}
                aria-controls="desktop-services-menu"
                onClick={() => setServicesOpen((open) => !open)}
              >
                Services
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 transition-transform",
                    servicesOpen && "rotate-180",
                  )}
                />
              </button>

              <div
                id="desktop-services-menu"
                className={cn(
                  "border-border-strong/75 absolute top-[calc(100%-0.35rem)] left-0 w-[46rem] origin-top-left rounded-2xl border bg-[#07120e] p-3 shadow-[0_26px_70px_rgb(0_0_0_/_0.55)] transition duration-150",
                  servicesOpen
                    ? "visible translate-y-0 opacity-100"
                    : "invisible -translate-y-1 opacity-0",
                )}
                aria-hidden={!servicesOpen}
              >
                <div className="border-border bg-background/40 mb-2 flex items-center justify-between rounded-xl border px-4 py-3">
                  <div>
                    <p className="text-text-primary text-sm font-bold">
                      Explore professional services
                    </p>
                    <p className="text-text-muted mt-0.5 text-xs">
                      Compare categories, delivery guidance and service modes.
                    </p>
                  </div>
                  <span className="text-gold text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                    Service index
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {serviceNavigation.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      tabIndex={servicesOpen ? 0 : -1}
                      onClick={() => setServicesOpen(false)}
                      className="hover:border-border-strong hover:bg-surface-3 focus-visible:ring-primary group rounded-xl border border-transparent px-4 py-3 transition focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="text-text-primary group-hover:text-primary text-sm font-bold transition">
                        {item.label}
                      </span>
                      <span className="text-text-muted mt-1 block text-xs leading-5">
                        {item.description}
                      </span>
                    </Link>
                  ))}
                </div>
                <Link
                  href={publicCtaLinks.browseServices}
                  tabIndex={servicesOpen ? 0 : -1}
                  onClick={() => setServicesOpen(false)}
                  className="border-primary/20 bg-primary/8 hover:border-primary/40 mt-2 flex min-h-12 items-center justify-between rounded-xl border px-4 text-sm font-bold transition"
                >
                  Browse the complete marketplace
                  <ArrowRight
                    aria-hidden="true"
                    className="text-primary size-4"
                  />
                </Link>
              </div>
            </div>

            {primaryNavigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-text-secondary hover:text-text-primary focus-visible:ring-primary flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <Link
              href={publicCtaLinks.search}
              className="text-text-secondary hover:text-text-primary focus-visible:ring-primary flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <Search aria-hidden="true" className="size-4" />
              Search
            </Link>
            <Link
              href="/login"
              className="text-text-secondary hover:text-text-primary focus-visible:ring-primary flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <UserRound aria-hidden="true" className="size-4" />
              Sign in
            </Link>
            <Link
              href="/cart"
              className="text-text-secondary hover:text-text-primary focus-visible:ring-primary flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <ShoppingCart aria-hidden="true" className="size-4" />
              Cart
            </Link>
            <Link
              href={publicCtaLinks.browseServices}
              className={buttonVariants({ size: "sm" })}
            >
              Browse services
            </Link>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open mobile navigation"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation-panel"
            className="border-border bg-surface-2 text-text-primary hover:border-border-strong focus-visible:ring-primary flex size-11 items-center justify-center rounded-xl border transition focus-visible:ring-2 focus-visible:outline-none lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "visible" : "pointer-events-none invisible",
        )}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Close mobile navigation overlay"
          tabIndex={mobileOpen ? 0 : -1}
          className={cn(
            "absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={closeMobileMenu}
        />
        <div
          ref={mobilePanelRef}
          id="mobile-navigation-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className={cn(
            "border-border absolute top-0 right-0 flex h-full w-[min(92vw,25rem)] flex-col overflow-y-auto border-l bg-[#06110d] shadow-[-24px_0_70px_rgb(0_0_0_/_0.5)] transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="border-border flex min-h-20 items-center justify-between border-b px-5">
            <BrandLogo className="w-40" />
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close mobile navigation"
              className="border-border bg-background/50 text-text-primary focus-visible:ring-primary flex size-11 items-center justify-center rounded-xl border focus-visible:ring-2 focus-visible:outline-none"
              onClick={closeMobileMenu}
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <nav aria-label="Mobile navigation" className="flex-1 px-5 py-6">
            <p className="text-gold mb-3 text-[0.65rem] font-bold tracking-[0.2em] uppercase">
              Services
            </p>
            <div className="grid gap-1 sm:grid-cols-2">
              {serviceNavigation.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  tabIndex={mobileOpen ? 0 : -1}
                  className="border-border/70 bg-background/25 text-text-primary hover:border-primary/35 focus-visible:ring-primary flex min-h-12 items-center rounded-xl border px-3.5 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-border mt-6 grid border-t pt-5">
              {primaryNavigation.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  tabIndex={mobileOpen ? 0 : -1}
                  className="text-text-secondary hover:text-primary focus-visible:ring-primary flex min-h-12 items-center rounded-lg px-2 text-base font-semibold focus-visible:ring-2 focus-visible:outline-none"
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="border-border bg-background/35 grid gap-3 border-t p-5">
            <Link
              href={publicCtaLinks.browseServices}
              tabIndex={mobileOpen ? 0 : -1}
              className={buttonVariants({ size: "lg" })}
              onClick={closeMobileMenu}
            >
              Browse services
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/login"
                tabIndex={mobileOpen ? 0 : -1}
                className={buttonVariants({ variant: "secondary" })}
                onClick={closeMobileMenu}
              >
                Sign in
              </Link>
              <Link
                href="/cart"
                tabIndex={mobileOpen ? 0 : -1}
                className={buttonVariants({ variant: "secondary" })}
                onClick={closeMobileMenu}
              >
                Cart
              </Link>
              <Link
                href={discordHref}
                tabIndex={mobileOpen ? 0 : -1}
                className={buttonVariants({ variant: "secondary" })}
                onClick={closeMobileMenu}
              >
                Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

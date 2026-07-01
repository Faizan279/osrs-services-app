"use client";

import { ArrowRight, BadgeCheck, Shield, Swords } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { featuredServices } from "@/content/homepage";
import { cn } from "@/lib/utils";

const filters = [
  "All services",
  "Power levelling",
  "Questing",
  "Bossing and PvM",
] as const;

export function FeaturedServicesMarketplace() {
  const [activeFilter, setActiveFilter] =
    useState<(typeof filters)[number]>("All services");
  const filteredServices =
    activeFilter === "All services"
      ? featuredServices
      : featuredServices.filter(({ category }) => category === activeFilter);
  const highlighted = filteredServices[0] ?? featuredServices[0];
  const supporting = filteredServices.slice(1);

  return (
    <div className="mt-10">
      <div
        role="tablist"
        aria-label="Featured service categories"
        className="border-border/70 flex gap-1 overflow-x-auto border-b pb-3"
      >
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter}
            className={cn(
              "focus-visible:ring-primary min-h-10 shrink-0 rounded-xl px-4 text-xs font-bold transition focus-visible:ring-2 focus-visible:outline-none",
              activeFilter === filter
                ? "bg-primary text-primary-foreground"
                : "text-text-secondary hover:bg-surface-3 hover:text-text-primary",
            )}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {highlighted ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <article className="featured-service-stage relative isolate min-h-[28rem] overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
            <div
              className="marketplace-object pointer-events-none absolute right-[-2rem] bottom-[-2.5rem] opacity-90"
              aria-hidden="true"
            >
              <span className="marketplace-shield">
                <Shield className="size-14" />
              </span>
              <span className="marketplace-blade">
                <Swords className="size-11" />
              </span>
            </div>
            <div className="relative z-10 flex h-full max-w-lg flex-col">
              <p className="text-gold kicker-type">Highlighted service path</p>
              <h3 className="display-type text-text-primary mt-5 text-3xl sm:text-4xl">
                {highlighted.name}
              </h3>
              <p className="text-text-secondary mt-4 text-sm leading-7 sm:text-base">
                {highlighted.summary}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {highlighted.modes.map((mode) => (
                  <span
                    key={mode}
                    className="bg-background/55 text-text-secondary rounded-full px-3 py-1.5 text-[0.67rem] font-bold"
                  >
                    {mode}
                  </span>
                ))}
              </div>
              <div className="mt-auto grid gap-4 pt-10 sm:grid-cols-2">
                <div>
                  <p className="text-text-muted text-[0.65rem] font-bold tracking-[0.12em] uppercase">
                    Estimate
                  </p>
                  <p className="text-primary mt-2 text-lg font-black">
                    {highlighted.price}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-[0.65rem] font-bold tracking-[0.12em] uppercase">
                    Scheduling
                  </p>
                  <p className="text-text-primary mt-2 text-sm font-bold">
                    {highlighted.delivery}
                  </p>
                </div>
              </div>
              <Link
                href={highlighted.href}
                className="text-primary focus-visible:ring-primary mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                {highlighted.label}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </article>

          <div className="divide-border/60 border-border/70 divide-y overflow-hidden rounded-[1.75rem] border-y lg:border">
            {(supporting.length ? supporting : featuredServices.slice(1)).map(
              (service) => (
                <article
                  key={service.name}
                  className="hover:bg-surface-3/65 group bg-surface-1/40 px-1 py-5 transition sm:px-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-gold text-[0.62rem] font-bold tracking-[0.14em] uppercase">
                        {service.category}
                      </p>
                      <h3 className="text-text-primary mt-2 text-lg font-bold">
                        {service.name}
                      </h3>
                    </div>
                    <BadgeCheck
                      aria-hidden="true"
                      className="text-primary mt-1 size-4 shrink-0"
                    />
                  </div>
                  <p className="text-text-secondary mt-2 text-sm leading-6">
                    {service.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-primary text-xs font-bold">
                      {service.price}
                    </span>
                    <Link
                      href={service.href}
                      className="text-text-primary hover:text-primary focus-visible:ring-primary inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-bold focus-visible:ring-2 focus-visible:outline-none"
                    >
                      View details
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </article>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

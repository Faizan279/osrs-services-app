"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { marketplaceSearchItems } from "@/content/homepage";

const quickSuggestions = marketplaceSearchItems.slice(0, 5);

export function MarketplaceSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!normalizedQuery) return [];

    return marketplaceSearchItems.filter((item) =>
      [item.label, item.description, ...item.keywords].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [normalizedQuery]);

  return (
    <div id="marketplace-search" className="section-anchor relative mt-7">
      <form
        role="search"
        className="border-primary/25 bg-background/85 focus-within:border-primary/55 focus-within:ring-primary/15 flex min-h-14 items-center gap-3 rounded-2xl border p-1.5 pl-4 shadow-[0_18px_50px_rgb(0_0_0_/_0.32)] transition focus-within:ring-4"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(matches[0]?.href ?? "/#service-categories");
        }}
      >
        <Search aria-hidden="true" className="text-primary size-5 shrink-0" />
        <label htmlFor="homepage-service-search" className="sr-only">
          Search OSRS services
        </label>
        <input
          id="homepage-service-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search quests, skills, bosses, gold or account services"
          aria-controls="hero-search-results"
          className="text-text-primary placeholder:text-text-muted min-w-0 flex-1 bg-transparent py-2 text-sm outline-none sm:text-base"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl transition focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Search services"
        >
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </form>

      {normalizedQuery ? (
        <div
          id="hero-search-results"
          className="border-border-strong bg-surface-1 absolute top-[calc(100%+0.55rem)] right-0 left-0 z-30 overflow-hidden rounded-2xl border p-2 shadow-[0_26px_70px_rgb(0_0_0_/_0.55)]"
        >
          {matches.length ? (
            matches.slice(0, 4).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="hover:bg-surface-3 focus-visible:ring-primary group flex min-h-14 items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition focus-visible:ring-2 focus-visible:outline-none"
              >
                <span>
                  <span className="text-text-primary group-hover:text-primary block text-sm font-bold">
                    {item.label}
                  </span>
                  <span className="text-text-muted mt-0.5 block text-xs">
                    {item.description}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="text-primary size-4 shrink-0"
                />
              </Link>
            ))
          ) : (
            <p className="text-text-secondary px-3 py-4 text-sm">
              No homepage match yet. Submit to browse all service categories.
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-text-muted text-[0.66rem] font-bold tracking-[0.12em] uppercase">
          Quick search
        </span>
        {quickSuggestions.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="text-text-secondary hover:text-primary focus-visible:ring-primary rounded-md text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

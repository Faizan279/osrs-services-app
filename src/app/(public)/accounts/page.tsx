import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountMarketplacePage } from "@/components/account-marketplace";
import { getDiscordHref } from "@/config/public-navigation";
import {
  accountListingAvailabilities,
  accountSortOptions,
} from "@/lib/accounts/constants";
import {
  getPublicAccountMarketplace,
  type AccountMarketplaceFilters,
} from "@/lib/accounts/server";
import { catalogueGameModes } from "@/lib/catalogue/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OSRS account marketplace",
  description:
    "Browse public-safe prebuilt account listings with server-side search, filters and support-review calls to action.",
  alternates: { canonical: "/accounts" },
};

function scalar(
  query: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

function list(
  query: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = query[key];
  return (Array.isArray(value) ? value : value ? value.split(",") : [])
    .map((item) => item.trim())
    .filter((item) => /^[a-z0-9-]+$/i.test(item));
}

function integer(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function filtersFrom(
  query: Record<string, string | string[] | undefined>,
): AccountMarketplaceFilters {
  const sort = scalar(query, "sort");
  const availability = scalar(query, "availability");
  const mode = scalar(query, "mode");
  return {
    search: scalar(query, "q")?.slice(0, 80),
    page: integer(scalar(query, "page")) || 1,
    pageSize: integer(scalar(query, "pageSize")) || 9,
    sort:
      sort && accountSortOptions.includes(sort as never)
        ? (sort as AccountMarketplaceFilters["sort"])
        : "featured",
    gameMode:
      mode && catalogueGameModes.includes(mode as never) ? mode : undefined,
    minPriceCents: integer(scalar(query, "minPrice")),
    maxPriceCents: integer(scalar(query, "maxPrice")),
    minCombatLevel: integer(scalar(query, "minCombat")),
    maxCombatLevel: integer(scalar(query, "maxCombat")),
    minTotalLevel: integer(scalar(query, "minTotal")),
    maxTotalLevel: integer(scalar(query, "maxTotal")),
    featureKeys: list(query, "feature"),
    unlockKeys: list(query, "unlock"),
    availability:
      availability &&
      accountListingAvailabilities.includes(availability as never)
        ? (availability as AccountMarketplaceFilters["availability"])
        : "",
  };
}

function filterRecord(query: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(query).flatMap(([key, value]) => {
      if (Array.isArray(value)) return [[key, value.join(",")]];
      return value ? [[key, value]] : [];
    }),
  );
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const data = await getPublicAccountMarketplace(filtersFrom(query));
  if (!data) notFound();
  return (
    <AccountMarketplacePage
      data={data}
      filters={filterRecord(query)}
      requestHref={getDiscordHref()}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductMarketplacePage } from "@/components/product-marketplace";
import { getDiscordHref } from "@/config/public-navigation";
import {
  productAvailabilityStates,
  productSortOptions,
  productTypes,
} from "@/lib/products/constants";
import {
  getPublicProductMarketplace,
  type ProductMarketplaceFilters,
} from "@/lib/products/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OSRS product marketplace",
  description:
    "Browse public-safe item, bond and outfit listings with server-side search, filters and preview estimates.",
  alternates: { canonical: "/products" },
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

function rawList(
  query: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = query[key];
  return (Array.isArray(value) ? value : value ? value.split(",") : [])
    .map((item) => item.trim())
    .filter(Boolean);
}

function integer(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function filtersFrom(
  query: Record<string, string | string[] | undefined>,
): ProductMarketplaceFilters {
  const sort = scalar(query, "sort");
  const type = scalar(query, "type");
  const availability = scalar(query, "availability");
  const category = scalar(query, "category");
  const minPrice = scalar(query, "minPrice");
  const maxPrice = scalar(query, "maxPrice");
  const invalid =
    Boolean(type && !productTypes.includes(type as never)) ||
    Boolean(
      availability &&
      !productAvailabilityStates.includes(availability as never),
    ) ||
    Boolean(category && !/^[a-z0-9-]+$/i.test(category)) ||
    rawList(query, "tag").some((item) => !/^[a-z0-9-]+$/i.test(item)) ||
    Boolean(minPrice && integer(minPrice) == null) ||
    Boolean(maxPrice && integer(maxPrice) == null);
  return {
    search: scalar(query, "q")?.slice(0, 80),
    page: integer(scalar(query, "page")) || 1,
    pageSize: integer(scalar(query, "pageSize")) || 12,
    sort:
      sort && productSortOptions.includes(sort as never)
        ? (sort as ProductMarketplaceFilters["sort"])
        : "featured",
    productType:
      type && productTypes.includes(type as never)
        ? (type as ProductMarketplaceFilters["productType"])
        : "",
    category: category && /^[a-z0-9-]+$/i.test(category) ? category : undefined,
    tags: list(query, "tag"),
    minPriceCents: integer(minPrice),
    maxPriceCents: integer(maxPrice),
    availability:
      availability && productAvailabilityStates.includes(availability as never)
        ? (availability as ProductMarketplaceFilters["availability"])
        : "",
    inStockOnly: scalar(query, "inStock") === "1",
    featuredOnly: scalar(query, "featured") === "1",
    invalid,
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const data = await getPublicProductMarketplace(filtersFrom(query));
  if (!data) notFound();
  return (
    <ProductMarketplacePage
      data={data}
      filters={filterRecord(query)}
      requestHref={getDiscordHref()}
    />
  );
}

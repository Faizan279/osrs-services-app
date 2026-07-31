import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

const publicProductsQuerySchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12).catch(12),
  sort: z.enum(productSortOptions).default("featured").catch("featured"),
  type: z.enum(productTypes).or(z.literal("")).default("").catch(""),
  category: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/i)
    .optional()
    .catch(undefined),
  minPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  availability: z
    .enum(productAvailabilityStates)
    .or(z.literal(""))
    .default("")
    .catch(""),
  tag: z.array(z.string().trim().max(100)).default([]).catch([]),
  inStock: z.boolean().default(false).catch(false),
  featured: z.boolean().default(false).catch(false),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function list(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter((item) => /^[a-z0-9-]+$/i.test(item));
}

function filtersFrom(request: NextRequest): ProductMarketplaceFilters {
  const { searchParams } = request.nextUrl;
  const rawType = searchParams.get("type") ?? "";
  const rawAvailability = searchParams.get("availability") ?? "";
  const rawCategory = searchParams.get("category") ?? "";
  const rawTags = searchParams
    .getAll("tag")
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
  const rawMinPrice = searchParams.get("minPrice");
  const rawMaxPrice = searchParams.get("maxPrice");
  const invalid =
    (rawType !== "" && !productTypes.includes(rawType as never)) ||
    (rawAvailability !== "" &&
      !productAvailabilityStates.includes(rawAvailability as never)) ||
    (rawCategory !== "" && !/^[a-z0-9-]+$/i.test(rawCategory)) ||
    rawTags.some((item) => !/^[a-z0-9-]+$/i.test(item)) ||
    (rawMinPrice !== null &&
      (!Number.isInteger(Number(rawMinPrice)) || Number(rawMinPrice) < 0)) ||
    (rawMaxPrice !== null &&
      (!Number.isInteger(Number(rawMaxPrice)) || Number(rawMaxPrice) < 0));
  const parsed = publicProductsQuerySchema.parse({
    q: searchParams.get("q") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    type: rawType,
    category: rawCategory || undefined,
    minPrice: rawMinPrice ?? undefined,
    maxPrice: rawMaxPrice ?? undefined,
    availability: rawAvailability,
    tag: list(searchParams, "tag"),
    inStock: searchParams.get("inStock") === "1",
    featured: searchParams.get("featured") === "1",
  });
  return {
    search: parsed.q,
    page: parsed.page,
    pageSize: parsed.pageSize,
    sort: parsed.sort,
    productType: parsed.type,
    category: parsed.category,
    tags: parsed.tag,
    minPriceCents: parsed.minPrice,
    maxPriceCents: parsed.maxPrice,
    availability: parsed.availability,
    inStockOnly: parsed.inStock,
    featuredOnly: parsed.featured,
    invalid,
  };
}

export async function GET(request: NextRequest) {
  try {
    const data = await getPublicProductMarketplace(filtersFrom(request));
    if (!data) {
      return json(
        { ok: false, message: "Product marketplace not found." },
        404,
      );
    }
    return json({ ok: true, data });
  } catch (error) {
    console.error("product marketplace search failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json({ ok: false, message: "Products could not be loaded." }, 500);
  }
}

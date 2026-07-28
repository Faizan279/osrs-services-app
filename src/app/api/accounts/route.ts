import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

const publicAccountsQuerySchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(9).catch(9),
  sort: z.enum(accountSortOptions).default("featured").catch("featured"),
  mode: z.enum(catalogueGameModes).optional().catch(undefined),
  minPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  minCombat: z.coerce.number().int().min(0).optional().catch(undefined),
  maxCombat: z.coerce.number().int().min(0).optional().catch(undefined),
  minTotal: z.coerce.number().int().min(0).optional().catch(undefined),
  maxTotal: z.coerce.number().int().min(0).optional().catch(undefined),
  availability: z
    .enum(accountListingAvailabilities)
    .or(z.literal(""))
    .default("")
    .catch(""),
  feature: z.array(z.string().trim().max(100)).default([]).catch([]),
  unlock: z.array(z.string().trim().max(100)).default([]).catch([]),
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

function filtersFrom(request: NextRequest): AccountMarketplaceFilters {
  const { searchParams } = request.nextUrl;
  const parsed = publicAccountsQuerySchema.parse({
    q: searchParams.get("q") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    mode: searchParams.get("mode") ?? undefined,
    minPrice: searchParams.get("minPrice") ?? undefined,
    maxPrice: searchParams.get("maxPrice") ?? undefined,
    minCombat: searchParams.get("minCombat") ?? undefined,
    maxCombat: searchParams.get("maxCombat") ?? undefined,
    minTotal: searchParams.get("minTotal") ?? undefined,
    maxTotal: searchParams.get("maxTotal") ?? undefined,
    availability: searchParams.get("availability") ?? "",
    feature: list(searchParams, "feature"),
    unlock: list(searchParams, "unlock"),
  });
  return {
    search: parsed.q,
    page: parsed.page,
    pageSize: parsed.pageSize,
    sort: parsed.sort,
    gameMode: parsed.mode,
    minPriceCents: parsed.minPrice,
    maxPriceCents: parsed.maxPrice,
    minCombatLevel: parsed.minCombat,
    maxCombatLevel: parsed.maxCombat,
    minTotalLevel: parsed.minTotal,
    maxTotalLevel: parsed.maxTotal,
    availability: parsed.availability,
    featureKeys: parsed.feature,
    unlockKeys: parsed.unlock,
  };
}

export async function GET(request: NextRequest) {
  try {
    const data = await getPublicAccountMarketplace(filtersFrom(request));
    if (!data)
      return json({ ok: false, message: "Marketplace not found." }, 404);
    return json({ ok: true, data });
  } catch (error) {
    console.error("account listing search failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      { ok: false, message: "Account listings could not be loaded." },
      500,
    );
  }
}

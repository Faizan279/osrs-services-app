import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  ACCOUNT_MARKETPLACE_FEATURE_FLAG,
  accountListingAvailabilities,
  accountSortOptions,
} from "@/lib/accounts/constants";
import {
  AccountMarketplaceValidationError,
  calculateAccountListingEstimate,
  normalizePublishedAccountListingRevision,
  safeAccountJson,
  withAccountGlobalPricing,
  type AccountEstimateResult,
  type PublishedAccountListingRevisionSnapshotV1,
} from "@/lib/accounts/estimate";
import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import { prisma } from "@/lib/db/prisma";
import { applyPublishedPricingIfEnabled } from "@/lib/pricing/server";

export type AccountMarketplaceFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: (typeof accountSortOptions)[number];
  gameMode?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  minCombatLevel?: number;
  maxCombatLevel?: number;
  minTotalLevel?: number;
  maxTotalLevel?: number;
  featureKeys?: string[];
  unlockKeys?: string[];
  availability?: (typeof accountListingAvailabilities)[number] | "";
};

type ListingWithLatestRevision = Prisma.AccountListingGetPayload<{
  include: {
    revisions: { take: 1 };
    marketplace: { include: { service: { include: { category: true } } } };
  };
}>;

type PublicRevisionListing = {
  stableKey: string;
  slug: string;
  title: string;
  shortDescription: string;
  gameMode: string;
  priceCents: number;
  price: string;
  availability: (typeof accountListingAvailabilities)[number];
  combatLevel: number | null;
  totalLevel: number | null;
  questPoints: number | null;
  publicBadgeText: string | null;
  coverImage: {
    assetPath: string;
    altText: string;
  } | null;
  features: Array<{ key: string; label: string }>;
  unlocks: Array<{ key: string; label: string }>;
  revision: PublishedAccountListingRevisionSnapshotV1;
  publishedAt: Date | null;
  isFeatured: boolean;
  sortOrder: number;
};

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

async function accountMarketplaceFlagEnabled() {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: ACCOUNT_MARKETPLACE_FEATURE_FLAG },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

function latestRevision(listing: ListingWithLatestRevision) {
  const revision = listing.revisions[0];
  if (!revision) return null;
  return normalizePublishedAccountListingRevision(revision.snapshot);
}

function publicListingFromRevision(
  listing: ListingWithLatestRevision,
): PublicRevisionListing | null {
  const revision = latestRevision(listing);
  if (!revision) return null;
  const cover =
    revision.images.find((image) => image.imageType === "COVER") ??
    revision.images[0] ??
    null;
  return {
    stableKey: revision.listing.stableKey,
    slug: revision.listing.slug,
    title: revision.listing.publicTitle,
    shortDescription: revision.listing.shortDescription,
    gameMode: revision.listing.gameMode,
    priceCents: revision.listing.basePriceCents,
    price: money(
      revision.listing.basePriceCents,
      revision.listing.currencyCode,
    ),
    availability: listing.availability,
    combatLevel: revision.listing.combatLevel,
    totalLevel: revision.listing.totalLevel,
    questPoints: revision.listing.questPoints,
    publicBadgeText: revision.listing.publicBadgeText,
    coverImage: cover
      ? { assetPath: cover.assetPath, altText: cover.altText }
      : null,
    features: revision.features.map((feature) => ({
      key: feature.featureKey,
      label: feature.publicLabel,
    })),
    unlocks: revision.unlocks.map((unlock) => ({
      key: unlock.unlockKey,
      label: unlock.publicLabel,
    })),
    revision,
    publishedAt: listing.publishedAt,
    isFeatured: listing.isFeatured,
    sortOrder: listing.sortOrder,
  };
}

function includesText(listing: PublicRevisionListing, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [
    listing.title,
    listing.shortDescription,
    listing.revision.listing.fullDescription,
  ].some((value) => value.toLowerCase().includes(needle));
}

function between(
  value: number | null,
  minimum: number | undefined,
  maximum: number | undefined,
) {
  if (value == null) return minimum == null && maximum == null;
  if (minimum != null && value < minimum) return false;
  if (maximum != null && value > maximum) return false;
  return true;
}

function filterPublicListings(
  listings: PublicRevisionListing[],
  filters: AccountMarketplaceFilters,
) {
  const featureKeys = new Set(filters.featureKeys ?? []);
  const unlockKeys = new Set(filters.unlockKeys ?? []);
  return listings.filter((listing) => {
    if (!includesText(listing, filters.search ?? "")) return false;
    if (filters.gameMode && listing.gameMode !== filters.gameMode) return false;
    if (
      !between(listing.priceCents, filters.minPriceCents, filters.maxPriceCents)
    ) {
      return false;
    }
    if (
      !between(
        listing.combatLevel,
        filters.minCombatLevel,
        filters.maxCombatLevel,
      )
    ) {
      return false;
    }
    if (
      !between(listing.totalLevel, filters.minTotalLevel, filters.maxTotalLevel)
    ) {
      return false;
    }
    if (filters.availability && listing.availability !== filters.availability) {
      return false;
    }
    if (!filters.availability && listing.availability === "SOLD") {
      return false;
    }
    for (const key of featureKeys) {
      if (!listing.features.some((feature) => feature.key === key)) {
        return false;
      }
    }
    for (const key of unlockKeys) {
      if (!listing.unlocks.some((unlock) => unlock.key === key)) {
        return false;
      }
    }
    return true;
  });
}

function sortPublicListings(
  listings: PublicRevisionListing[],
  sort: (typeof accountSortOptions)[number],
) {
  const sorted = [...listings];
  sorted.sort((left, right) => {
    if (sort === "price_asc" && left.priceCents !== right.priceCents) {
      return left.priceCents - right.priceCents;
    }
    if (sort === "price_desc" && left.priceCents !== right.priceCents) {
      return right.priceCents - left.priceCents;
    }
    if (
      sort === "total_level_desc" &&
      (left.totalLevel ?? -1) !== (right.totalLevel ?? -1)
    ) {
      return (right.totalLevel ?? -1) - (left.totalLevel ?? -1);
    }
    if (
      sort === "newest" &&
      (left.publishedAt?.getTime() ?? 0) !== (right.publishedAt?.getTime() ?? 0)
    ) {
      return (
        (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0)
      );
    }
    if (left.isFeatured !== right.isFeatured) {
      return left.isFeatured ? -1 : 1;
    }
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.stableKey.localeCompare(right.stableKey);
  });
  return sorted;
}

function facetsFrom(listings: PublicRevisionListing[]) {
  const features = new Map<string, string>();
  const unlocks = new Map<string, string>();
  for (const listing of listings) {
    for (const feature of listing.features)
      features.set(feature.key, feature.label);
    for (const unlock of listing.unlocks) unlocks.set(unlock.key, unlock.label);
  }
  return {
    features: [...features.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    unlocks: [...unlocks.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}

async function loadPublicMarketplace(now = new Date()) {
  return prisma.accountMarketplace.findFirst({
    where: {
      service: {
        ...publicCatalogueWhere(now),
        engineType: "ACCOUNT_MARKETPLACE",
      },
    },
    select: {
      id: true,
      stableKey: true,
      serviceId: true,
      publicName: true,
      slug: true,
      description: true,
      currencyCode: true,
      availabilityState: true,
      publicMarketplaceInstructions: true,
      defaultSort: true,
      needsClientReview: true,
      draftVersion: true,
      createdAt: true,
      updatedAt: true,
      service: {
        select: {
          id: true,
          categoryId: true,
          name: true,
          slug: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

export async function getPublicAccountMarketplace(
  filters: AccountMarketplaceFilters = {},
) {
  const [marketplace, featureEnabled] = await Promise.all([
    loadPublicMarketplace(),
    accountMarketplaceFlagEnabled(),
  ]);
  if (!marketplace) return null;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, filters.pageSize ?? 9));
  const sort =
    filters.sort && accountSortOptions.includes(filters.sort)
      ? filters.sort
      : marketplace.defaultSort === "price_asc" ||
          marketplace.defaultSort === "price_desc" ||
          marketplace.defaultSort === "total_level_desc" ||
          marketplace.defaultSort === "newest"
        ? marketplace.defaultSort
        : "featured";

  if (!featureEnabled || marketplace.availabilityState !== "AVAILABLE") {
    return {
      marketplace,
      featureEnabled,
      listings: [],
      featuredListings: [],
      total: 0,
      page,
      pageSize,
      pages: 1,
      sort,
      facets: { features: [], unlocks: [] },
    };
  }

  const records = await prisma.accountListing.findMany({
    where: {
      marketplaceId: marketplace.id,
      publicationStatus: "PUBLISHED",
      approvalStatus: "APPROVED",
    },
    orderBy: [{ sortOrder: "asc" }, { stableKey: "asc" }],
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        take: 1,
      },
    },
  });
  const publicListings = records
    .map(publicListingFromRevision)
    .filter((listing): listing is PublicRevisionListing => Boolean(listing));
  const filtered = sortPublicListings(
    filterPublicListings(publicListings, filters),
    sort,
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const listings = filtered.slice(start, start + pageSize);
  return {
    marketplace,
    featureEnabled,
    listings,
    featuredListings: filtered
      .filter((listing) => listing.isFeatured)
      .slice(0, 3),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    sort,
    facets: facetsFrom(publicListings),
  };
}

export async function getPublicAccountListingDetail(slug: string) {
  const marketplace = await getPublicAccountMarketplace({ pageSize: 24 });
  if (!marketplace || !marketplace.featureEnabled) return null;
  const records = await prisma.accountListing.findMany({
    where: {
      marketplaceId: marketplace.marketplace.id,
      publicationStatus: "PUBLISHED",
      approvalStatus: "APPROVED",
    },
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        take: 1,
      },
    },
  });
  for (const record of records) {
    const listing = publicListingFromRevision(record);
    if (listing?.slug === slug) {
      return {
        marketplace: marketplace.marketplace,
        featureEnabled: marketplace.featureEnabled,
        listing,
      };
    }
  }
  return null;
}

async function loadListingForEstimate(input: {
  listingId?: string;
  listingSlug?: string;
}) {
  const where: Prisma.AccountListingWhereInput = {
    publicationStatus: "PUBLISHED",
    approvalStatus: "APPROVED",
    marketplace: {
      service: {
        ...publicCatalogueWhere(),
        engineType: "ACCOUNT_MARKETPLACE",
      },
    },
    ...(input.listingId ? { id: input.listingId } : {}),
  };
  const records = await prisma.accountListing.findMany({
    where,
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        take: 1,
      },
    },
  });
  if (input.listingId) return records[0] ?? null;
  return (
    records.find(
      (record) => latestRevision(record)?.listing.slug === input.listingSlug,
    ) ?? null
  );
}

export async function calculateServerAccountListingEstimate(input: {
  listingId?: string;
  listingSlug?: string;
}) {
  const flagEnabled = await accountMarketplaceFlagEnabled();
  if (!flagEnabled) {
    throw new AccountMarketplaceValidationError(
      "The Account Marketplace is temporarily unavailable.",
    );
  }
  if (!input.listingId && !input.listingSlug) {
    throw new AccountMarketplaceValidationError("Choose an account listing.");
  }
  const listing = await loadListingForEstimate(input);
  if (!listing) {
    throw new AccountMarketplaceValidationError("Choose an available listing.");
  }
  const revision = latestRevision(listing);
  if (!revision) {
    throw new AccountMarketplaceValidationError(
      "This listing is waiting for a published revision.",
    );
  }
  let estimate = calculateAccountListingEstimate({
    revision,
    availability: listing.availability,
    approvalStatus: listing.approvalStatus,
    publicationStatus: listing.publicationStatus,
  });
  const priced = await applyPublishedPricingIfEnabled({
    source: {
      serviceId: listing.marketplace.serviceId,
      serviceSlug: listing.marketplace.service.slug,
      categoryId: listing.marketplace.service.categoryId,
      categorySlug: listing.marketplace.service.category.slug,
      engineType: "ACCOUNT_MARKETPLACE",
      currency: revision.listing.currencyCode,
      baseSubtotalCents: estimate.estimatedTotalCents,
      basePricingLines: estimate.lineItems,
      selectedReferences: {
        listingStableKey: revision.listing.stableKey,
        listingSlug: revision.listing.slug,
      },
      engineConfigurationRevision: {
        id: revision.revision.id,
        version: revision.revision.revisionNumber,
      },
    },
  });
  estimate = withAccountGlobalPricing(estimate, priced);
  return estimate;
}

function publicLine(line: { label: string; amountCents: number }) {
  return { label: line.label, amountCents: line.amountCents };
}

export function publicAccountEstimatePayload(estimate: AccountEstimateResult) {
  return {
    currency: estimate.currency,
    lineItems: estimate.lineItems.map(publicLine),
    basePriceCents: estimate.basePriceCents,
    estimatedTotalCents: estimate.estimatedTotalCents,
    estimatedTotal: estimate.estimatedTotal,
    availabilityState: estimate.availabilityState,
    availabilityMessage: estimate.availabilityMessage,
    finalPriceNote: estimate.finalPriceNote,
    snapshot: safeAccountJson(estimate.snapshot),
  };
}

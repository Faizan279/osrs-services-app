export type DirectOrderFacet = {
  facetKey: string;
  facetValue: string;
  label: string;
};

export type DirectOrderRequirement = {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  customerGuidance: string | null;
};

export type DirectOrderOffering = {
  slug: string;
  name: string;
  shortSummary: string;
  description: string | null;
  groupLabel: string | null;
  tierLabel: string | null;
  quantityEnabled: boolean;
  quantityUnit: string | null;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  basePriceCents: number | null;
  pricingUnit: string | null;
  estimatedDeliveryText: string | null;
  facets: DirectOrderFacet[];
  requirements: DirectOrderRequirement[];
};

export type DirectOrderSelection = {
  slug: string;
  quantity?: number;
};

export type DirectOrderFilterMode = "QUESTS" | "DIARIES" | "GATHERING";

export class DirectOrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectOrderValidationError";
  }
}

export function formatDirectOrderPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function safeQuantity(offering: DirectOrderOffering, requested?: number) {
  if (!offering.quantityEnabled) return 1;
  const minimum = Math.max(1, offering.minimumQuantity ?? 1);
  const maximum = offering.maximumQuantity ?? 1_000_000_000;
  const quantity = requested ?? minimum;
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < minimum ||
    quantity > maximum
  ) {
    throw new DirectOrderValidationError(
      `${offering.name} quantity must be between ${minimum.toLocaleString()} and ${maximum.toLocaleString()}.`,
    );
  }
  return quantity;
}

export function calculateDirectOrderEstimate(
  offerings: readonly DirectOrderOffering[],
  selections: readonly DirectOrderSelection[],
) {
  if (!selections.length) {
    throw new DirectOrderValidationError("Select at least one service.");
  }
  if (selections.length > 200) {
    throw new DirectOrderValidationError("Select no more than 200 services.");
  }

  const available = new Map(
    offerings.map((offering) => [offering.slug, offering]),
  );
  const seen = new Set<string>();
  const selectedSlugs = new Set(
    selections.map(({ slug }) => slug.replace(/^reference-/, "")),
  );
  for (const selection of selections) {
    const offering = available.get(selection.slug);
    if (!offering) continue;
    const missing = diaryPrerequisiteSlugs(offerings, offering).filter(
      (slug) => !selectedSlugs.has(slug.replace(/^reference-/, "")),
    );
    if (missing.length) {
      throw new DirectOrderValidationError(
        `${offering.name} requires its earlier regional tiers in this order.`,
      );
    }
  }
  const lines = selections.map((selection) => {
    if (seen.has(selection.slug)) {
      throw new DirectOrderValidationError("Select each service only once.");
    }
    seen.add(selection.slug);
    const offering = available.get(selection.slug);
    if (!offering || offering.basePriceCents == null) {
      throw new DirectOrderValidationError(
        "Choose an available priced service.",
      );
    }
    if (
      !Number.isSafeInteger(offering.basePriceCents) ||
      offering.basePriceCents < 0
    ) {
      throw new DirectOrderValidationError(
        "A selected service has invalid pricing.",
      );
    }
    const quantity = safeQuantity(offering, selection.quantity);
    const priceIncrement = offering.quantityEnabled
      ? Math.max(1, offering.minimumQuantity ?? 1)
      : 1;
    const units = offering.quantityEnabled
      ? Math.ceil(quantity / priceIncrement)
      : 1;
    const amountCents = offering.basePriceCents * units;
    if (!Number.isSafeInteger(amountCents) || amountCents > 100_000_000) {
      throw new DirectOrderValidationError(
        "The selected total requires support review.",
      );
    }
    return {
      slug: offering.slug,
      name: offering.name,
      quantity,
      quantityLabel: offering.quantityEnabled
        ? `${quantity.toLocaleString()} ${offering.quantityUnit ?? "units"}`
        : null,
      amountCents,
      label: offering.quantityEnabled
        ? `${offering.name} · ${quantity.toLocaleString()} ${offering.quantityUnit ?? "units"}`
        : offering.name,
    };
  });
  const subtotalCents = lines.reduce(
    (total, line) => total + line.amountCents,
    0,
  );
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 100_000_000) {
    throw new DirectOrderValidationError("This order requires support review.");
  }
  return {
    lines,
    subtotalCents,
    estimatedTotal: formatDirectOrderPrice(subtotalCents),
  };
}

export function facetValue(offering: DirectOrderOffering, key: string) {
  return (
    offering.facets.find((facet) => facet.facetKey === key)?.facetValue ?? null
  );
}

export function facetLabel(offering: DirectOrderOffering, key: string) {
  return offering.facets.find((facet) => facet.facetKey === key)?.label ?? null;
}

export function matchesDirectOrderFilters({
  offering,
  search,
  activeFilter,
}: {
  offering: DirectOrderOffering;
  search: string;
  activeFilter: string;
}) {
  const normalized = search.trim().toLowerCase();
  const haystack = [
    offering.name,
    offering.shortSummary,
    offering.groupLabel,
    offering.tierLabel,
    ...offering.facets.flatMap((facet) => [facet.label, facet.facetValue]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (normalized && !haystack.includes(normalized)) return false;
  if (activeFilter === "all") return true;
  return [
    offering.tierLabel?.toLowerCase(),
    ...offering.facets.map((facet) => facet.facetValue),
  ].includes(activeFilter);
}

const diaryTierOrder = ["easy", "medium", "hard", "elite"] as const;

export function diaryPrerequisiteSlugs(
  offerings: readonly DirectOrderOffering[],
  selectedOffering: DirectOrderOffering,
) {
  if (facetValue(selectedOffering, "dependency-behavior") !== "auto-include") {
    return [];
  }
  const region = facetValue(selectedOffering, "region");
  const selectedTier = facetValue(selectedOffering, "tier");
  const selectedIndex = diaryTierOrder.indexOf(
    selectedTier as (typeof diaryTierOrder)[number],
  );
  if (!region || selectedIndex <= 0) return [];
  return offerings
    .filter((offering) => {
      if (facetValue(offering, "region") !== region) return false;
      const index = diaryTierOrder.indexOf(
        facetValue(offering, "tier") as (typeof diaryTierOrder)[number],
      );
      return index >= 0 && index < selectedIndex;
    })
    .map((offering) => offering.slug);
}

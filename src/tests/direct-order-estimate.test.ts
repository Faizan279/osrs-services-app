import { describe, expect, it } from "vitest";

import {
  calculateDirectOrderEstimate,
  diaryPrerequisiteSlugs,
  matchesDirectOrderFilters,
  type DirectOrderOffering,
} from "@/lib/direct-order/core";

function offering(
  slug: string,
  name: string,
  price: number,
  overrides: Partial<DirectOrderOffering> = {},
): DirectOrderOffering {
  return {
    slug,
    name,
    shortSummary: `${name} configured service`,
    description: null,
    groupLabel: "Quest",
    tierLabel: null,
    quantityEnabled: false,
    quantityUnit: null,
    minimumQuantity: null,
    maximumQuantity: null,
    basePriceCents: price,
    pricingUnit: "fixed service",
    estimatedDeliveryText: null,
    facets: [],
    requirements: [],
    ...overrides,
  };
}

describe("direct catalogue ordering", () => {
  it("totals multiple quest selections and retains readable line names", () => {
    const offerings = [
      offering("dragon-slayer-ii", "Dragon Slayer II", 7_000),
      offering("monkey-madness-ii", "Monkey Madness II", 8_000),
      offering("desert-treasure-ii", "Desert Treasure II", 9_000),
    ];
    const result = calculateDirectOrderEstimate(
      offerings,
      offerings.map(({ slug }) => ({ slug })),
    );

    expect(result.subtotalCents).toBe(24_000);
    expect(result.lines.map((line) => line.name)).toEqual([
      "Dragon Slayer II",
      "Monkey Madness II",
      "Desert Treasure II",
    ]);
  });

  it("prices gathering quantities in configured increments", () => {
    const herb = offering("ranarr", "Ranarr gathering", 1_500, {
      quantityEnabled: true,
      quantityUnit: "herbs",
      minimumQuantity: 1_000,
      maximumQuantity: 10_000,
      pricingUnit: "per 1,000 herbs",
    });

    const result = calculateDirectOrderEstimate(
      [herb],
      [{ slug: herb.slug, quantity: 3_000 }],
    );
    expect(result.subtotalCents).toBe(4_500);
    expect(result.lines[0]?.quantityLabel).toBe("3,000 herbs");
  });

  it("supports quest search and labeled difficulty filtering", () => {
    const quest = offering("song-of-the-elves", "Song of the Elves", 6_000, {
      tierLabel: "Grandmaster",
      facets: [
        {
          facetKey: "difficulty",
          facetValue: "grandmaster",
          label: "Grandmaster",
        },
      ],
    });

    expect(
      matchesDirectOrderFilters({
        offering: quest,
        search: "song",
        activeFilter: "grandmaster",
      }),
    ).toBe(true);
    expect(
      matchesDirectOrderFilters({
        offering: quest,
        search: "dragon",
        activeFilter: "grandmaster",
      }),
    ).toBe(false);
  });

  it("implements both configured diary dependency behaviors", () => {
    const easy = offering("ardougne-easy", "Ardougne Easy", 1_000, {
      facets: [
        { facetKey: "region", facetValue: "ardougne", label: "Ardougne" },
        { facetKey: "tier", facetValue: "easy", label: "Easy" },
      ],
    });
    const hard = offering("ardougne-hard", "Ardougne Hard", 3_000, {
      facets: [
        { facetKey: "region", facetValue: "ardougne", label: "Ardougne" },
        { facetKey: "tier", facetValue: "hard", label: "Hard" },
        {
          facetKey: "dependency-behavior",
          facetValue: "auto-include",
          label: "Include earlier tiers",
        },
      ],
    });
    const explicit = {
      ...hard,
      slug: "ardougne-hard-explicit",
      facets: hard.facets.map((facet) =>
        facet.facetKey === "dependency-behavior"
          ? { ...facet, facetValue: "require-complete" }
          : facet,
      ),
    };

    expect(diaryPrerequisiteSlugs([easy, hard], hard)).toEqual([
      "ardougne-easy",
    ]);
    expect(diaryPrerequisiteSlugs([easy, explicit], explicit)).toEqual([]);
    expect(() =>
      calculateDirectOrderEstimate([easy, hard], [{ slug: hard.slug }]),
    ).toThrow(/earlier regional tiers/);
    expect(
      calculateDirectOrderEstimate(
        [easy, hard],
        [{ slug: easy.slug }, { slug: hard.slug }],
      ).subtotalCents,
    ).toBe(4_000);
    expect(
      calculateDirectOrderEstimate([easy, explicit], [{ slug: explicit.slug }])
        .subtotalCents,
    ).toBe(3_000);
  });

  it("rejects invalid quantities and oversized combined totals", () => {
    const item = offering("herbs", "Herbs", 1_000, {
      quantityEnabled: true,
      minimumQuantity: 100,
      maximumQuantity: 1_000,
    });
    for (const quantity of [0, 99, 100.5, 1_001, Number.NaN]) {
      expect(() =>
        calculateDirectOrderEstimate([item], [{ slug: item.slug, quantity }]),
      ).toThrow(/quantity must/);
    }
    const large = [
      offering("first", "First", 60_000_000),
      offering("second", "Second", 60_000_000),
    ];
    expect(() =>
      calculateDirectOrderEstimate(
        large,
        large.map(({ slug }) => ({ slug })),
      ),
    ).toThrow(/support review/);
  });

  it("rejects empty, duplicate, unavailable and invalid quantity selections", () => {
    const item = offering("configured", "Configured service", 1_000);
    expect(() => calculateDirectOrderEstimate([item], [])).toThrow(/Select/);
    expect(() =>
      calculateDirectOrderEstimate(
        [item],
        [{ slug: item.slug }, { slug: item.slug }],
      ),
    ).toThrow(/only once/);
    expect(() =>
      calculateDirectOrderEstimate([item], [{ slug: "missing" }]),
    ).toThrow(/available priced/);
  });
});

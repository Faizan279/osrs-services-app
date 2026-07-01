import { describe, expect, it } from "vitest";

import {
  featuredServices,
  feedbackPreviews,
  homepageCategories,
  homepageFaqs,
} from "@/content/homepage";
import {
  deferredPrimaryNavigation,
  primaryNavigation,
} from "@/config/public-navigation";

describe("homepage content safeguards", () => {
  it("keeps categories and FAQ prompts unique", () => {
    expect(new Set(homepageCategories.map(({ id }) => id)).size).toBe(
      homepageCategories.length,
    );
    expect(new Set(homepageFaqs.map(({ question }) => question)).size).toBe(
      homepageFaqs.length,
    );
  });

  it("uses non-fabricated pricing labels", () => {
    expect(
      featuredServices.every(({ price }) =>
        ["Custom quote", "Estimate after configuration"].includes(price),
      ),
    ).toBe(true);
  });

  it("marks every unapproved feedback item as demo content", () => {
    expect(feedbackPreviews.every(({ demo }) => demo)).toBe(true);
    expect(
      feedbackPreviews.every(({ attribution }) =>
        attribution.toLowerCase().includes("not a customer review"),
      ),
    ).toBe(true);
  });

  it("keeps Reviews out of public navigation until it has verified content", () => {
    expect(primaryNavigation.some(({ label }) => label === "Reviews")).toBe(
      false,
    );
    expect(deferredPrimaryNavigation).toEqual([
      { label: "Reviews", href: "/#reviews" },
    ]);
  });

  it("links implemented catalogue previews to real service routes", () => {
    expect(featuredServices.map(({ href }) => href)).toEqual([
      "/services/power-levelling/skill-training-request",
      "/services/quests/quest-progression",
      "/services/bossing-pvm/pvm-support",
      "/services/achievement-diaries/diary-progression",
    ]);
  });
});

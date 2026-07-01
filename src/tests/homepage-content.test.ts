import { describe, expect, it } from "vitest";

import {
  featuredServices,
  feedbackPreviews,
  homepageCategories,
  homepageFaqs,
} from "@/content/homepage";

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
});

import { describe, expect, it } from "vitest";

import { canEditCatalogue, canViewCatalogue } from "@/lib/catalogue/rules";

describe("catalogue capabilities", () => {
  it("allows a read-only catalogue role to view but not mutate", () => {
    const capabilities = ["admin.access", "products.view"];
    expect(canViewCatalogue(capabilities)).toBe(true);
    expect(canEditCatalogue(capabilities)).toBe(false);
  });

  it("requires the explicit edit capability for catalogue mutations", () => {
    expect(canEditCatalogue(new Set(["products.view", "products.edit"]))).toBe(
      true,
    );
    expect(canViewCatalogue(["admin.access", "orders.view"])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { canAccessPath, hasCapability } from "@/lib/auth/capabilities";
import { permissions } from "@/lib/auth/permissions";

describe("capability authorization", () => {
  it("denies protected routes without a session", () => {
    expect(canAccessPath("/account", null)).toBe(false);
    expect(canAccessPath("/admin", null)).toBe(false);
  });

  it("does not infer admin access from an authenticated session", () => {
    expect(canAccessPath("/admin", { capabilities: [] })).toBe(false);
  });

  it("allows Super Admin capabilities to access the admin showcase", () => {
    const superAdminCapabilities = new Set([
      "admin.access",
      "design_system.view",
    ]);
    expect(hasCapability(superAdminCapabilities, "admin.access")).toBe(true);
    expect(
      canAccessPath("/admin", { capabilities: superAdminCapabilities }),
    ).toBe(true);
    expect(
      canAccessPath("/admin/design-system", {
        capabilities: superAdminCapabilities,
      }),
    ).toBe(true);
  });

  it("requires explicit pricing publish capability for publication actions", () => {
    expect(
      hasCapability(["admin.access", "pricing.view"], permissions.pricingView),
    ).toBe(true);
    expect(
      hasCapability(
        ["admin.access", "pricing.view"],
        permissions.pricingPublish,
      ),
    ).toBe(false);
    expect(
      hasCapability(
        ["admin.access", "pricing.view", "pricing.publish"],
        permissions.pricingPublish,
      ),
    ).toBe(true);
  });
});

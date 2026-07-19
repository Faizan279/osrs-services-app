import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("catalogue route security", () => {
  it("enforces products.edit inside every catalogue mutation action", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/catalogue/actions.ts"),
      "utf8",
    );
    expect(
      source.match(/requireCapability\(\s*"products\.edit"/g)?.length,
    ).toBe(24);
  });

  it("enforces products.view on protected catalogue pages and preview", () => {
    const routes = [
      "page.tsx",
      "categories/page.tsx",
      "categories/new/page.tsx",
      "categories/[id]/page.tsx",
      "services/page.tsx",
      "services/new/page.tsx",
      "services/[id]/page.tsx",
      "services/[id]/preview/page.tsx",
      "services/[id]/revisions/page.tsx",
      "services/[id]/offerings/page.tsx",
      "services/[id]/offerings/new/page.tsx",
      "services/[id]/offerings/[offeringId]/page.tsx",
      "services/[id]/skilling/page.tsx",
      "services/[id]/skilling/methods/new/page.tsx",
      "services/[id]/skilling/methods/[methodId]/page.tsx",
      "services/[id]/bossing/page.tsx",
      "services/[id]/bossing/bosses/new/page.tsx",
      "services/[id]/bossing/bosses/[bossId]/page.tsx",
      "services/[id]/bossing/methods/new/page.tsx",
      "services/[id]/bossing/methods/[methodId]/page.tsx",
      "services/[id]/premium/page.tsx",
      "services/[id]/premium/packages/new/page.tsx",
      "services/[id]/premium/packages/[packageId]/page.tsx",
      "services/[id]/premium/options/new/page.tsx",
      "services/[id]/premium/options/[optionId]/page.tsx",
    ];
    for (const route of routes) {
      const source = readFileSync(
        path.join(process.cwd(), "src/app/(admin)/admin/catalogue", route),
        "utf8",
      );
      expect(source, route).toMatch(/requireCapability\(\s*"products\.view"/);
    }
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const resolve = vi.hoisted(() => vi.fn());
vi.mock("@/lib/checkout/adapters", () => ({ resolveCartSource: resolve }));
vi.mock("@/lib/checkout/cart", () => ({
  sanitizeCartError: () => ({
    status: 400,
    message: "Choose an available service.",
  }),
}));
import { POST } from "@/app/api/catalogue/estimate/route";

describe("direct catalogue quote endpoint", () => {
  beforeEach(() => {
    resolve.mockReset();
  });
  it("uses the cart resolver total including published adjustments", async () => {
    resolve.mockResolvedValue({ finalTotalCents: 6500 });
    const source = {
      serviceId: "service1",
      gameMode: "NORMAL",
      selections: [{ slug: "quest" }],
    };
    const response = await POST(
      new NextRequest("http://localhost/api/catalogue/estimate", {
        method: "POST",
        body: JSON.stringify(source),
      }),
    );
    expect(resolve).toHaveBeenCalledWith({
      kind: "CATALOGUE_OFFERING_ESTIMATE",
      source,
    });
    expect(await response.json()).toEqual({ ok: true, totalCents: 6500 });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("returns a safe validation error without exposing internals", async () => {
    resolve.mockRejectedValue(new Error("private database detail"));
    const response = await POST(
      new NextRequest("http://localhost/api/catalogue/estimate", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Choose an available service.",
    });
  });
});

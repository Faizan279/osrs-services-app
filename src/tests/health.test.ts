import { describe, expect, it } from "vitest";

import { createHealthPayload, GET } from "@/app/health/route";

describe("health endpoint", () => {
  it("returns a stable healthy payload", async () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    expect(createHealthPayload(now)).toEqual({
      status: "ok",
      service: "osrs-services-app",
      timestamp: now.toISOString(),
    });

    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });
});

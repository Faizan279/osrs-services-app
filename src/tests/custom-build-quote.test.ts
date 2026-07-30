import { describe, expect, it } from "vitest";

import {
  buildQuoteRevisionSnapshot,
  normalizeQuoteRevisionSnapshot,
  quoteCanReceiveCustomerDecision,
} from "@/lib/custom-build/quote";

describe("custom build quote revisions", () => {
  it("builds immutable integer-cent quote revision snapshots", () => {
    const snapshot = buildQuoteRevisionSnapshot({
      publicQuoteNumber: "CQ-20260729-ABC123",
      revisionNumber: 1,
      expiresAt: new Date("2026-08-05T00:00:00.000Z"),
      lines: [
        {
          publicDescription: "Custom account build scope",
          quantity: 2,
          unitAmountCents: 12500,
          lineType: "SERVICE",
        },
      ],
      adjustmentsCents: 500,
      estimatedDeliveryText: "7-10 days after approval",
      includedWorkSummary: "Staff-reviewed custom build scope.",
      exclusions: "No order, payment or credential handover.",
      customerSafeTerms:
        "Quote acceptance records approval only and creates no payment.",
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
    });

    expect(snapshot.subtotalCents).toBe(25000);
    expect(snapshot.finalTotalCents).toBe(25500);
    expect(JSON.stringify(snapshot)).not.toMatch(/privateInternalNote|token/i);
  });

  it("rejects unknown quote snapshot versions and unsafe totals", () => {
    expect(() =>
      normalizeQuoteRevisionSnapshot({ schemaVersion: 999 }),
    ).toThrow(/Unknown quote revision/);
    expect(() =>
      buildQuoteRevisionSnapshot({
        publicQuoteNumber: "CQ-20260729-ABC123",
        revisionNumber: 1,
        expiresAt: new Date("2026-08-05T00:00:00.000Z"),
        lines: [
          {
            publicDescription: "Unsafe line",
            quantity: 1,
            unitAmountCents: -1,
          },
        ],
        estimatedDeliveryText: "7 days",
        includedWorkSummary: "Scope.",
        customerSafeTerms: "Terms are customer safe.",
      }),
    ).toThrow();
  });

  it("guards quote acceptance against draft, expired and superseded revisions", () => {
    expect(
      quoteCanReceiveCustomerDecision({
        status: "SENT",
        expiresAt: new Date("2026-08-05T00:00:00.000Z"),
        revisionNumber: 2,
        currentRevisionNumber: 2,
        now: new Date("2026-07-29T00:00:00.000Z"),
      }),
    ).toBe(true);
    expect(() =>
      quoteCanReceiveCustomerDecision({
        status: "DRAFT",
        expiresAt: new Date("2026-08-05T00:00:00.000Z"),
        revisionNumber: 1,
        currentRevisionNumber: 1,
      }),
    ).toThrow(/sent quote/);
    expect(() =>
      quoteCanReceiveCustomerDecision({
        status: "SENT",
        expiresAt: new Date("2026-07-01T00:00:00.000Z"),
        revisionNumber: 1,
        currentRevisionNumber: 1,
        now: new Date("2026-07-29T00:00:00.000Z"),
      }),
    ).toThrow(/expired/);
    expect(() =>
      quoteCanReceiveCustomerDecision({
        status: "SENT",
        expiresAt: new Date("2026-08-05T00:00:00.000Z"),
        revisionNumber: 1,
        currentRevisionNumber: 2,
      }),
    ).toThrow(/superseded/);
  });
});

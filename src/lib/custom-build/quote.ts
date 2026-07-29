import { z } from "zod";

import {
  CUSTOM_BUILD_QUOTE_REVISION_SCHEMA_VERSION,
  customBuildQuoteStatuses,
} from "@/lib/custom-build/constants";
import { assertMoneyCents, formatCents } from "@/lib/pricing/engine";

const MAX_MONEY_CENTS = 100_000_000;

const quoteLineInputSchema = z.object({
  publicDescription: z.string().trim().min(1).max(240),
  quantity: z.number().int().min(1).max(10_000),
  unitAmountCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
  lineType: z.string().trim().min(1).max(40).default("SERVICE"),
});

const quoteRevisionSnapshotSchema = z.object({
  schemaVersion: z.literal(CUSTOM_BUILD_QUOTE_REVISION_SCHEMA_VERSION),
  quote: z.object({
    publicQuoteNumber: z.string().min(1).max(40),
    revisionNumber: z.number().int().min(1),
    currencyCode: z.string().length(3),
    expiresAt: z.iso.datetime(),
  }),
  lines: z.array(
    z.object({
      publicDescription: z.string().min(1).max(240),
      quantity: z.number().int().min(1),
      unitAmountCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
      lineTotalCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
      lineType: z.string().min(1).max(40),
      sortOrder: z.number().int().min(0),
    }),
  ),
  subtotalCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
  adjustmentsCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
  finalTotalCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
  estimatedDeliveryText: z.string().min(1).max(240),
  includedWorkSummary: z.string().min(1),
  exclusions: z.string().nullable(),
  customerSafeTerms: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export class CustomBuildQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomBuildQuoteError";
  }
}

export type CustomBuildQuoteLineInput = z.input<typeof quoteLineInputSchema>;
export type CustomBuildQuoteRevisionSnapshotV1 = z.infer<
  typeof quoteRevisionSnapshotSchema
>;

function checkedMultiply(quantity: number, unitAmountCents: number) {
  assertMoneyCents(unitAmountCents, "Unit amount");
  const total = quantity * unitAmountCents;
  assertMoneyCents(total, "Line total");
  return total;
}

function checkedAdd(left: number, right: number) {
  const total = left + right;
  assertMoneyCents(total, "Quote total");
  return total;
}

export function buildQuoteRevisionSnapshot({
  publicQuoteNumber,
  revisionNumber,
  currencyCode = "USD",
  expiresAt,
  lines,
  adjustmentsCents = 0,
  estimatedDeliveryText,
  includedWorkSummary,
  exclusions = null,
  customerSafeTerms,
  createdAt = new Date(),
}: {
  publicQuoteNumber: string;
  revisionNumber: number;
  currencyCode?: string;
  expiresAt: Date;
  lines: CustomBuildQuoteLineInput[];
  adjustmentsCents?: number;
  estimatedDeliveryText: string;
  includedWorkSummary: string;
  exclusions?: string | null;
  customerSafeTerms: string;
  createdAt?: Date;
}) {
  if (currencyCode !== "USD") {
    throw new CustomBuildQuoteError("Unsupported quote currency.");
  }
  assertMoneyCents(adjustmentsCents, "Adjustments");
  const normalizedLines = lines.map((line, index) => {
    const parsed = quoteLineInputSchema.parse(line);
    const lineTotalCents = checkedMultiply(
      parsed.quantity,
      parsed.unitAmountCents,
    );
    return {
      ...parsed,
      lineTotalCents,
      sortOrder: (index + 1) * 10,
    };
  });
  if (!normalizedLines.length) {
    throw new CustomBuildQuoteError("Add at least one quote line.");
  }
  const subtotalCents = normalizedLines.reduce(
    (total, line) => checkedAdd(total, line.lineTotalCents),
    0,
  );
  const finalTotalCents = checkedAdd(subtotalCents, adjustmentsCents);
  const snapshot = {
    schemaVersion: CUSTOM_BUILD_QUOTE_REVISION_SCHEMA_VERSION,
    quote: {
      publicQuoteNumber,
      revisionNumber,
      currencyCode,
      expiresAt: expiresAt.toISOString(),
    },
    lines: normalizedLines,
    subtotalCents,
    adjustmentsCents,
    finalTotalCents,
    estimatedDeliveryText,
    includedWorkSummary,
    exclusions,
    customerSafeTerms,
    createdAt: createdAt.toISOString(),
  };
  return normalizeQuoteRevisionSnapshot(snapshot);
}

export function normalizeQuoteRevisionSnapshot(
  value: unknown,
): CustomBuildQuoteRevisionSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new CustomBuildQuoteError("Quote revision snapshot is malformed.");
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new CustomBuildQuoteError(
      "Unknown quote revision snapshot schema version.",
    );
  }
  const parsed = quoteRevisionSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new CustomBuildQuoteError("Quote revision snapshot is malformed.");
  }
  return parsed.data;
}

export function quoteCanReceiveCustomerDecision({
  status,
  expiresAt,
  revisionNumber,
  currentRevisionNumber,
  now = new Date(),
}: {
  status: (typeof customBuildQuoteStatuses)[number];
  expiresAt: Date | null;
  revisionNumber: number;
  currentRevisionNumber: number;
  now?: Date;
}) {
  if (status !== "SENT") {
    throw new CustomBuildQuoteError("Only a sent quote can be accepted.");
  }
  if (!expiresAt || expiresAt <= now) {
    throw new CustomBuildQuoteError("This quote has expired.");
  }
  if (revisionNumber !== currentRevisionNumber) {
    throw new CustomBuildQuoteError("This quote revision was superseded.");
  }
  return true;
}

export function publicQuoteTotal(snapshot: CustomBuildQuoteRevisionSnapshotV1) {
  return formatCents(snapshot.finalTotalCents, snapshot.quote.currencyCode);
}

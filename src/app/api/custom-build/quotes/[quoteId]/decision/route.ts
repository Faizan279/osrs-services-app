import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CustomBuildSecurityError } from "@/lib/custom-build/security";
import { CustomBuildQuoteError } from "@/lib/custom-build/quote";
import { recordCustomerQuoteDecisionByToken } from "@/lib/custom-build/server";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  token: z.string().trim().min(32).max(120),
  revisionNumber: z.number().int().min(1),
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  customerMessage: z.string().trim().max(500).optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ quoteId: string }> },
) {
  try {
    const { quoteId } = await context.params;
    const body = await request.json();
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          ok: false,
          message:
            parsed.error.issues[0]?.message ?? "Check the quote decision.",
        },
        400,
      );
    }
    const result = await recordCustomerQuoteDecisionByToken({
      quoteId,
      ...parsed.data,
    });
    return json({ ok: true, status: result.status });
  } catch (error) {
    if (
      error instanceof CustomBuildSecurityError ||
      error instanceof CustomBuildQuoteError
    ) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("custom build quote decision failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      { ok: false, message: "The quote decision could not be recorded." },
      500,
    );
  }
}

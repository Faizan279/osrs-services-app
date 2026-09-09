import { NextRequest, NextResponse } from "next/server";

import { resolveCartSource } from "@/lib/checkout/adapters";
import { sanitizeCartError } from "@/lib/checkout/cart";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const estimate = await resolveCartSource({
      kind: "CATALOGUE_OFFERING_ESTIMATE",
      source: await request.json(),
    });
    return NextResponse.json(
      {
        ok: true,
        totalCents: estimate.finalTotalCents,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const safe = sanitizeCartError(error);
    return NextResponse.json(
      { ok: false, message: safe.message },
      {
        status: safe.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}

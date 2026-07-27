import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getPublicAccountListingDetail } from "@/lib/accounts/server";

export const dynamic = "force-dynamic";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ listingSlug: string }> },
) {
  try {
    const { listingSlug } = await params;
    const slug = slugSchema.parse(listingSlug);
    const data = await getPublicAccountListingDetail(slug);
    if (!data) return json({ ok: false, message: "Listing not found." }, 404);
    return json({ ok: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ ok: false, message: "Listing not found." }, 404);
    }
    console.error("account listing detail failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      { ok: false, message: "Account listing could not be loaded." },
      500,
    );
  }
}

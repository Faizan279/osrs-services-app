import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getPublicProductDetail } from "@/lib/products/server";

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
  { params }: { params: Promise<{ productSlug: string }> },
) {
  try {
    const { productSlug } = await params;
    const slug = slugSchema.parse(productSlug);
    const data = await getPublicProductDetail(slug);
    if (!data) return json({ ok: false, message: "Product not found." }, 404);
    return json({ ok: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ ok: false, message: "Product not found." }, 404);
    }
    console.error("product detail failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json({ ok: false, message: "Product could not be loaded." }, 500);
  }
}

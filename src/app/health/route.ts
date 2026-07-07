import { NextResponse } from "next/server";

import { createHealthPayload } from "@/lib/health";

export function GET() {
  return NextResponse.json(createHealthPayload(), {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}

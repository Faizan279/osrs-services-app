import { NextResponse } from "next/server";

export function createHealthPayload(now = new Date()) {
  return {
    status: "ok" as const,
    service: "osrs-services-app",
    timestamp: now.toISOString(),
  };
}

export function GET() {
  return NextResponse.json(createHealthPayload(), {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}

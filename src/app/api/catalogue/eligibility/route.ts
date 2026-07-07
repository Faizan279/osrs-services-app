import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import { prisma } from "@/lib/db/prisma";
import { evaluateRequirements } from "@/lib/eligibility/evaluator";
import { lookupPublicStats } from "@/lib/eligibility/lookup";
import {
  configuredRsnProvider,
  RsnNotFoundError,
  RsnProviderDataError,
  RsnProviderUnavailableError,
} from "@/lib/eligibility/provider";
import {
  consumePublicLookupLimit,
  requestIdentity,
} from "@/lib/eligibility/rate-limit";
import { rsnSchema } from "@/lib/eligibility/rsn";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    rsn: rsnSchema,
    serviceId: z
      .string()
      .min(1)
      .max(30)
      .regex(/^[a-z0-9]+$/i),
    offeringId: z
      .string()
      .min(1)
      .max(30)
      .regex(/^[a-z0-9]+$/i)
      .optional(),
  })
  .strict();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2_048)
    return response({ ok: false, message: "That request is too large." }, 413);
  let parsedBody: unknown;
  try {
    const text = await request.text();
    if (text.length > 2_048)
      return response(
        { ok: false, message: "That request is too large." },
        413,
      );
    parsedBody = JSON.parse(text);
  } catch {
    return response(
      { ok: false, message: "Enter a valid RuneScape name and try again." },
      400,
    );
  }
  const input = requestSchema.safeParse(parsedBody);
  if (!input.success) {
    return response(
      {
        ok: false,
        message:
          input.error.issues[0]?.message ?? "Check the submitted details.",
      },
      400,
    );
  }

  const enabled = await prisma.featureFlag.findUnique({
    where: { key: "rsn_eligibility_enabled" },
    select: { enabled: true },
  });
  if (!enabled?.enabled) {
    return response(
      {
        ok: false,
        code: "DISABLED",
        message:
          "Public stats checks are temporarily unavailable. You can still review every requirement manually.",
      },
      503,
    );
  }
  if (!(await consumePublicLookupLimit(requestIdentity(request)))) {
    return response(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "Please wait a moment before checking another name.",
      },
      429,
    );
  }

  const service = await prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(),
      id: input.data.serviceId,
      engineType: "CATALOGUE_CARD",
    },
    select: {
      id: true,
      name: true,
      requirements: {
        orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
        include: {
          recommendedService: {
            include: { category: { select: { slug: true } } },
          },
        },
      },
      offerings: {
        where: { id: input.data.offeringId ?? "", isActive: true },
        take: 1,
        select: {
          id: true,
          name: true,
          requirements: {
            orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
            include: {
              recommendedService: {
                include: { category: { select: { slug: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!service || (input.data.offeringId && !service.offerings[0])) {
    return response(
      { ok: false, message: "This service option is not available." },
      404,
    );
  }

  const provider = configuredRsnProvider();
  let profile;
  let cached = false;
  try {
    const lookup = await lookupPublicStats(input.data.rsn, provider);
    profile = lookup.profile;
    cached = lookup.cached;
  } catch (error) {
    if (error instanceof RsnNotFoundError) {
      return response(
        {
          ok: false,
          code: "NOT_FOUND",
          message:
            "No public Old School RuneScape statistics were found for that name.",
        },
        404,
      );
    }
    if (
      error instanceof RsnProviderDataError ||
      error instanceof RsnProviderUnavailableError
    ) {
      return response(
        {
          ok: false,
          code: "UNAVAILABLE",
          message:
            "Public statistics could not be checked right now. Please try again shortly.",
        },
        503,
      );
    }
    return response(
      {
        ok: false,
        code: "UNAVAILABLE",
        message: "The eligibility check could not be completed safely.",
      },
      500,
    );
  }

  const offering = service.offerings[0] ?? null;
  const evaluation = evaluateRequirements(profile, [
    ...service.requirements,
    ...(offering?.requirements ?? []),
  ]);
  return response({
    ok: true,
    profile: {
      displayName: profile.displayName ?? profile.normalizedRsn,
      fetchedAt: profile.fetchedAt,
      provider: profile.provider,
      cached,
    },
    service: { id: service.id, name: service.name },
    offering: offering ? { id: offering.id, name: offering.name } : null,
    ...evaluation,
  });
}

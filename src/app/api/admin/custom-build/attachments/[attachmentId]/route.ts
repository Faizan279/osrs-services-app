import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { hasCapability } from "@/lib/auth/capabilities";
import { getCurrentSession } from "@/lib/auth/session";
import { CustomBuildAttachmentError } from "@/lib/custom-build/attachments";
import { safeCustomBuildJson } from "@/lib/custom-build/estimate";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function resolvePrivateAttachmentPath(
  storageRoot: string,
  storageFilename: string,
) {
  const root = path.resolve(storageRoot);
  const filePath = path.resolve(root, storageFilename);
  const rootWithSeparator = root.endsWith(path.sep)
    ? root
    : `${root}${path.sep}`;
  if (
    root.replaceAll("\\", "/").includes("/public/") ||
    (!filePath.startsWith(rootWithSeparator) && filePath !== root)
  ) {
    throw new CustomBuildAttachmentError(
      "Private attachment storage is not safe.",
    );
  }
  return filePath;
}

function contentDisposition(filename: string) {
  const fallback =
    filename
      .replace(/["\\;\r\n]/g, "_")
      .replace(/[^\x20-\x7e]/g, "_")
      .slice(0, 120) || "attachment";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return json({ ok: false, message: "Sign in required." }, 401);
  }
  if (
    !hasCapability(session.capabilities, "custom_builds.attachments.review")
  ) {
    return json({ ok: false, message: "Forbidden." }, 403);
  }

  try {
    const { attachmentId } = await context.params;
    const attachment = await prisma.customBuildAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        requestId: true,
        originalFilename: true,
        storageFilename: true,
        storageRoot: true,
        detectedMime: true,
        status: true,
        scanStatus: true,
      },
    });
    if (!attachment) {
      return json({ ok: false, message: "Attachment was not found." }, 404);
    }

    const filePath = resolvePrivateAttachmentPath(
      attachment.storageRoot,
      attachment.storageFilename,
    );
    const bytes = await readFile(filePath);
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "custom_build.attachment.downloaded",
        targetType: "CustomBuildAttachment",
        targetId: attachment.id,
        metadata: safeCustomBuildJson({
          requestId: attachment.requestId,
          status: attachment.status,
          scanStatus: attachment.scanStatus,
        }) as Prisma.InputJsonValue,
      },
    });

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": contentDisposition(attachment.originalFilename),
        "Content-Length": String(bytes.byteLength),
        "Content-Type": "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return json({ ok: false, message: "Attachment was not found." }, 404);
    }
    if (error instanceof CustomBuildAttachmentError) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("custom build attachment download failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      { ok: false, message: "Attachment could not be downloaded." },
      500,
    );
  }
}

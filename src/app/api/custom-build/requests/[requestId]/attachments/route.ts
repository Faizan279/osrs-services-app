import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import {
  CustomBuildAttachmentError,
  validateAttachment,
} from "@/lib/custom-build/attachments";
import {
  CUSTOM_BUILD_PRIVATE_ATTACHMENT_ENV,
  DEFAULT_CUSTOM_BUILD_PRIVATE_ATTACHMENT_ROOT,
} from "@/lib/custom-build/constants";
import { hashSecret, timingSafeHashEquals } from "@/lib/custom-build/security";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function privateRoot() {
  const configured =
    process.env[CUSTOM_BUILD_PRIVATE_ATTACHMENT_ENV] ||
    DEFAULT_CUSTOM_BUILD_PRIVATE_ATTACHMENT_ROOT;
  const resolved = path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
  const publicRoot = path.join(process.cwd(), "public");
  const publicRootWithSeparator = publicRoot.endsWith(path.sep)
    ? publicRoot
    : `${publicRoot}${path.sep}`;
  if (resolved === publicRoot || resolved.startsWith(publicRootWithSeparator)) {
    throw new CustomBuildAttachmentError(
      "Private attachment storage cannot be inside public assets.",
    );
  }
  return resolved;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId } = await context.params;
    const form = await request.formData();
    const token = String(form.get("token") ?? "");
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ ok: false, message: "Choose an attachment file." }, 400);
    }
    const tokenHash = hashSecret(token);
    const buildRequest = await prisma.customBuildRequest.findUnique({
      where: { id: requestId },
      include: { service: true, attachments: true },
    });
    if (
      !buildRequest ||
      !timingSafeHashEquals(buildRequest.trackingTokenHash, tokenHash)
    ) {
      return json({ ok: false, message: "Attachment link is invalid." }, 404);
    }
    if (
      buildRequest.attachments.length >= buildRequest.service.maxAttachments
    ) {
      return json({ ok: false, message: "Attachment limit reached." }, 400);
    }
    const currentTotal = buildRequest.attachments.reduce(
      (total, attachment) => total + attachment.sizeBytes,
      0,
    );
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (
      currentTotal + bytes.byteLength >
      buildRequest.service.maxTotalAttachmentBytes
    ) {
      return json(
        { ok: false, message: "Total attachment size is too large." },
        400,
      );
    }
    const root = privateRoot();
    const attachment = validateAttachment(
      {
        originalFilename: file.name,
        mimeType: file.type,
        bytes,
      },
      {
        maxFiles: buildRequest.service.maxAttachments,
        maxFileBytes: buildRequest.service.maxAttachmentBytes,
        maxTotalBytes: buildRequest.service.maxTotalAttachmentBytes,
        privateRoot: root,
      },
    );
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, attachment.storageFilename), bytes);
    const record = await prisma.customBuildAttachment.create({
      data: {
        stableKey: `custom-attachment-${crypto.randomUUID()}`,
        requestId,
        originalFilename: attachment.originalFilename,
        storageFilename: attachment.storageFilename,
        storageRoot: attachment.storageRoot,
        detectedMime: attachment.detectedMime,
        extension: attachment.extension,
        sizeBytes: attachment.sizeBytes,
        sha256: attachment.sha256,
        status: "QUARANTINED",
        scanStatus: "NOT_SCANNED",
      },
      select: {
        id: true,
        originalFilename: true,
        detectedMime: true,
        sizeBytes: true,
        status: true,
        scanStatus: true,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "custom_build.attachment.uploaded",
        targetType: "CustomBuildAttachment",
        targetId: record.id,
        metadata: {
          requestId,
          sizeBytes: record.sizeBytes,
          detectedMime: record.detectedMime,
          scanStatus: record.scanStatus,
        },
      },
    });
    return json({ ok: true, attachment: record });
  } catch (error) {
    if (error instanceof CustomBuildAttachmentError) {
      return json({ ok: false, message: error.message }, 400);
    }
    console.error("custom build attachment upload failed", {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return json(
      { ok: false, message: "Attachment could not be uploaded." },
      500,
    );
  }
}

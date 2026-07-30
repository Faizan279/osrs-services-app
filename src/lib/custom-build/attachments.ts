import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

import {
  allowedCustomBuildAttachmentMimes,
  DEFAULT_CUSTOM_BUILD_PRIVATE_ATTACHMENT_ROOT,
} from "@/lib/custom-build/constants";

export class CustomBuildAttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomBuildAttachmentError";
  }
}

export type AttachmentPolicy = {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  privateRoot?: string;
};

export type AttachmentValidationInput = {
  originalFilename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type ValidatedAttachment = {
  originalFilename: string;
  storageFilename: string;
  storageRoot: string;
  detectedMime: (typeof allowedCustomBuildAttachmentMimes)[number];
  extension: ".png" | ".jpg" | ".jpeg" | ".webp" | ".pdf";
  sizeBytes: number;
  sha256: string;
};

const allowedExtensionsByMime = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
} as const;

function sanitizeOriginalFilename(value: string) {
  const base = path.basename(value.normalize("NFKC")).replace(/[^\w .-]/g, "_");
  const compact = base.replace(/\s+/g, " ").trim();
  return (compact || "attachment").slice(0, 180);
}

function extensionFor(filename: string) {
  return path.extname(filename).toLowerCase();
}

function isInsidePublicRoot(storageRoot: string) {
  const resolved = path.resolve(storageRoot);
  const publicRoot = path.resolve(process.cwd(), "public");
  const publicRootWithSeparator = publicRoot.endsWith(path.sep)
    ? publicRoot
    : `${publicRoot}${path.sep}`;
  return (
    resolved === publicRoot || resolved.startsWith(publicRootWithSeparator)
  );
}

function detectedMime(bytes: Uint8Array) {
  const textPrefix = Buffer.from(bytes.slice(0, 256)).toString("utf8");
  if (
    textPrefix.trimStart().startsWith("<svg") ||
    textPrefix.trimStart().startsWith("<!doctype html") ||
    textPrefix.trimStart().startsWith("<html") ||
    /<script[\s>]/i.test(textPrefix)
  ) {
    throw new CustomBuildAttachmentError(
      "SVG, HTML and script-like files are not accepted.",
    );
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png" as const;
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg" as const;
  }
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.slice(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.slice(8, 12)).toString("ascii") === "WEBP"
  ) {
    return "image/webp" as const;
  }
  if (
    bytes.length >= 5 &&
    Buffer.from(bytes.slice(0, 5)).toString("ascii") === "%PDF-"
  ) {
    return "application/pdf" as const;
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    throw new CustomBuildAttachmentError("Archives are not accepted.");
  }
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    throw new CustomBuildAttachmentError("Executable files are not accepted.");
  }
  throw new CustomBuildAttachmentError(
    "Attachment type must be PNG, JPEG, WebP or PDF.",
  );
}

export function validateAttachmentBatch(
  files: AttachmentValidationInput[],
  policy: AttachmentPolicy,
) {
  if (files.length > policy.maxFiles) {
    throw new CustomBuildAttachmentError(
      `Upload no more than ${policy.maxFiles} files.`,
    );
  }
  let total = 0;
  return files.map((file) => {
    total += file.bytes.byteLength;
    if (total > policy.maxTotalBytes) {
      throw new CustomBuildAttachmentError(
        "Total attachment size is too large.",
      );
    }
    return validateAttachment(file, policy);
  });
}

export function validateAttachment(
  input: AttachmentValidationInput,
  policy: AttachmentPolicy,
): ValidatedAttachment {
  if (
    input.originalFilename.includes("..") ||
    /[\\/]/.test(input.originalFilename)
  ) {
    throw new CustomBuildAttachmentError("Attachment filename is not safe.");
  }
  const originalFilename = sanitizeOriginalFilename(input.originalFilename);
  if (originalFilename.includes("..") || /[\\/]/.test(originalFilename)) {
    throw new CustomBuildAttachmentError("Attachment filename is not safe.");
  }
  const extension = extensionFor(originalFilename);
  const unsafeExtensionPattern =
    /\.(svg|html?|js|mjs|cjs|exe|dll|bat|cmd|ps1|zip|rar|7z|tar|gz|docm|xlsm|pptm)$/i;
  if (unsafeExtensionPattern.test(originalFilename)) {
    throw new CustomBuildAttachmentError(
      "This attachment type is not accepted.",
    );
  }
  const sizeBytes = input.bytes.byteLength;
  if (sizeBytes <= 0) {
    throw new CustomBuildAttachmentError("Attachment is empty.");
  }
  if (sizeBytes > policy.maxFileBytes) {
    throw new CustomBuildAttachmentError("Attachment is too large.");
  }
  const mime = detectedMime(input.bytes);
  if (input.mimeType !== mime) {
    throw new CustomBuildAttachmentError(
      "Attachment MIME type does not match its file contents.",
    );
  }
  if (!allowedExtensionsByMime[mime].includes(extension as never)) {
    throw new CustomBuildAttachmentError(
      "Attachment extension does not match its file contents.",
    );
  }
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const storageRoot =
    policy.privateRoot ?? DEFAULT_CUSTOM_BUILD_PRIVATE_ATTACHMENT_ROOT;
  if (isInsidePublicRoot(storageRoot)) {
    throw new CustomBuildAttachmentError(
      "Private attachment storage must not be inside a public directory.",
    );
  }
  return {
    originalFilename,
    storageFilename: `${randomBytes(18).toString("hex")}${extension}` as string,
    storageRoot,
    detectedMime: mime,
    extension: extension as ValidatedAttachment["extension"],
    sizeBytes,
    sha256,
  };
}

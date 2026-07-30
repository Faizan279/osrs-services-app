import { describe, expect, it } from "vitest";

import {
  validateAttachment,
  validateAttachmentBatch,
} from "@/lib/custom-build/attachments";

const policy = {
  maxFiles: 5,
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  privateRoot: "storage/private/custom-build-attachments",
};

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x01, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

describe("custom build attachment validation", () => {
  it("accepts PNG, JPEG, WebP and PDF by MIME, extension and magic bytes", () => {
    expect(
      validateAttachment(
        { originalFilename: "stats.png", mimeType: "image/png", bytes: png },
        policy,
      ).detectedMime,
    ).toBe("image/png");
    expect(
      validateAttachment(
        { originalFilename: "stats.jpg", mimeType: "image/jpeg", bytes: jpeg },
        policy,
      ).extension,
    ).toBe(".jpg");
    expect(
      validateAttachment(
        { originalFilename: "stats.webp", mimeType: "image/webp", bytes: webp },
        policy,
      ).detectedMime,
    ).toBe("image/webp");
    expect(
      validateAttachment(
        {
          originalFilename: "scope.pdf",
          mimeType: "application/pdf",
          bytes: pdf,
        },
        policy,
      ).detectedMime,
    ).toBe("application/pdf");
  });

  it("rejects mismatches, unsafe types, traversal and public roots", () => {
    expect(() =>
      validateAttachment(
        { originalFilename: "stats.png", mimeType: "image/jpeg", bytes: png },
        policy,
      ),
    ).toThrow(/MIME type/);
    expect(() =>
      validateAttachment(
        {
          originalFilename: "vector.svg",
          mimeType: "image/svg+xml",
          bytes: new TextEncoder().encode("<svg></svg>"),
        },
        policy,
      ),
    ).toThrow(/not accepted|SVG/);
    expect(() =>
      validateAttachment(
        {
          originalFilename: "payload.zip",
          mimeType: "application/zip",
          bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
        },
        policy,
      ),
    ).toThrow(/not accepted|Archives/);
    expect(() =>
      validateAttachment(
        {
          originalFilename: "payload.exe",
          mimeType: "application/octet-stream",
          bytes: new Uint8Array([0x4d, 0x5a]),
        },
        policy,
      ),
    ).toThrow(/not accepted|Executable/);
    expect(() =>
      validateAttachment(
        { originalFilename: "../stats.png", mimeType: "image/png", bytes: png },
        policy,
      ),
    ).toThrow(/safe|traverse/i);
    expect(() =>
      validateAttachment(
        { originalFilename: "stats.png", mimeType: "image/png", bytes: png },
        { ...policy, privateRoot: "public/uploads" },
      ),
    ).toThrow(/public/);
  });

  it("enforces batch count and total size", () => {
    expect(() =>
      validateAttachmentBatch(
        Array.from({ length: 6 }, (_, index) => ({
          originalFilename: `file-${index}.png`,
          mimeType: "image/png",
          bytes: png,
        })),
        policy,
      ),
    ).toThrow(/no more than 5/);
    expect(() =>
      validateAttachmentBatch(
        [
          {
            originalFilename: "big.png",
            mimeType: "image/png",
            bytes: new Uint8Array(10),
          },
        ],
        { ...policy, maxTotalBytes: 5 },
      ),
    ).toThrow(/Total attachment size/);
    expect(() =>
      validateAttachment(
        {
          originalFilename: "oversized.png",
          mimeType: "image/png",
          bytes: new Uint8Array([...png, ...new Uint8Array(10)]),
        },
        { ...policy, maxFileBytes: 4 },
      ),
    ).toThrow(/too large/);
  });

  it("records integrity metadata without preserving unsafe storage names", () => {
    const first = validateAttachment(
      { originalFilename: "stats.png", mimeType: "image/png", bytes: png },
      policy,
    );
    const second = validateAttachment(
      { originalFilename: "stats.png", mimeType: "image/png", bytes: png },
      policy,
    );

    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.storageFilename).not.toBe(second.storageFilename);
    expect(first.storageFilename).not.toBe(first.originalFilename);
  });
});

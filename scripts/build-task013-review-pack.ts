import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

type ZipEntry = {
  name: string;
  data: Buffer;
  compressed: Buffer;
  crc: number;
  offset: number;
};

const outputZip = "task-013-final-review-pack.zip";
const metadataPath = path.join(
  "artifacts",
  "task-013",
  "task013-review-pack-metadata.txt",
);

const screenshotPaths = [
  "artifacts/task-013/public-cart-1440.png",
  "artifacts/task-013/public-cart-mixed-items-1440.png",
  "artifacts/task-013/public-cart-repricing-1440.png",
  "artifacts/task-013/public-checkout-1440.png",
  "artifacts/task-013/public-order-confirmation-1440.png",
  "artifacts/task-013/public-order-tracking-1440.png",
  "artifacts/task-013/public-checkout-mobile-390.png",
  "artifacts/task-013/admin-orders-overview-1440.png",
  "artifacts/task-013/admin-order-detail-1440.png",
  "artifacts/task-013/admin-order-payment-review-1440.png",
] as const;

const requiredExtraPaths = [
  ".env.example",
  ".github/workflows/task013-validation.yml",
  "changed-files.txt",
  "scripts/validate-task013-fresh-db.ts",
  "scripts/validate-task013-existing-db.ts",
  "scripts/validate-task013-transactions.ts",
  "scripts/capture-task-013.ts",
  "scripts/build-task013-review-pack.ts",
  "reports/CODEX-TASK-013-COMPLETION.md",
  "tasks/CODEX-TASK-013.md",
  "task-013-review-summary.txt",
  "prisma/schema.prisma",
  "prisma/migrations/20260731150000_task013_cart_guest_checkout/migration.sql",
  "prisma/checkout-seed.ts",
  "prisma/seed-core.ts",
  "prisma/seed.ts",
  "src/lib/auth/permissions.ts",
  "src/lib/checkout/admin.ts",
  "src/lib/checkout/adapters.ts",
  "src/lib/checkout/cart.ts",
  "src/lib/checkout/constants.ts",
  "src/lib/checkout/orders.ts",
  "src/lib/checkout/security.ts",
  "src/app/api/cart/route.ts",
  "src/app/api/cart/items/route.ts",
  "src/app/api/cart/items/[itemId]/route.ts",
  "src/app/api/cart/revalidate/route.ts",
  "src/app/api/checkout/route.ts",
  "src/app/(public)/cart/page.tsx",
  "src/app/(public)/checkout/page.tsx",
  "src/app/(public)/checkout/confirmation/[token]/page.tsx",
  "src/app/(public)/orders/track/[token]/page.tsx",
  "src/app/(admin)/admin/orders/actions.ts",
  "src/app/(admin)/admin/orders/page.tsx",
  "src/app/(admin)/admin/orders/[orderId]/page.tsx",
  "src/app/(admin)/admin/checkout/actions.ts",
  "src/app/(admin)/admin/checkout/page.tsx",
  "src/app/(admin)/admin/checkout/payment-methods/page.tsx",
  "src/components/cart-controls.tsx",
  "src/components/checkout-form.tsx",
  "src/components/order-public-summary.tsx",
  "src/components/product-estimate-panel.tsx",
  "src/components/admin-nav.tsx",
  "src/components/public-header.tsx",
  "src/tests/checkout-security.test.ts",
  "src/tests/seed-idempotence.test.ts",
  "tests/e2e/task013.spec.ts",
  "artifacts/task-013/task013-fresh-database-validation.txt",
  "artifacts/task-013/task013-checkout-transaction-validation.txt",
  "artifacts/task-013/task012-to-task013-validation.txt",
  ...screenshotPaths,
] as const;

const pngSignature = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const disallowedPathPatterns = [
  /^\.env$/,
  /^node_modules\//,
  /^\.git\//,
  /^storage\/private\//,
  /^playwright-report\//,
  /^test-results\//,
  /^task-013-final-review-pack\.zip$/,
  /mysql.*data/i,
  /database.*files/i,
];

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(data: Buffer) {
  let value = 0xffffffff;
  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xff]! ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function normalizeEntryName(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function assertAllowed(entryName: string) {
  if (disallowedPathPatterns.some((pattern) => pattern.test(entryName))) {
    throw new Error(`Disallowed review-pack entry: ${entryName}`);
  }
}

function expectedScreenshotSize(screenshotPath: string) {
  return screenshotPath.includes("-390.png")
    ? { width: 390, height: 844 }
    : { width: 1440, height: 1000 };
}

function readPngSize(screenshotPath: string, data: Buffer) {
  if (data.length < 24 || !data.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Screenshot is not a valid PNG: ${screenshotPath}`);
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

async function verifyScreenshots() {
  for (const screenshotPath of screenshotPaths) {
    const absolutePath = path.join(process.cwd(), screenshotPath);
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile() || fileStat.size <= 0) {
      throw new Error(`Screenshot is missing or empty: ${screenshotPath}`);
    }
    const data = await readFile(absolutePath);
    const actualSize = readPngSize(screenshotPath, data);
    const expectedSize = expectedScreenshotSize(screenshotPath);
    if (
      actualSize.width !== expectedSize.width ||
      actualSize.height !== expectedSize.height
    ) {
      throw new Error(
        `Screenshot has unexpected dimensions: ${screenshotPath} ` +
          `expected ${expectedSize.width}x${expectedSize.height}, ` +
          `received ${actualSize.width}x${actualSize.height}`,
      );
    }
  }
  console.log("Task 013 screenshot verification passed.");
}

async function readChangedFiles() {
  const content = await readFile("changed-files.txt", "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => normalizeEntryName(line.trim()))
    .filter(Boolean);
}

function dosDateTime() {
  const year = 2026;
  const month = 7;
  const day = 31;
  const date = ((year - 1980) << 9) | (month << 5) | day;
  return { date, time: 0 };
}

function writeUInt16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function localHeader(entry: ZipEntry) {
  const name = Buffer.from(entry.name, "utf8");
  const { date, time } = dosDateTime();
  return Buffer.concat([
    writeUInt32(0x04034b50),
    writeUInt16(20),
    writeUInt16(0x0800),
    writeUInt16(8),
    writeUInt16(time),
    writeUInt16(date),
    writeUInt32(entry.crc),
    writeUInt32(entry.compressed.length),
    writeUInt32(entry.data.length),
    writeUInt16(name.length),
    writeUInt16(0),
    name,
  ]);
}

function centralDirectoryHeader(entry: ZipEntry) {
  const name = Buffer.from(entry.name, "utf8");
  const { date, time } = dosDateTime();
  return Buffer.concat([
    writeUInt32(0x02014b50),
    writeUInt16(0x0314),
    writeUInt16(20),
    writeUInt16(0x0800),
    writeUInt16(8),
    writeUInt16(time),
    writeUInt16(date),
    writeUInt32(entry.crc),
    writeUInt32(entry.compressed.length),
    writeUInt32(entry.data.length),
    writeUInt16(name.length),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt32(0o100644 << 16),
    writeUInt32(entry.offset),
    name,
  ]);
}

function endOfCentralDirectory(
  entryCount: number,
  centralSize: number,
  offset: number,
) {
  return Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entryCount),
    writeUInt16(entryCount),
    writeUInt32(centralSize),
    writeUInt32(offset),
    writeUInt16(0),
  ]);
}

function assertNoPrivateText(entryName: string, data: Buffer) {
  if (entryName.endsWith(".png")) return;
  const text = data.toString("utf8");
  const realEmailPattern =
    /\b[A-Z0-9._%+-]+@(?!example\.(?:com|net|org|test)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  if (realEmailPattern.test(text)) {
    throw new Error(`Real-looking email detected in review pack: ${entryName}`);
  }
}

async function createEntries(pathsToInclude: string[]) {
  let offset = 0;
  const entries: ZipEntry[] = [];
  for (const filePath of pathsToInclude) {
    const entryName = normalizeEntryName(filePath);
    assertAllowed(entryName);
    const sourcePath = path.join(process.cwd(), entryName);
    const fileStat = await stat(sourcePath);
    if (!fileStat.isFile()) {
      throw new Error(`Review-pack path is not a file: ${entryName}`);
    }
    const data = await readFile(sourcePath);
    assertNoPrivateText(entryName, data);
    const compressed = deflateRawSync(data, { level: 9 });
    const entry = {
      name: entryName,
      data,
      compressed,
      crc: crc32(data),
      offset,
    } satisfies ZipEntry;
    entries.push(entry);
    offset += localHeader(entry).length + compressed.length;
  }
  return entries;
}

async function buildReviewPack() {
  await verifyScreenshots();
  const changedFiles = await readChangedFiles();
  const pathsToInclude = Array.from(
    new Set([...changedFiles, ...requiredExtraPaths].map(normalizeEntryName)),
  ).sort((left, right) => left.localeCompare(right));
  if (pathsToInclude.includes(".env")) {
    throw new Error(".env must not be included in the review pack.");
  }
  for (const changedFile of changedFiles) {
    if (!pathsToInclude.includes(changedFile)) {
      throw new Error(`Changed file missing from review pack: ${changedFile}`);
    }
  }
  for (const screenshotPath of screenshotPaths) {
    if (!pathsToInclude.includes(screenshotPath)) {
      throw new Error(`Screenshot missing from review pack: ${screenshotPath}`);
    }
  }
  if (!pathsToInclude.includes(".env.example")) {
    throw new Error(".env.example missing from review pack.");
  }

  const entries = await createEntries(pathsToInclude);
  const localParts: Buffer[] = [];
  for (const entry of entries) {
    localParts.push(localHeader(entry), entry.compressed);
  }
  const centralParts = entries.map((entry) => centralDirectoryHeader(entry));
  const localContent = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const zip = Buffer.concat([
    localContent,
    centralDirectory,
    endOfCentralDirectory(
      entries.length,
      centralDirectory.length,
      localContent.length,
    ),
  ]);
  await writeFile(outputZip, zip);

  const metadata = [
    "Task 013 final review pack metadata",
    "",
    `Path: ${outputZip}`,
    `SHA-256: ${createHash("sha256").update(zip).digest("hex")}`,
    `Size bytes: ${zip.length}`,
    `Entry count: ${entries.length}`,
    ".env excluded: true",
    "Review ZIP self-included: false",
    "Duplicate entries: false",
    "Non-test real contact data detected: false",
    "",
  ].join("\n");
  await writeFile(metadataPath, metadata, "utf8");
  console.log(metadata);
}

if (process.argv.includes("--verify-screenshots")) {
  verifyScreenshots().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  buildReviewPack().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

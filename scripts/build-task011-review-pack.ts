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

const outputZip = "task-011-final-review-pack.zip";
const metadataPath = path.join(
  "artifacts",
  "task-011",
  "task011-review-pack-metadata.txt",
);

const screenshotPaths = [
  "artifacts/task-011/public-custom-build-1440.png",
  "artifacts/task-011/public-custom-build-estimate-1440.png",
  "artifacts/task-011/public-custom-build-partial-review-1440.png",
  "artifacts/task-011/public-custom-build-request-confirmation-1440.png",
  "artifacts/task-011/public-custom-build-tracking-1440.png",
  "artifacts/task-011/public-custom-build-mobile-390.png",
  "artifacts/task-011/admin-custom-build-overview-1440.png",
  "artifacts/task-011/admin-custom-build-config-1440.png",
  "artifacts/task-011/admin-custom-build-request-review-1440.png",
  "artifacts/task-011/admin-custom-build-quote-editor-1440.png",
] as const;

const requiredExtraPaths = [
  ".env.example",
  ".github/workflows/task011-validation.yml",
  "changed-files.txt",
  "scripts/validate-task011-fresh-db.ts",
  "scripts/validate-task011-existing-db.ts",
  "scripts/capture-task-011.ts",
  "scripts/build-task011-review-pack.ts",
  "reports/CODEX-TASK-011-COMPLETION.md",
  "tasks/CODEX-TASK-011.md",
  "task-011-review-summary.txt",
  "prisma/schema.prisma",
  "prisma/migrations/20260728150000_task011_custom_account_build/migration.sql",
  "prisma/custom-build-seed.ts",
  "prisma/seed-core.ts",
  "prisma/seed.ts",
  "src/lib/auth/permissions.ts",
  "src/lib/custom-build/constants.ts",
  "src/lib/custom-build/security.ts",
  "src/lib/custom-build/attachments.ts",
  "src/lib/custom-build/estimate.ts",
  "src/lib/custom-build/quote.ts",
  "src/lib/custom-build/server.ts",
  "src/lib/custom-build/admin.ts",
  "src/app/api/custom-build/estimate/route.ts",
  "src/app/api/custom-build/requests/route.ts",
  "src/app/api/custom-build/requests/[requestId]/attachments/route.ts",
  "src/app/api/custom-build/quotes/[quoteId]/decision/route.ts",
  "src/app/api/admin/custom-build/attachments/[attachmentId]/route.ts",
  "src/app/(public)/custom-account-build/page.tsx",
  "src/app/(public)/custom-account-build/track/[token]/page.tsx",
  "src/components/custom-build-engine.tsx",
  "src/components/custom-build-admin.tsx",
  "src/components/admin-nav.tsx",
  "src/config/public-navigation.ts",
  "src/app/(admin)/admin/custom-builds/actions.ts",
  "src/app/(admin)/admin/custom-builds/page.tsx",
  "src/app/(admin)/admin/custom-builds/config/page.tsx",
  "src/app/(admin)/admin/custom-builds/rules/page.tsx",
  "src/app/(admin)/admin/custom-builds/objectives/page.tsx",
  "src/app/(admin)/admin/custom-builds/requests/page.tsx",
  "src/app/(admin)/admin/custom-builds/requests/[requestId]/page.tsx",
  "src/app/(admin)/admin/custom-builds/requests/[requestId]/attachments/page.tsx",
  "src/app/(admin)/admin/custom-builds/requests/[requestId]/quote/page.tsx",
  "src/app/(admin)/admin/custom-builds/requests/[requestId]/history/page.tsx",
  "src/app/(admin)/admin/custom-builds/revisions/page.tsx",
  "src/app/(admin)/admin/custom-builds/preview/page.tsx",
  "src/tests/custom-build-estimate.test.ts",
  "src/tests/custom-build-security.test.ts",
  "src/tests/custom-build-attachments.test.ts",
  "src/tests/custom-build-quote.test.ts",
  "src/tests/seed-idempotence.test.ts",
  "tests/e2e/task011.spec.ts",
  "artifacts/task-011/task011-fresh-database-validation.txt",
  "artifacts/task-011/task010-to-task011-validation.txt",
  ...screenshotPaths,
] as const;

const disallowedPathPatterns = [
  /^\.env$/,
  /^node_modules\//,
  /^\.git\//,
  /^storage\/private\//,
  /^playwright-report\//,
  /^test-results\//,
  /^task-011-final-review-pack\.zip$/,
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

async function verifyScreenshots() {
  for (const screenshotPath of screenshotPaths) {
    const fileStat = await stat(path.join(process.cwd(), screenshotPath));
    if (!fileStat.isFile() || fileStat.size <= 0) {
      throw new Error(`Screenshot is missing or empty: ${screenshotPath}`);
    }
  }
  console.log("Task 011 screenshot verification passed.");
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
  const day = 29;
  const hours = 0;
  const minutes = 0;
  const seconds = 0;
  const date = ((year - 1980) << 9) | (month << 5) | day;
  const time = (hours << 11) | (minutes << 5) | Math.floor(seconds / 2);
  return { date, time };
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
    /\b[A-Z0-9._%+-]+@(?!example\.test\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const literalTrackingUrlPattern =
    /custom-account-build\/track\/[A-Za-z0-9_-]{32,}/;
  if (realEmailPattern.test(text)) {
    throw new Error(`Real-looking email detected in review pack: ${entryName}`);
  }
  if (literalTrackingUrlPattern.test(text)) {
    throw new Error(`Raw tracking URL detected in review pack: ${entryName}`);
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
  if (pathsToInclude.length !== new Set(pathsToInclude).size) {
    throw new Error("Duplicate review-pack entries were requested.");
  }
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
    "Task 011 final review pack metadata",
    "",
    `Path: ${outputZip}`,
    `SHA-256: ${createHash("sha256").update(zip).digest("hex")}`,
    `Size bytes: ${zip.length}`,
    `Entry count: ${entries.length}`,
    ".env excluded: true",
    "Private attachment bytes excluded: true",
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

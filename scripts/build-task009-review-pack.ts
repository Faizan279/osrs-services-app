import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

type ZipEntry = {
  name: string;
  sourcePath: string;
  data: Buffer;
  compressed: Buffer;
  crc: number;
  offset: number;
};

const outputZip = "task-009-final-review-pack.zip";
const metadataPath = path.join(
  "artifacts",
  "task-009",
  "task009-review-pack-metadata.txt",
);

const screenshotPaths = [
  "artifacts/task-009/public-gold-buy-1440.png",
  "artifacts/task-009/public-gold-sell-1440.png",
  "artifacts/task-009/public-gold-buy-estimate-1440.png",
  "artifacts/task-009/public-gold-manual-review-1440.png",
  "artifacts/task-009/public-gold-unavailable-1440.png",
  "artifacts/task-009/public-gold-mobile-390.png",
  "artifacts/task-009/admin-gold-overview-1440.png",
  "artifacts/task-009/admin-gold-rate-editor-1440.png",
  "artifacts/task-009/admin-gold-inventory-1440.png",
  "artifacts/task-009/admin-gold-history-1440.png",
] as const;

const requiredExtraPaths = [
  ".env.example",
  ".github/workflows/task009-validation.yml",
  "changed-files.txt",
  "scripts/validate-task009-fresh-db.ts",
  "scripts/validate-task009-existing-db.ts",
  "scripts/capture-task-009.ts",
  "scripts/build-task009-review-pack.ts",
  "reports/CODEX-TASK-009-COMPLETION.md",
  "tasks/CODEX-TASK-009.md",
  "task-009-review-summary.txt",
  "prisma/schema.prisma",
  "prisma/migrations/20260725130000_task009_gold_trading_engine/migration.sql",
  "prisma/gold-seed.ts",
  "src/lib/gold/constants.ts",
  "src/lib/gold/estimate.ts",
  "src/lib/gold/server.ts",
  "src/lib/gold/admin.ts",
  "src/app/api/gold/estimate/route.ts",
  "src/components/gold-trading-engine.tsx",
  "src/components/gold-admin.tsx",
  "src/tests/gold-estimate.test.ts",
  "src/tests/gold-route.test.ts",
  "src/tests/gold-inventory.test.ts",
  "tests/e2e/task009.spec.ts",
  "artifacts/task-009/task009-fresh-database-validation.txt",
  "artifacts/task-009/task008-to-task009-validation.txt",
  ...screenshotPaths,
] as const;

const disallowedPathPatterns = [
  /^\.env$/,
  /^node_modules\//,
  /^\.git\//,
  /credentials/i,
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
  console.log("Task 009 screenshot verification passed.");
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
  const day = 25;
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
    const compressed = deflateRawSync(data, { level: 9 });
    const entry = {
      name: entryName,
      sourcePath,
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
    "Task 009 final review pack metadata",
    "",
    `Path: ${outputZip}`,
    `SHA-256: ${createHash("sha256").update(zip).digest("hex")}`,
    `Size bytes: ${zip.length}`,
    `Entry count: ${entries.length}`,
    ".env excluded: true",
    "Credential files excluded: true",
    "Duplicate entries: false",
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

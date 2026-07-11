import { z } from "zod";

export function normalizeRsn(input: string) {
  return input
    .normalize("NFKC")
    .trim()
    .replaceAll("_", " ")
    .replace(/\s+/g, " ");
}

export const rsnSchema = z
  .string()
  .transform(normalizeRsn)
  .pipe(
    z
      .string()
      .min(1, "Enter a RuneScape name.")
      .max(12, "RuneScape names can contain at most 12 characters.")
      .regex(
        /^(?=.*[A-Za-z0-9])[A-Za-z0-9 -]+$/,
        "Use only letters, numbers, spaces, or hyphens.",
      ),
  );

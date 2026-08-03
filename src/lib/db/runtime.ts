import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma/client";

type RuntimeDatabaseEnv = Record<string, string | undefined> & {
  DATABASE_HOST?: string;
  DATABASE_PORT?: string;
  DATABASE_USER?: string;
  DATABASE_PASSWORD?: string;
  DATABASE_NAME?: string;
  DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL?: string;
};

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function databaseConfig(source: RuntimeDatabaseEnv = process.env) {
  return {
    host: source.DATABASE_HOST ?? "127.0.0.1",
    port: Number(source.DATABASE_PORT ?? 3306),
    user: required(source.DATABASE_USER, "DATABASE_USER"),
    password: required(source.DATABASE_PASSWORD, "DATABASE_PASSWORD"),
    database: required(source.DATABASE_NAME, "DATABASE_NAME"),
    allowPublicKeyRetrieval:
      source.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === "true",
  };
}

export function createRuntimePrismaClient(
  source: RuntimeDatabaseEnv = process.env,
) {
  const config = databaseConfig(source);
  const adapter = new PrismaMariaDb({
    ...config,
    connectionLimit: 5,
  });
  return new PrismaClient({ adapter });
}

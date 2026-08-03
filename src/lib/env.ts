import "server-only";

import { z } from "zod";

export const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().url().startsWith("mysql://"),
    DATABASE_HOST: z.string().min(1).default("127.0.0.1"),
    DATABASE_PORT: z.coerce.number().int().positive().default(3306),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
    DATABASE_NAME: z.string().regex(/^[A-Za-z0-9_]+$/),
    DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL: z.stringbool().default(false),
    AUTH_SECRET: z.string().min(32),
    AUTH_SESSION_COOKIE: z.string().min(1).default("osrs_session"),
    CUSTOMER_SESSION_COOKIE: z.string().min(1).default("osrs_customer_session"),
    SESSION_TTL_HOURS: z.coerce
      .number()
      .int()
      .positive()
      .max(24 * 30)
      .default(168),
    CHAT_SOCKET_PORT: z.coerce.number().int().positive().default(3001),
    CHAT_SOCKET_PATH: z.string().min(1).startsWith("/").default("/socket.io"),
    CHAT_ALLOWED_ORIGINS: z.string().min(1).default("http://127.0.0.1:3000"),
    CHAT_GUEST_COOKIE: z.string().min(1).default("osrs_chat_guest"),
    NEXT_PUBLIC_CHAT_SOCKET_URL: z.string().url().optional(),
    NEXT_PUBLIC_CHAT_SOCKET_PATH: z
      .string()
      .regex(/^\/(?!.*\.\.).+/)
      .default("/socket.io"),
    ELIGIBILITY_HMAC_SECRET: z.string().min(32).optional(),
    RSN_PROVIDER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(500)
      .max(15_000)
      .default(4_000),
    RSN_CACHE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(3_600)
      .default(300),
    RSN_NEGATIVE_CACHE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(600)
      .default(60),
    RSN_RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(3_600)
      .default(60),
    RSN_RATE_LIMIT_COUNT: z.coerce.number().int().min(1).max(100).default(8),
    RSN_TRUST_PROXY_IP_HEADER: z.stringbool().default(false),
    RSN_DEVELOPMENT_FIXTURE: z.stringbool().default(false),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && value.RSN_DEVELOPMENT_FIXTURE) {
      context.addIssue({
        code: "custom",
        path: ["RSN_DEVELOPMENT_FIXTURE"],
        message: "RSN_DEVELOPMENT_FIXTURE cannot be enabled in production.",
      });
    }
    if (
      value.CHAT_ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .includes("*")
    ) {
      context.addIssue({
        code: "custom",
        path: ["CHAT_ALLOWED_ORIGINS"],
        message: "Credentialed chat CORS cannot use wildcard origins.",
      });
    }
  });

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${z.prettifyError(parsed.error)}`,
  );
}

export const env = {
  ...parsed.data,
  ELIGIBILITY_HMAC_SECRET:
    parsed.data.ELIGIBILITY_HMAC_SECRET ?? parsed.data.AUTH_SECRET,
};

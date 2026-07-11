process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
process.env.DATABASE_HOST ??= "127.0.0.1";
process.env.DATABASE_USER ??= "test";
process.env.DATABASE_PASSWORD ??= "test";
process.env.DATABASE_NAME ??= "test";
process.env.AUTH_SECRET ??=
  "test-secret-that-is-at-least-thirty-two-characters";
process.env.ELIGIBILITY_HMAC_SECRET ??=
  "test-eligibility-secret-at-least-thirty-two-characters";
process.env.RSN_PROVIDER_TIMEOUT_MS ??= "500";
process.env.RSN_CACHE_TTL_SECONDS ??= "300";
process.env.RSN_NEGATIVE_CACHE_TTL_SECONDS ??= "60";
process.env.RSN_RATE_LIMIT_WINDOW_SECONDS ??= "60";
process.env.RSN_RATE_LIMIT_COUNT ??= "8";

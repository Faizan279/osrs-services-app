import "server-only";

type AttemptWindow = { count: number; resetAt: number };

const attempts = new Map<string, AttemptWindow>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function checkLoginRateLimit(key: string, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearLoginRateLimit(key: string) {
  attempts.delete(key);
}

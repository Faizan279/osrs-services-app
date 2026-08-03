export const CHAT_SETTINGS_STABLE_KEY = "chat-default-settings";
export const CHAT_GUEST_COOKIE_DEFAULT = "osrs_chat_guest";
export const CHAT_SOCKET_PATH_DEFAULT = "/socket.io";
export const CHAT_SOCKET_PORT_DEFAULT = 3001;
export const CHAT_ALLOWED_ORIGINS_DEFAULT = "http://127.0.0.1:3000";

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Chat numeric configuration must be a positive integer.");
  }
  return parsed;
}

function parseSocketPath(value: string | undefined) {
  const path = value?.trim() || CHAT_SOCKET_PATH_DEFAULT;
  if (!path.startsWith("/") || path.includes("..")) {
    throw new Error("CHAT_SOCKET_PATH must be an absolute socket path.");
  }
  return path;
}

function parseAllowedOrigins(value: string | undefined) {
  const origins = (value?.trim() || CHAT_ALLOWED_ORIGINS_DEFAULT)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!origins.length || origins.includes("*")) {
    throw new Error("CHAT_ALLOWED_ORIGINS must be explicit and cannot use *.");
  }
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("CHAT_ALLOWED_ORIGINS must contain HTTP(S) origins.");
    }
  }
  return origins;
}

export function chatGuestCookieName() {
  return process.env.CHAT_GUEST_COOKIE?.trim() || CHAT_GUEST_COOKIE_DEFAULT;
}

export function chatRuntimeConfig() {
  return {
    port: parsePositiveInteger(
      process.env.CHAT_SOCKET_PORT,
      CHAT_SOCKET_PORT_DEFAULT,
    ),
    path: parseSocketPath(process.env.CHAT_SOCKET_PATH),
    allowedOrigins: parseAllowedOrigins(process.env.CHAT_ALLOWED_ORIGINS),
    guestCookieName: chatGuestCookieName(),
    publicSocketUrl:
      process.env.NEXT_PUBLIC_CHAT_SOCKET_URL?.trim() ||
      `http://127.0.0.1:${CHAT_SOCKET_PORT_DEFAULT}`,
  };
}

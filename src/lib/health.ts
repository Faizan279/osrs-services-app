export function createHealthPayload(now = new Date()) {
  return {
    status: "ok" as const,
    service: "osrs-services-app",
    timestamp: now.toISOString(),
  };
}

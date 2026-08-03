import { readFile } from "node:fs/promises";

import { chatRuntimeConfig } from "../src/lib/chat/config";

async function main() {
  const config = chatRuntimeConfig();
  if (config.allowedOrigins.includes("*")) {
    throw new Error("Credentialed chat CORS cannot use wildcard origins.");
  }
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    dependencies?: Record<string, string>;
  };
  if (
    packageJson.dependencies?.["socket.io"] !== "4.8.3" ||
    packageJson.dependencies?.["socket.io-client"] !== "4.8.3"
  ) {
    throw new Error("Socket.IO dependencies must remain pinned.");
  }
  const gateway = await readFile("realtime/chat-server.ts", "utf8");
  if (/redis|kafka|rabbitmq|pubsub/i.test(gateway)) {
    throw new Error("Task 015 gateway must remain single-node.");
  }
  if (
    /query.*token|guestToken|sessionToken/i.test(gateway) &&
    !/not accepted/i.test(gateway)
  ) {
    throw new Error("Gateway must reject token/query authentication.");
  }
  console.log("Task 015 chat configuration check");
  console.log(`Socket path: ${config.path}`);
  console.log(`Socket port: ${config.port}`);
  console.log(`Allowed origins: ${config.allowedOrigins.join(", ")}`);
  console.log(`Guest cookie: ${config.guestCookieName}`);
  console.log("Single-node gateway boundary: true");
  console.log("Wildcard credentialed CORS: false");
  console.log("Redis adapter configured: false");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

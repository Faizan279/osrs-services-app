import http from "node:http";

import { Server } from "socket.io";

import { authenticateChatActorFromCookieHeader } from "@/lib/chat/auth";
import { chatRuntimeConfig } from "@/lib/chat/config";
import { ChatError, sanitizeChatError } from "@/lib/chat/security";
import { getConversation, markRead, sendMessage } from "@/lib/chat/service";
import { createRuntimePrismaClient } from "@/lib/db/runtime";

const config = chatRuntimeConfig();
const prisma = createRuntimePrismaClient();

function room(conversationId: string) {
  return `chat:conversation:${conversationId}`;
}

function safeError(error: unknown) {
  const safe = sanitizeChatError(error);
  return { ok: false, message: safe.message, status: safe.status };
}

function committedMessage(
  conversation: Awaited<ReturnType<typeof getConversation>>,
) {
  return (
    [...conversation.messages].sort(
      (left, right) => right.sequence - left.sequence,
    )[0] ?? null
  );
}

const httpServer = http.createServer((request, response) => {
  if (request.url === "/health" || request.url === "/chat/health") {
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(
      JSON.stringify({
        ok: true,
        service: "task015-chat-gateway",
        mode: "single-node",
        socketPath: config.path,
      }),
    );
    return;
  }
  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: false }));
});

const io = new Server(httpServer, {
  path: config.path,
  transports: ["polling", "websocket"],
  cors: {
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed for chat."));
    },
  },
});

io.use(async (socket, next) => {
  try {
    const unsafeQueryKeys = [
      "token",
      "sessionToken",
      "guestToken",
      "authToken",
    ];
    if (
      Object.keys(socket.handshake.auth ?? {}).length ||
      unsafeQueryKeys.some((key) => socket.handshake.query[key])
    ) {
      next(new ChatError("Socket query authentication is not accepted.", 401));
      return;
    }
    const actor = await authenticateChatActorFromCookieHeader({
      prisma,
      cookieHeader: socket.handshake.headers.cookie,
      requireRealtime: true,
    });
    socket.data.actor = actor;
    socket.data.typingTimers = new Map();
    socket.data.lastTypingAt = new Map();
    next();
  } catch (error) {
    const safe = sanitizeChatError(error);
    next(new Error(safe.message));
  }
});

io.on("connection", (socket) => {
  socket.on(
    "chat:join",
    async (
      payload: { conversationId?: string },
      ack?: (result: unknown) => void,
    ) => {
      try {
        if (!payload.conversationId)
          throw new ChatError("Conversation required.");
        const conversation = await getConversation(
          prisma,
          socket.data.actor,
          payload.conversationId,
        );
        await socket.join(room(conversation.id));
        ack?.({ ok: true, conversation });
      } catch (error) {
        ack?.(safeError(error));
      }
    },
  );

  socket.on(
    "chat:send",
    async (
      payload: {
        conversationId?: string;
        body?: unknown;
        idempotencyKey?: string;
      },
      ack?: (result: unknown) => void,
    ) => {
      try {
        if (!payload.conversationId)
          throw new ChatError("Conversation required.");
        const conversation = await sendMessage({
          prisma,
          actor: socket.data.actor,
          conversationId: payload.conversationId,
          body: payload.body,
          idempotencyKey: payload.idempotencyKey,
        });
        const message = committedMessage(conversation);
        if (message) {
          io.to(room(conversation.id)).emit("chat:message", {
            conversationId: conversation.id,
            message,
          });
        }
        ack?.({ ok: true, conversation, message });
      } catch (error) {
        ack?.(safeError(error));
      }
    },
  );

  socket.on(
    "chat:read",
    async (
      payload: { conversationId?: string; lastReadSequence?: number },
      ack?: (result: unknown) => void,
    ) => {
      try {
        if (!payload.conversationId)
          throw new ChatError("Conversation required.");
        const cursor = await markRead({
          prisma,
          actor: socket.data.actor,
          conversationId: payload.conversationId,
          lastReadSequence: Number(payload.lastReadSequence ?? 0),
        });
        ack?.({ ok: true, cursor });
      } catch (error) {
        ack?.(safeError(error));
      }
    },
  );

  socket.on(
    "chat:typing",
    async (
      payload: { conversationId?: string; typing?: boolean },
      ack?: (result: unknown) => void,
    ) => {
      try {
        if (!payload.conversationId)
          throw new ChatError("Conversation required.");
        const now = Date.now();
        const previous =
          socket.data.lastTypingAt.get(payload.conversationId) ?? 0;
        if (now - previous < 1200) {
          ack?.({ ok: true, rateLimited: true });
          return;
        }
        socket.data.lastTypingAt.set(payload.conversationId, now);
        const conversation = await getConversation(
          prisma,
          socket.data.actor,
          payload.conversationId,
        );
        const key = conversation.id;
        const existing = socket.data.typingTimers.get(key);
        if (existing) clearTimeout(existing);
        const label =
          socket.data.actor.type === "STAFF"
            ? "Support is typing"
            : "Customer is typing";
        socket.to(room(conversation.id)).emit("chat:typing", {
          conversationId: conversation.id,
          typing: Boolean(payload.typing),
          label,
        });
        if (payload.typing) {
          const timer = setTimeout(() => {
            socket.to(room(conversation.id)).emit("chat:typing", {
              conversationId: conversation.id,
              typing: false,
              label,
            });
            socket.data.typingTimers.delete(key);
          }, 8000);
          socket.data.typingTimers.set(key, timer);
        }
        ack?.({ ok: true });
      } catch (error) {
        ack?.(safeError(error));
      }
    },
  );

  socket.on("disconnect", () => {
    for (const timer of socket.data.typingTimers.values()) {
      clearTimeout(timer);
    }
    socket.data.typingTimers.clear();
    socket.data.lastTypingAt.clear();
  });
});

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(
    `Task 015 chat gateway listening on port ${config.port} at ${config.path}`,
  );
});

async function shutdown() {
  io.close();
  httpServer.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

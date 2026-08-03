import { createHash, randomBytes } from "node:crypto";

import type {
  ChatConversationStatus,
  ChatLinkSource,
  ChatParticipantType,
  ChatRedactionReason,
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import type { ChatActor } from "@/lib/chat/auth";
import { CHAT_SETTINGS_STABLE_KEY } from "@/lib/chat/config";
import {
  ChatError,
  assertNoCredentialLikeChatFields,
  chatCategorySchema,
  chatDisplayNameSchema,
  createGuestChatToken,
  guestChatCookie,
  hashChatIdempotencyKey,
  hashChatToken,
  isValidChatId,
  normalizeChatText,
  normalizeInternalNote,
  safeJson,
} from "@/lib/chat/security";
import { hashToken as hashCheckoutTrackingToken } from "@/lib/checkout/security";

type Db = PrismaClient | Prisma.TransactionClient;

const activeStatuses: ChatConversationStatus[] = [
  "QUEUED",
  "ASSIGNED",
  "WAITING_FOR_SUPPORT",
  "WAITING_FOR_CUSTOMER",
];

const publicClosedStatuses = new Set<ChatConversationStatus>([
  "CLOSED",
  "ARCHIVED",
  "SPAM",
]);

const staffStatusTargets = new Set<ChatConversationStatus>([
  "QUEUED",
  "ASSIGNED",
  "WAITING_FOR_SUPPORT",
  "WAITING_FOR_CUSTOMER",
  "RESOLVED",
  "CLOSED",
  "ARCHIVED",
  "SPAM",
]);

function can(actor: ChatActor, capability: string) {
  return actor.capabilities.has(capability);
}

function requireStaff(
  actor: ChatActor,
  capability: string,
): Extract<ChatActor, { type: "STAFF" }> {
  if (actor.type !== "STAFF" || !can(actor, capability)) {
    throw new ChatError("Staff chat permission required.", 403);
  }
  return actor;
}

function actorIdentity(actor: ChatActor) {
  if (actor.type === "GUEST") return `guest:${actor.guestSessionId}`;
  return `${actor.type.toLowerCase()}:${actor.userId}`;
}

function actorUserId(actor: ChatActor) {
  return actor.type === "GUEST" ? null : actor.userId;
}

function auditMetadata(value: Record<string, unknown>) {
  return safeJson(value) as Prisma.InputJsonValue;
}

async function featureEnabled(prisma: Db, key: string) {
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

export async function getChatSettings(prisma: Db) {
  const settings = await prisma.chatSettings.findUnique({
    where: { stableKey: CHAT_SETTINGS_STABLE_KEY },
  });
  if (!settings) throw new ChatError("Chat settings are not configured.", 503);
  return settings;
}

export async function getPublicChatAvailability(prisma: Db) {
  const [
    settings,
    liveEnabled,
    guestEnabled,
    customerEnabled,
    realtimeEnabled,
  ] = await Promise.all([
    getChatSettings(prisma),
    featureEnabled(prisma, "live_chat_enabled"),
    featureEnabled(prisma, "guest_live_chat_enabled"),
    featureEnabled(prisma, "customer_live_chat_enabled"),
    featureEnabled(prisma, "chat_realtime_enabled"),
  ]);
  return {
    liveEnabled,
    guestEnabled,
    customerEnabled,
    realtimeEnabled,
    launcherEnabled: liveEnabled && settings.publicLauncherEnabled,
    availabilityMode: settings.availabilityMode,
    offlineIntakeEnabled: settings.offlineIntakeEnabled,
    message:
      settings.availabilityMode === "ONLINE"
        ? settings.publicOnlineMessage
        : settings.availabilityMode === "MAINTENANCE"
          ? settings.publicMaintenanceMessage
          : settings.publicOfflineMessage,
    pollingFallbackIntervalSeconds: settings.pollingFallbackIntervalSeconds,
    maximumMessageLength: settings.maximumMessageLength,
    realtimeExpected: realtimeEnabled && settings.realtimeExpected,
    needsClientReview: settings.needsClientReview,
  };
}

async function assertPublicChatAvailable(prisma: Db, actor: ChatActor) {
  const settings = await getChatSettings(prisma);
  if (!(await featureEnabled(prisma, "live_chat_enabled"))) {
    throw new ChatError("Chat is currently unavailable.", 403);
  }
  if (
    actor.type === "GUEST" &&
    !(await featureEnabled(prisma, "guest_live_chat_enabled"))
  ) {
    throw new ChatError("Guest chat is currently unavailable.", 403);
  }
  if (
    actor.type === "CUSTOMER" &&
    !(await featureEnabled(prisma, "customer_live_chat_enabled"))
  ) {
    throw new ChatError("Customer chat is currently unavailable.", 403);
  }
  if (settings.availabilityMode === "MAINTENANCE") {
    throw new ChatError(settings.publicMaintenanceMessage, 403);
  }
  if (
    settings.availabilityMode === "OFFLINE" &&
    !settings.offlineIntakeEnabled
  ) {
    throw new ChatError(settings.publicOfflineMessage, 403);
  }
  return settings;
}

export async function createGuestChatSession(
  prisma: PrismaClient,
  input: {
    displayName?: unknown;
    supportCategory?: unknown;
  },
) {
  assertNoCredentialLikeChatFields(input);
  const settings = await getChatSettings(prisma);
  if (!(await featureEnabled(prisma, "live_chat_enabled"))) {
    throw new ChatError("Chat is currently unavailable.", 403);
  }
  if (!(await featureEnabled(prisma, "guest_live_chat_enabled"))) {
    throw new ChatError("Guest chat is currently unavailable.", 403);
  }
  if (settings.availabilityMode === "MAINTENANCE") {
    throw new ChatError(settings.publicMaintenanceMessage, 403);
  }
  if (
    settings.availabilityMode === "OFFLINE" &&
    !settings.offlineIntakeEnabled
  ) {
    throw new ChatError(settings.publicOfflineMessage, 403);
  }
  const rawToken = createGuestChatToken();
  const expiresAt = new Date(
    Date.now() + settings.guestSessionDurationMinutes * 60 * 1000,
  );
  const session = await prisma.chatGuestSession.create({
    data: {
      tokenHash: hashChatToken(rawToken),
      displayName: chatDisplayNameSchema.parse(input.displayName ?? ""),
      supportCategory: chatCategorySchema.parse(input.supportCategory ?? ""),
      expiresAt,
    },
    select: { id: true, displayName: true, supportCategory: true },
  });
  return {
    rawToken,
    cookie: guestChatCookie(rawToken, expiresAt),
    actor: {
      type: "GUEST" as const,
      guestSessionId: session.id,
      displayName: session.displayName,
      capabilities: new Set<string>(),
    },
    session,
  };
}

async function consumeChatRateLimit({
  prisma,
  actor,
  action,
  limit,
  windowSeconds = 60,
}: {
  prisma: Db;
  actor: ChatActor;
  action: string;
  limit: number;
  windowSeconds?: number;
}) {
  const now = new Date();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2);
  const identityKey = createHash("sha256")
    .update(`chat:${actorIdentity(actor)}`)
    .digest("hex");
  const bucket = await prisma.publicRateLimitBucket.upsert({
    where: {
      identityKey_actionKey_windowStart: {
        identityKey,
        actionKey: action.slice(0, 80),
        windowStart,
      },
    },
    create: {
      identityKey,
      actionKey: action.slice(0, 80),
      windowStart,
      expiresAt,
      count: 1,
    },
    update: { count: { increment: 1 }, expiresAt },
  });
  void prisma.publicRateLimitBucket
    .deleteMany({ where: { expiresAt: { lt: now } } })
    .catch(() => undefined);
  if (bucket.count > limit) {
    throw new ChatError("Too many chat actions. Try again shortly.", 429);
  }
}

async function openConversationCount(prisma: Db, actor: ChatActor) {
  if (actor.type === "GUEST") {
    return prisma.chatConversation.count({
      where: {
        guestSessionId: actor.guestSessionId,
        status: { in: activeStatuses },
      },
    });
  }
  if (actor.type === "CUSTOMER") {
    return prisma.chatConversation.count({
      where: {
        customerUserId: actor.userId,
        status: { in: activeStatuses },
      },
    });
  }
  return 0;
}

function generateConversationReference() {
  return `CHAT-${randomBytes(5).toString("hex").toUpperCase()}`;
}

async function nextEventSequence(prisma: Db, conversationId: string) {
  const aggregate = await prisma.chatConversationEvent.aggregate({
    where: { conversationId },
    _max: { sequence: true },
  });
  return (aggregate._max.sequence ?? 0) + 1;
}

async function nextAssignmentSequence(prisma: Db, conversationId: string) {
  const aggregate = await prisma.chatAssignmentEvent.aggregate({
    where: { conversationId },
    _max: { sequence: true },
  });
  return (aggregate._max.sequence ?? 0) + 1;
}

async function nextMessageSequence(prisma: Db, conversationId: string) {
  const aggregate = await prisma.chatMessage.aggregate({
    where: { conversationId },
    _max: { sequence: true },
  });
  return (aggregate._max.sequence ?? 0) + 1;
}

function participantType(actor: ChatActor): ChatParticipantType {
  return actor.type;
}

function messageSenderData(actor: ChatActor) {
  if (actor.type === "GUEST") {
    return {
      participantType: "GUEST" as const,
      guestSessionId: actor.guestSessionId,
      customerUserId: null,
      staffUserId: null,
    };
  }
  if (actor.type === "CUSTOMER") {
    return {
      participantType: "CUSTOMER" as const,
      customerUserId: actor.userId,
      guestSessionId: null,
      staffUserId: null,
    };
  }
  return {
    participantType: "STAFF" as const,
    staffUserId: actor.userId,
    customerUserId: null,
    guestSessionId: null,
  };
}

function accessWhere(actor: ChatActor, conversationId: string) {
  if (!isValidChatId(conversationId)) {
    throw new ChatError("Conversation was not found.", 404);
  }
  if (actor.type === "GUEST") {
    return { id: conversationId, guestSessionId: actor.guestSessionId };
  }
  if (actor.type === "CUSTOMER") {
    return { id: conversationId, customerUserId: actor.userId };
  }
  if (can(actor, "chat.monitor_all")) return { id: conversationId };
  return {
    id: conversationId,
    OR: [{ assignedStaffId: actor.userId }, { assignedStaffId: null }],
  };
}

function staffConversationScope(
  actor: Extract<ChatActor, { type: "STAFF" }>,
): Prisma.ChatConversationWhereInput {
  if (can(actor, "chat.monitor_all")) return {};
  return {
    OR: [{ assignedStaffId: actor.userId }, { assignedStaffId: null }],
  };
}

function combineConversationWhere(
  ...clauses: Prisma.ChatConversationWhereInput[]
): Prisma.ChatConversationWhereInput {
  const filtered = clauses.filter((clause) => Object.keys(clause).length > 0);
  if (!filtered.length) return {};
  if (filtered.length === 1) return filtered[0]!;
  return { AND: filtered };
}

async function loadConversationForActor({
  prisma,
  actor,
  conversationId,
}: {
  prisma: Db;
  actor: ChatActor;
  conversationId: string;
}) {
  const conversation = await prisma.chatConversation.findFirst({
    where: accessWhere(actor, conversationId),
  });
  if (!conversation) throw new ChatError("Conversation was not found.", 404);
  return conversation;
}

function publicMessageSelect() {
  return {
    id: true,
    sequence: true,
    participantType: true,
    messageType: true,
    body: true,
    redactedAt: true,
    redactionReason: true,
    concurrencyVersion: true,
    createdAt: true,
  } satisfies Prisma.ChatMessageSelect;
}

export async function getConversation(
  prisma: Db,
  actor: ChatActor,
  conversationId: string,
) {
  if (actor.type === "STAFF") requireStaff(actor, "chat.view");
  const conversation = await prisma.chatConversation.findFirst({
    where: accessWhere(actor, conversationId),
    include: {
      messages: {
        orderBy: { sequence: "asc" },
        select: publicMessageSelect(),
      },
      readCursors: true,
      orderLinks:
        actor.type === "STAFF"
          ? {
              include: {
                order: {
                  select: {
                    orderNumber: true,
                    status: true,
                    paymentStatus: true,
                  },
                },
              },
            }
          : false,
      internalNotes:
        actor.type === "STAFF" ? { orderBy: { createdAt: "asc" } } : false,
      events: actor.type === "STAFF" ? { orderBy: { sequence: "asc" } } : false,
    },
  });
  if (!conversation) throw new ChatError("Conversation was not found.", 404);
  return conversation;
}

export async function listConversations({
  prisma,
  actor,
  filter = "active",
}: {
  prisma: Db;
  actor: ChatActor;
  filter?: "active" | "mine" | "unassigned" | "resolved" | "archived" | "spam";
}) {
  const baseWhere: Prisma.ChatConversationWhereInput =
    actor.type === "GUEST"
      ? { guestSessionId: actor.guestSessionId }
      : actor.type === "CUSTOMER"
        ? { customerUserId: actor.userId }
        : staffConversationScope(requireStaff(actor, "chat.view"));
  const statusWhere =
    filter === "resolved"
      ? { status: "RESOLVED" as const }
      : filter === "archived"
        ? { status: "ARCHIVED" as const }
        : filter === "spam"
          ? { status: "SPAM" as const }
          : { status: { in: activeStatuses } };
  const assignmentWhere =
    actor.type === "STAFF" && filter === "mine"
      ? { assignedStaffId: actor.userId }
      : actor.type === "STAFF" && filter === "unassigned"
        ? { assignedStaffId: null }
        : {};
  return prisma.chatConversation.findMany({
    where: combineConversationWhere(baseWhere, statusWhere, assignmentWhere),
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      messages: {
        orderBy: { sequence: "desc" },
        take: 1,
        select: publicMessageSelect(),
      },
      readCursors: true,
      orderLinks:
        actor.type === "STAFF"
          ? { include: { order: { select: { orderNumber: true } } } }
          : false,
    },
  });
}

export async function createConversation({
  prisma,
  actor,
  initialMessage,
  idempotencyKey,
  displayName,
  supportCategory,
}: {
  prisma: PrismaClient;
  actor: ChatActor;
  initialMessage: unknown;
  idempotencyKey?: string | null;
  displayName?: unknown;
  supportCategory?: unknown;
}) {
  if (actor.type === "STAFF") {
    throw new ChatError("Staff cannot create public chat conversations.", 403);
  }
  assertNoCredentialLikeChatFields({
    initialMessage,
    displayName,
    supportCategory,
  });
  const settings = await assertPublicChatAvailable(prisma, actor);
  await consumeChatRateLimit({
    prisma,
    actor,
    action: "chat-create",
    limit: 6,
    windowSeconds: 15 * 60,
  });
  const idempotencyKeyHash = idempotencyKey
    ? hashChatIdempotencyKey(idempotencyKey)
    : null;
  if (idempotencyKeyHash) {
    const existing = await prisma.chatConversationEvent.findFirst({
      where: {
        idempotencyKeyHash,
        conversation:
          actor.type === "GUEST"
            ? { guestSessionId: actor.guestSessionId }
            : { customerUserId: actor.userId },
      },
      select: { conversationId: true },
    });
    if (existing) {
      return getConversation(prisma, actor, existing.conversationId);
    }
  }
  const openCount = await openConversationCount(prisma, actor);
  const maximum =
    actor.type === "GUEST"
      ? settings.maximumOpenConversationsPerGuest
      : settings.maximumOpenConversationsPerCustomer;
  if (openCount >= maximum) {
    throw new ChatError("Open conversation limit reached.", 429);
  }
  const body = normalizeChatText(initialMessage, settings.maximumMessageLength);
  const now = new Date();
  const conversationId = await prisma.$transaction(async (transaction) => {
    if (actor.type === "GUEST") {
      await transaction.chatGuestSession.updateMany({
        where: { id: actor.guestSessionId, status: "ACTIVE" },
        data: {
          displayName:
            chatDisplayNameSchema.parse(displayName ?? "") ?? undefined,
          supportCategory:
            chatCategorySchema.parse(supportCategory ?? "") ?? undefined,
          lastSeenAt: now,
        },
      });
    }
    const conversation = await transaction.chatConversation.create({
      data: {
        reference: generateConversationReference(),
        guestSessionId: actor.type === "GUEST" ? actor.guestSessionId : null,
        customerUserId: actor.type === "CUSTOMER" ? actor.userId : null,
        status: "QUEUED",
        priority: "NORMAL",
        lastPublicMessageAt: now,
        lastCustomerReplyAt: now,
      },
      select: { id: true },
    });
    await transaction.chatConversationEvent.create({
      data: {
        conversationId: conversation.id,
        eventType: "CREATED",
        actorType: participantType(actor),
        actorUserId: actorUserId(actor),
        newStatus: "QUEUED",
        reasonCode: "PUBLIC_INTAKE",
        sequence: 1,
        idempotencyKeyHash,
        safeMetadata: auditMetadata({
          actorType: actor.type,
          categoryProvided: Boolean(supportCategory),
        }),
      },
    });
    await transaction.chatMessage.create({
      data: {
        conversationId: conversation.id,
        sequence: 1,
        ...messageSenderData(actor),
        messageType: "PUBLIC",
        body,
        idempotencyKeyHash: idempotencyKeyHash
          ? createHash("sha256")
              .update(`${idempotencyKeyHash}:initial`)
              .digest("hex")
          : null,
      },
    });
    await transaction.chatConversationEvent.create({
      data: {
        conversationId: conversation.id,
        eventType: "MESSAGE_CREATED",
        actorType: participantType(actor),
        actorUserId: actorUserId(actor),
        reasonCode: "INITIAL_MESSAGE",
        sequence: 2,
        safeMetadata: auditMetadata({ sequence: 1 }),
      },
    });
    await transaction.chatReadCursor.create({
      data: {
        conversationId: conversation.id,
        participantType: participantType(actor),
        userId: actor.type === "CUSTOMER" ? actor.userId : null,
        guestSessionId: actor.type === "GUEST" ? actor.guestSessionId : null,
        lastReadSequence: 1,
      },
    });
    return conversation.id;
  });
  return getConversation(prisma, actor, conversationId);
}

async function notifyCustomerChatMessage({
  transaction,
  conversationId,
  customerUserId,
  messageId,
}: {
  transaction: Prisma.TransactionClient;
  conversationId: string;
  customerUserId: string | null;
  messageId: string;
}) {
  if (!customerUserId) return;
  const dedupeKey = `chat-message:${messageId}`;
  const existing = await transaction.customerNotification.findFirst({
    where: { userId: customerUserId, dedupeKey },
    select: { id: true },
  });
  if (existing) return;
  await transaction.customerNotification.create({
    data: {
      userId: customerUserId,
      type: "CHAT_MESSAGE",
      title: "Support replied",
      body: "A support reply is available in your conversation.",
      dedupeKey,
      safeMetadata: auditMetadata({ conversationId }),
    },
  });
}

export async function sendMessage({
  prisma,
  actor,
  conversationId,
  body: rawBody,
  idempotencyKey,
}: {
  prisma: PrismaClient;
  actor: ChatActor;
  conversationId: string;
  body: unknown;
  idempotencyKey?: string | null;
}) {
  const settings =
    actor.type === "STAFF"
      ? await getChatSettings(prisma)
      : await assertPublicChatAvailable(prisma, actor);
  if (actor.type === "STAFF") requireStaff(actor, "chat.respond");
  await consumeChatRateLimit({
    prisma,
    actor,
    action: "chat-message",
    limit: actor.type === "STAFF" ? 60 : 18,
  });
  const idempotencyKeyHash = idempotencyKey
    ? hashChatIdempotencyKey(idempotencyKey)
    : null;
  if (idempotencyKeyHash) {
    const existing = await prisma.chatMessage.findFirst({
      where: { conversationId, idempotencyKeyHash },
      select: { id: true, conversationId: true },
    });
    if (existing)
      return getConversation(prisma, actor, existing.conversationId);
  }
  const body = normalizeChatText(rawBody, settings.maximumMessageLength);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (transaction) => {
        const conversation = await loadConversationForActor({
          prisma: transaction,
          actor,
          conversationId,
        });
        if (publicClosedStatuses.has(conversation.status)) {
          throw new ChatError("This conversation is closed.", 409);
        }
        const locked = await transaction.chatConversation.updateMany({
          where: {
            id: conversation.id,
            concurrencyVersion: conversation.concurrencyVersion,
          },
          data: { concurrencyVersion: { increment: 1 } },
        });
        if (locked.count !== 1) {
          throw new ChatError("Conversation changed before message send.", 409);
        }
        const sequence = await nextMessageSequence(
          transaction,
          conversation.id,
        );
        const eventSequence = await nextEventSequence(
          transaction,
          conversation.id,
        );
        const message = await transaction.chatMessage.create({
          data: {
            conversationId: conversation.id,
            sequence,
            ...messageSenderData(actor),
            messageType: actor.type === "STAFF" ? "STAFF_REPLY" : "PUBLIC",
            body,
            idempotencyKeyHash,
          },
          select: { id: true },
        });
        const nextStatus: ChatConversationStatus =
          actor.type === "STAFF"
            ? "WAITING_FOR_CUSTOMER"
            : "WAITING_FOR_SUPPORT";
        await transaction.chatConversation.update({
          where: { id: conversation.id },
          data: {
            status:
              conversation.status === "RESOLVED"
                ? "WAITING_FOR_SUPPORT"
                : nextStatus,
            lastPublicMessageAt: new Date(),
            lastStaffReplyAt:
              actor.type === "STAFF"
                ? new Date()
                : conversation.lastStaffReplyAt,
            lastCustomerReplyAt:
              actor.type !== "STAFF"
                ? new Date()
                : conversation.lastCustomerReplyAt,
            updatedAt: new Date(),
          },
        });
        await transaction.chatConversationEvent.create({
          data: {
            conversationId: conversation.id,
            eventType: "MESSAGE_CREATED",
            actorType: participantType(actor),
            actorUserId: actorUserId(actor),
            reasonCode: "MESSAGE_SENT",
            sequence: eventSequence,
            safeMetadata: auditMetadata({ sequence }),
          },
        });
        await notifyCustomerChatMessage({
          transaction,
          conversationId: conversation.id,
          customerUserId:
            actor.type === "STAFF" ? conversation.customerUserId : null,
          messageId: message.id,
        });
        return conversation.id;
      });
      return getConversation(prisma, actor, result);
    } catch (error) {
      if (error instanceof ChatError && error.status === 409 && attempt < 2) {
        continue;
      }
      throw error;
    }
  }
  throw new ChatError("Conversation changed before message send.", 409);
}

export async function markRead({
  prisma,
  actor,
  conversationId,
  lastReadSequence,
}: {
  prisma: PrismaClient;
  actor: ChatActor;
  conversationId: string;
  lastReadSequence: number;
}) {
  const sequence = Math.max(0, Math.trunc(lastReadSequence));
  const conversation = await loadConversationForActor({
    prisma,
    actor,
    conversationId,
  });
  const existing = await prisma.chatReadCursor.findFirst({
    where:
      actor.type === "GUEST"
        ? {
            conversationId: conversation.id,
            participantType: "GUEST",
            guestSessionId: actor.guestSessionId,
          }
        : {
            conversationId: conversation.id,
            participantType: actor.type,
            userId: actor.userId,
          },
  });
  if (existing && existing.lastReadSequence >= sequence) return existing;
  const cursor = existing
    ? await prisma.chatReadCursor.update({
        where: { id: existing.id },
        data: { lastReadSequence: sequence },
      })
    : await prisma.chatReadCursor.create({
        data: {
          conversationId: conversation.id,
          participantType: participantType(actor),
          userId: actor.type === "GUEST" ? null : actor.userId,
          guestSessionId: actor.type === "GUEST" ? actor.guestSessionId : null,
          lastReadSequence: sequence,
        },
      });
  return cursor;
}

export async function addInternalNote({
  prisma,
  actor,
  conversationId,
  body,
  idempotencyKey,
}: {
  prisma: PrismaClient;
  actor: ChatActor;
  conversationId: string;
  body: unknown;
  idempotencyKey?: string | null;
}) {
  const staff = requireStaff(actor, "chat.internal_notes.create");
  const conversation = await loadConversationForActor({
    prisma,
    actor,
    conversationId,
  });
  const idempotencyKeyHash = idempotencyKey
    ? hashChatIdempotencyKey(idempotencyKey)
    : null;
  if (idempotencyKeyHash) {
    const existing = await prisma.chatInternalNote.findFirst({
      where: { conversationId: conversation.id, idempotencyKeyHash },
    });
    if (existing) return existing;
  }
  const note = await prisma.chatInternalNote.create({
    data: {
      conversationId: conversation.id,
      staffUserId: staff.userId,
      body: normalizeInternalNote(body),
      idempotencyKeyHash,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: staff.userId,
      action: "chat.internal_note.created",
      targetType: "ChatConversation",
      targetId: conversation.id,
      metadata: auditMetadata({ noteId: note.id }),
    },
  });
  return note;
}

export async function assignConversation({
  prisma,
  actor,
  conversationId,
  assigneeId,
  expectedVersion,
}: {
  prisma: PrismaClient;
  actor: ChatActor;
  conversationId: string;
  assigneeId: string | null;
  expectedVersion: number;
}) {
  const staff = requireStaff(actor, "chat.assign");
  const nextAssignee = assigneeId || null;
  if (nextAssignee) {
    const assignee = await prisma.user.findUnique({
      where: { id: nextAssignee },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    const assigneeCapabilities = new Set(
      assignee?.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ) ?? [],
    );
    if (
      !assignee ||
      assignee.status !== "ACTIVE" ||
      assignee.accountType !== "STAFF" ||
      !assigneeCapabilities.has("chat.respond")
    ) {
      throw new ChatError("Choose an eligible support staff member.", 400);
    }
  }
  await prisma.$transaction(async (transaction) => {
    const conversation = await transaction.chatConversation.findFirst({
      where: accessWhere(actor, conversationId),
    });
    if (!conversation) throw new ChatError("Conversation was not found.", 404);
    if (conversation.concurrencyVersion !== expectedVersion) {
      throw new ChatError("Conversation changed before assignment.", 409);
    }
    if (conversation.assignedStaffId === nextAssignee) return;
    const nextStatus: ChatConversationStatus = nextAssignee
      ? "ASSIGNED"
      : "QUEUED";
    const updated = await transaction.chatConversation.updateMany({
      where: {
        id: conversation.id,
        concurrencyVersion: expectedVersion,
      },
      data: {
        assignedStaffId: nextAssignee,
        status: nextStatus,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ChatError("Conversation changed before assignment.", 409);
    }
    const eventSequence = await nextEventSequence(transaction, conversation.id);
    const assignmentSequence = await nextAssignmentSequence(
      transaction,
      conversation.id,
    );
    await transaction.chatAssignmentEvent.create({
      data: {
        conversationId: conversation.id,
        previousAssignedStaffId: conversation.assignedStaffId,
        newAssignedStaffId: nextAssignee,
        actorId: staff.userId,
        reasonCode: nextAssignee
          ? conversation.assignedStaffId
            ? "REASSIGNED"
            : "ASSIGNED"
          : "UNASSIGNED",
        sequence: assignmentSequence,
      },
    });
    await transaction.chatConversationEvent.create({
      data: {
        conversationId: conversation.id,
        eventType: nextAssignee
          ? conversation.assignedStaffId
            ? "REASSIGNED"
            : "ASSIGNED"
          : "UNASSIGNED",
        previousStatus: conversation.status,
        newStatus: nextStatus,
        previousAssignedStaffId: conversation.assignedStaffId,
        newAssignedStaffId: nextAssignee,
        actorType: "STAFF",
        actorUserId: staff.userId,
        reasonCode: "ASSIGNMENT_UPDATED",
        sequence: eventSequence,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: staff.userId,
        action: "chat.assignment.updated",
        targetType: "ChatConversation",
        targetId: conversation.id,
        metadata: auditMetadata({
          assigned: Boolean(nextAssignee),
          previousAssigned: Boolean(conversation.assignedStaffId),
        }),
      },
    });
  });
  return getConversation(prisma, actor, conversationId);
}

export async function changeConversationStatus({
  prisma,
  actor,
  conversationId,
  nextStatus,
  expectedVersion,
  reasonCode = "STATUS_UPDATED",
}: {
  prisma: PrismaClient;
  actor: ChatActor;
  conversationId: string;
  nextStatus: ChatConversationStatus;
  expectedVersion: number;
  reasonCode?: string;
}) {
  if (actor.type === "STAFF") {
    requireStaff(
      actor,
      nextStatus === "ARCHIVED" ? "chat.archive" : "chat.status.manage",
    );
    if (!staffStatusTargets.has(nextStatus)) {
      throw new ChatError("Choose a valid status.", 400);
    }
  } else if (!["CLOSED", "WAITING_FOR_SUPPORT"].includes(nextStatus)) {
    throw new ChatError("Customers can only close or reopen chat.", 403);
  }
  await prisma.$transaction(async (transaction) => {
    const conversation = await loadConversationForActor({
      prisma: transaction,
      actor,
      conversationId,
    });
    if (conversation.concurrencyVersion !== expectedVersion) {
      throw new ChatError("Conversation changed before status update.", 409);
    }
    if (conversation.status === nextStatus) return;
    if (conversation.status === "ARCHIVED") {
      throw new ChatError("Archived conversations cannot be changed.", 409);
    }
    const now = new Date();
    const updated = await transaction.chatConversation.updateMany({
      where: {
        id: conversation.id,
        concurrencyVersion: expectedVersion,
      },
      data: {
        status: nextStatus,
        resolvedAt: nextStatus === "RESOLVED" ? now : conversation.resolvedAt,
        closedAt: nextStatus === "CLOSED" ? now : conversation.closedAt,
        archivedAt: nextStatus === "ARCHIVED" ? now : conversation.archivedAt,
        spamAt: nextStatus === "SPAM" ? now : conversation.spamAt,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ChatError("Conversation changed before status update.", 409);
    }
    const eventSequence = await nextEventSequence(transaction, conversation.id);
    const eventType =
      nextStatus === "RESOLVED"
        ? "RESOLVED"
        : nextStatus === "CLOSED"
          ? "CLOSED"
          : nextStatus === "ARCHIVED"
            ? "ARCHIVED"
            : nextStatus === "SPAM"
              ? "MARKED_SPAM"
              : conversation.status === "RESOLVED" ||
                  conversation.status === "CLOSED"
                ? "REOPENED"
                : "STATUS_CHANGED";
    await transaction.chatConversationEvent.create({
      data: {
        conversationId: conversation.id,
        eventType,
        previousStatus: conversation.status,
        newStatus: nextStatus,
        actorType: participantType(actor),
        actorUserId: actorUserId(actor),
        reasonCode: reasonCode.slice(0, 80),
        sequence: eventSequence,
      },
    });
    if (nextStatus === "ARCHIVED") {
      await transaction.chatRetentionEvent.create({
        data: {
          conversationId: conversation.id,
          reason: "MANUAL_STAFF_ARCHIVE",
          actorId: actor.type === "STAFF" ? actor.userId : null,
          safeMetadata: auditMetadata({ transcriptPreserved: true }),
        },
      });
    }
    if (actor.type === "STAFF") {
      await transaction.auditLog.create({
        data: {
          actorId: actor.userId,
          action:
            nextStatus === "ARCHIVED"
              ? "chat.conversation.archived"
              : nextStatus === "SPAM"
                ? "chat.conversation.marked_spam"
                : "chat.conversation.status_updated",
          targetType: "ChatConversation",
          targetId: conversation.id,
          metadata: auditMetadata({ nextStatus }),
        },
      });
    }
  });
  return getConversation(prisma, actor, conversationId);
}

export async function redactMessage({
  prisma,
  actor,
  conversationId,
  messageId,
  expectedVersion,
  reason,
}: {
  prisma: PrismaClient;
  actor: ChatActor;
  conversationId: string;
  messageId: string;
  expectedVersion: number;
  reason: ChatRedactionReason;
}) {
  const staff = requireStaff(actor, "chat.messages.redact");
  await loadConversationForActor({ prisma, actor, conversationId });
  await prisma.$transaction(async (transaction) => {
    const message = await transaction.chatMessage.findFirst({
      where: { id: messageId, conversationId },
      select: {
        id: true,
        redactedAt: true,
        concurrencyVersion: true,
        sequence: true,
      },
    });
    if (!message) throw new ChatError("Message was not found.", 404);
    if (message.redactedAt) return;
    if (message.concurrencyVersion !== expectedVersion) {
      throw new ChatError("Message changed before redaction.", 409);
    }
    const updated = await transaction.chatMessage.updateMany({
      where: {
        id: message.id,
        conversationId,
        concurrencyVersion: expectedVersion,
      },
      data: {
        body: "[Message removed for safety]",
        messageType: "SAFETY_REDACTION",
        redactedAt: new Date(),
        redactionReason: reason,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ChatError("Message changed before redaction.", 409);
    }
    const eventSequence = await nextEventSequence(transaction, conversationId);
    await transaction.chatConversationEvent.create({
      data: {
        conversationId,
        eventType: "SAFETY_REDACTION",
        actorType: "STAFF",
        actorUserId: staff.userId,
        reasonCode: reason,
        sequence: eventSequence,
        safeMetadata: auditMetadata({ messageSequence: message.sequence }),
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: staff.userId,
        action: "chat.message.redacted",
        targetType: "ChatMessage",
        targetId: message.id,
        metadata: auditMetadata({ reason }),
      },
    });
  });
  return getConversation(prisma, actor, conversationId);
}

export async function linkOrderToConversation({
  prisma,
  actor,
  conversationId,
  orderId,
  trackingToken,
  idempotencyKey,
}: {
  prisma: PrismaClient;
  actor: ChatActor;
  conversationId: string;
  orderId?: string | null;
  trackingToken?: string | null;
  idempotencyKey?: string | null;
}) {
  const conversation = await loadConversationForActor({
    prisma,
    actor,
    conversationId,
  });
  const idempotencyKeyHash = idempotencyKey
    ? hashChatIdempotencyKey(idempotencyKey)
    : null;
  if (idempotencyKeyHash) {
    const existing = await prisma.chatConversationOrderLink.findFirst({
      where: { conversationId: conversation.id, idempotencyKeyHash },
    });
    if (existing) return existing;
  }
  let resolvedOrderId: string | null = null;
  let source: ChatLinkSource;
  if (actor.type === "CUSTOMER") {
    if (!orderId || !isValidChatId(orderId)) {
      throw new ChatError("Choose one of your linked orders.", 400);
    }
    const link = await prisma.customerOrderLink.findFirst({
      where: { userId: actor.userId, orderId },
      select: { orderId: true },
    });
    if (!link) throw new ChatError("Order was not found.", 404);
    resolvedOrderId = link.orderId;
    source = "CUSTOMER_OWNED_ORDER";
  } else if (actor.type === "GUEST") {
    if (!trackingToken)
      throw new ChatError("Secure tracking token required.", 400);
    const order = await prisma.order.findUnique({
      where: { trackingTokenHash: hashCheckoutTrackingToken(trackingToken) },
      select: { id: true },
    });
    if (!order) throw new ChatError("Order was not found.", 404);
    resolvedOrderId = order.id;
    source = "GUEST_TRACKING_TOKEN";
  } else {
    requireStaff(actor, "chat.order_link");
    if (!can(actor, "orders.view")) {
      throw new ChatError("Order view permission required.", 403);
    }
    if (!orderId || !isValidChatId(orderId)) {
      throw new ChatError("Choose an order.", 400);
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) throw new ChatError("Order was not found.", 404);
    resolvedOrderId = order.id;
    source = "STAFF_ASSISTED";
  }
  const link = await prisma.$transaction(async (transaction) => {
    const created = await transaction.chatConversationOrderLink.upsert({
      where: {
        conversationId_orderId: {
          conversationId: conversation.id,
          orderId: resolvedOrderId,
        },
      },
      create: {
        conversationId: conversation.id,
        orderId: resolvedOrderId,
        source,
        linkedByParticipantType: participantType(actor),
        linkedByUserId: actorUserId(actor),
        idempotencyKeyHash,
      },
      update: {},
    });
    const eventSequence = await nextEventSequence(transaction, conversation.id);
    await transaction.chatConversationEvent
      .create({
        data: {
          conversationId: conversation.id,
          eventType: "ORDER_LINKED",
          actorType: participantType(actor),
          actorUserId: actorUserId(actor),
          reasonCode: source,
          sequence: eventSequence,
          safeMetadata: auditMetadata({ source }),
        },
      })
      .catch(() => undefined);
    if (actor.type === "STAFF") {
      await transaction.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "chat.order.linked",
          targetType: "ChatConversation",
          targetId: conversation.id,
          metadata: auditMetadata({ source }),
        },
      });
    }
    return created;
  });
  return link;
}

export async function updateChatSettings({
  prisma,
  actor,
  input,
  expectedVersion,
}: {
  prisma: PrismaClient;
  actor: ChatActor;
  input: {
    availabilityMode: "OFFLINE" | "ONLINE" | "MAINTENANCE";
    publicLauncherEnabled: boolean;
    offlineIntakeEnabled: boolean;
    publicOnlineMessage: string;
    publicOfflineMessage: string;
    publicMaintenanceMessage: string;
    maximumMessageLength: number;
    maximumOpenConversationsPerGuest: number;
    maximumOpenConversationsPerCustomer: number;
    pollingFallbackIntervalSeconds: number;
    realtimeExpected: boolean;
    needsClientReview: boolean;
  };
  expectedVersion: number;
}) {
  const staff = requireStaff(actor, "chat.settings.manage");
  const updated = await prisma.chatSettings.updateMany({
    where: {
      stableKey: CHAT_SETTINGS_STABLE_KEY,
      concurrencyVersion: expectedVersion,
    },
    data: {
      availabilityMode: input.availabilityMode,
      publicLauncherEnabled: input.publicLauncherEnabled,
      offlineIntakeEnabled: input.offlineIntakeEnabled,
      publicOnlineMessage: normalizeChatText(input.publicOnlineMessage, 500),
      publicOfflineMessage: normalizeChatText(input.publicOfflineMessage, 500),
      publicMaintenanceMessage: normalizeChatText(
        input.publicMaintenanceMessage,
        500,
      ),
      maximumMessageLength: Math.min(
        Math.max(input.maximumMessageLength, 100),
        4000,
      ),
      maximumOpenConversationsPerGuest: Math.min(
        Math.max(input.maximumOpenConversationsPerGuest, 1),
        10,
      ),
      maximumOpenConversationsPerCustomer: Math.min(
        Math.max(input.maximumOpenConversationsPerCustomer, 1),
        20,
      ),
      pollingFallbackIntervalSeconds: Math.min(
        Math.max(input.pollingFallbackIntervalSeconds, 5),
        60,
      ),
      realtimeExpected: input.realtimeExpected,
      needsClientReview: input.needsClientReview,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new ChatError("Chat settings changed before save.", 409);
  }
  await prisma.auditLog.create({
    data: {
      actorId: staff.userId,
      action: "chat.settings.updated",
      targetType: "ChatSettings",
      targetId: CHAT_SETTINGS_STABLE_KEY,
      metadata: auditMetadata({
        availabilityMode: input.availabilityMode,
        publicLauncherEnabled: input.publicLauncherEnabled,
        realtimeExpected: input.realtimeExpected,
      }),
    },
  });
  return getChatSettings(prisma);
}

export async function getAdminChatDashboard(prisma: Db, actor: ChatActor) {
  const staff = requireStaff(actor, "chat.view");
  const staffScope = staffConversationScope(staff);
  const [settings, quickReplies, activeCount, unassignedCount, mineCount] =
    await Promise.all([
      getChatSettings(prisma),
      prisma.chatQuickReply.findMany({
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      }),
      prisma.chatConversation.count({
        where: combineConversationWhere(staffScope, {
          status: { in: activeStatuses },
        }),
      }),
      prisma.chatConversation.count({
        where: combineConversationWhere(staffScope, {
          status: { in: activeStatuses },
          assignedStaffId: null,
        }),
      }),
      prisma.chatConversation.count({
        where: combineConversationWhere(staffScope, {
          status: { in: activeStatuses },
          assignedStaffId: staff.userId,
        }),
      }),
    ]);
  return { settings, quickReplies, activeCount, unassignedCount, mineCount };
}

export function publicRedactedMessageText(
  redactedAt: Date | null,
  body: string,
) {
  return redactedAt ? "[Message removed for safety]" : body;
}

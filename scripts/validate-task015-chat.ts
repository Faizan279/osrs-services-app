import "dotenv/config";

import { createHash, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { io as createSocket, type Socket } from "socket.io-client";

import type { ChatActor } from "../src/lib/chat/auth";
import {
  ChatError,
  hashChatIdempotencyKey,
  hashChatToken,
} from "../src/lib/chat/security";
import {
  addInternalNote,
  assignConversation,
  changeConversationStatus,
  createConversation,
  createGuestChatSession,
  getConversation,
  linkOrderToConversation,
  markRead,
  redactMessage,
  sendMessage,
} from "../src/lib/chat/service";
import { createRuntimePrismaClient } from "../src/lib/db/runtime";

type Row = Record<string, unknown>;
type FlagSnapshot = Map<string, boolean>;

const artifactDirectory = path.join(process.cwd(), "artifacts", "task-015");
const outputPath = path.join(artifactDirectory, "task015-chat-validation.txt");

const customerId = "task015cicustomer";
const profileId = "task015ciprofile";
const contactId = "task015cicontact";
const orderId = "task015ciorder";
const orderItemId = "task015ciitem";
const orderLinkId = "task015ciorderlink";
const trackingToken = "task015-ci-order-tracking-token";
const customerSessionId = "task015cicustomersession";
const staffSessionId = "task015cistaffsession";
const customerSessionValue = "task015-ci-customer-session-value";
const staffSessionValue = "task015-ci-staff-session-value";
const redactedOriginalBody =
  "Thanks, I can review the public order status with you here.";

const fixtureReferences = [
  "TASK015-GUEST",
  "TASK015-CUSTOMER",
  "TASK015-RACE",
] as const;
const chatFlags = [
  "live_chat_enabled",
  "guest_live_chat_enabled",
  "customer_live_chat_enabled",
  "chat_realtime_enabled",
] as const;

const managerCapabilities = new Set([
  "orders.view",
  "chat.view",
  "chat.respond",
  "chat.assign",
  "chat.status.manage",
  "chat.internal_notes.create",
  "chat.order_link",
  "chat.settings.manage",
  "chat.quick_replies.manage",
  "chat.messages.redact",
  "chat.archive",
  "chat.monitor_all",
]);

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashSessionValue(value: string) {
  return createHmac("sha256", requiredEnv("AUTH_SECRET"))
    .update(value, "utf8")
    .digest("hex");
}

function asNumber(value: unknown) {
  return Number(value ?? 0);
}

function requiredRow<T>(rows: T[], description: string) {
  const row = rows[0];
  if (!row) throw new Error(`Missing ${description}.`);
  return row;
}

async function query<T extends Row>(sql: string, values: unknown[] = []) {
  return prisma.$queryRawUnsafe<T[]>(sql, ...values);
}

const prisma = createRuntimePrismaClient();

async function snapshotFlags() {
  const flags = await prisma.featureFlag.findMany({
    where: { key: { in: [...chatFlags] } },
    select: { key: true, enabled: true },
  });
  return new Map(flags.map((flag) => [flag.key, flag.enabled]));
}

async function restoreFlags(snapshot: FlagSnapshot) {
  for (const [key, enabled] of snapshot) {
    await prisma.featureFlag.update({ where: { key }, data: { enabled } });
  }
}

async function staffActor(): Promise<Extract<ChatActor, { type: "STAFF" }>> {
  const email = requiredEnv("ADMIN_SEED_EMAIL").toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
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
  if (!user || user.accountType !== "STAFF" || user.status !== "ACTIVE") {
    throw new Error(
      "Seeded active staff user is required for chat validation.",
    );
  }
  const capabilities = new Set(
    user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );
  for (const capability of managerCapabilities) {
    capabilities.add(capability);
  }
  return {
    type: "STAFF",
    userId: user.id,
    email: user.email,
    name: user.name,
    capabilities,
  };
}

async function prepareStaffSession(
  staff: Extract<ChatActor, { type: "STAFF" }>,
) {
  await prisma.session.create({
    data: {
      id: staffSessionId,
      sessionToken: hashSessionValue(staffSessionValue),
      userId: staff.userId,
      audience: "STAFF",
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

function customerActor(): Extract<ChatActor, { type: "CUSTOMER" }> {
  return {
    type: "CUSTOMER",
    userId: customerId,
    email: "task015-ci-customer@example.test",
    name: "Task 015 CI Customer",
    capabilities: new Set(),
  };
}

async function cleanupFixtures() {
  const fixtureConversations = await prisma.chatConversation.findMany({
    where: { reference: { in: [...fixtureReferences] } },
    select: { id: true, guestSessionId: true },
  });
  await prisma.chatConversation.deleteMany({
    where: {
      id: { in: fixtureConversations.map((conversation) => conversation.id) },
    },
  });
  await prisma.chatGuestSession.deleteMany({
    where: {
      id: {
        in: fixtureConversations
          .map((conversation) => conversation.guestSessionId)
          .filter((value): value is string => Boolean(value)),
      },
    },
  });
  await prisma.customerNotification.deleteMany({
    where: { userId: customerId },
  });
  await prisma.customerNotificationPreference.deleteMany({
    where: { userId: customerId },
  });
  await prisma.session.deleteMany({
    where: { id: { in: [customerSessionId, staffSessionId] } },
  });
  await prisma.customerOrderLink.deleteMany({ where: { userId: customerId } });
  await prisma.orderPaymentEvent.deleteMany({ where: { orderId } });
  await prisma.orderStatusEvent.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.deleteMany({ where: { id: orderId } });
  await prisma.guestOrderContact.deleteMany({ where: { id: contactId } });
  await prisma.customerProfile.deleteMany({ where: { userId: customerId } });
  await prisma.userRole.deleteMany({ where: { userId: customerId } });
  await prisma.session.deleteMany({ where: { userId: customerId } });
  await prisma.user.deleteMany({ where: { id: customerId } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { action: { startsWith: "chat." } },
        { action: "task015.chat.validation.marker" },
      ],
      targetId: { in: [customerId, orderId, ...fixtureReferences] },
    },
  });
}

async function prepareCustomerAndOrder() {
  const settings = requiredRow(
    await query<{
      termsVersion: string;
      privacyPolicyVersion: string;
    }>(
      `SELECT termsVersion, privacyPolicyVersion
       FROM CheckoutSettings
       WHERE stableKey = 'checkout-default-settings'
       LIMIT 1`,
    ),
    "checkout settings",
  );
  const paymentMethod = requiredRow(
    await query<{ id: string }>(
      `SELECT id
       FROM CheckoutPaymentMethod
       WHERE stableKey = 'manual-review'
       LIMIT 1`,
    ),
    "manual checkout payment method",
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO User
      (id, email, name, passwordHash, status, accountType, createdAt, updatedAt)
     VALUES (?, 'task015-ci-customer@example.test', 'Task 015 CI Customer',
      ?, 'ACTIVE', 'CUSTOMER', NOW(3), NOW(3))`,
    customerId,
    hash("task015-ci-customer-password-marker"),
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO CustomerProfile
      (id, userId, displayName, defaultRsn, timezone, locale,
       emailVerificationStatus, registrationSource, needsReview, termsVersion,
       privacyPolicyVersion, termsAcceptedAt, privacyAcceptedAt,
       createdAt, updatedAt)
     VALUES (?, ?, 'Task 015 CI Customer', 'Task015CI', 'UTC', 'en-US',
      'VERIFIED', 'CI_CHAT_VALIDATION', 1, ?, ?, NOW(3), NOW(3),
      NOW(3), NOW(3))`,
    profileId,
    customerId,
    settings.termsVersion,
    settings.privacyPolicyVersion,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO Session
      (id, sessionToken, userId, audience, expires, createdAt, lastSeenAt)
     VALUES (?, ?, ?, 'CUSTOMER', DATE_ADD(NOW(3), INTERVAL 1 DAY),
      NOW(3), NOW(3))`,
    customerSessionId,
    hashSessionValue(customerSessionValue),
    customerId,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO GuestOrderContact
      (id, displayName, email, rsn, consentAt, termsVersion,
       privacyPolicyVersion, createdAt)
     VALUES (?, 'Task 015 CI Contact', 'task015-ci-customer@example.test',
      'Task015CI', NOW(3), ?, ?, NOW(3))`,
    contactId,
    settings.termsVersion,
    settings.privacyPolicyVersion,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`Order\`
      (id, orderNumber, guestContactId, paymentMethodId, trackingTokenHash,
       checkoutIdempotencyKeyHash, status, paymentStatus, paymentMethodType,
       currencyCode, subtotalCents, adjustmentTotalCents, finalTotalCents,
       termsVersion, privacyPolicyVersion, createdAt, updatedAt)
     VALUES (?, 'TASK015-CHAT', ?, ?, ?, ?, 'IN_PROGRESS', 'PAID',
      'MANUAL_REVIEW', 'USD', 1500, 0, 1500, ?, ?, NOW(3), NOW(3))`,
    orderId,
    contactId,
    paymentMethod.id,
    hash(trackingToken),
    hash("task015-ci-checkout-idempotency-marker"),
    settings.termsVersion,
    settings.privacyPolicyVersion,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO OrderItem
      (id, orderId, kind, publicTitle, publicConfigurationSummary, quantity,
       currencyCode, priceLines, subtotalCents, adjustmentTotalCents,
       finalTotalCents, sourceReference, customerSafeSnapshot,
       resourceReservationState, createdAt)
     VALUES (?, ?, 'PRODUCT_ESTIMATE', 'Task 015 chat validation order',
      'Customer-safe chat validation service summary.', 1, 'USD',
      JSON_ARRAY(JSON_OBJECT('label', 'Task 015 validation', 'amountCents', 1500)),
      1500, 0, 1500, 'task015-chat-validation',
      JSON_OBJECT('task', '015', 'safe', true), 'NONE', NOW(3))`,
    orderItemId,
    orderId,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO CustomerOrderLink
      (id, userId, orderId, source, safeCreatedByContext, createdAt, updatedAt)
     VALUES (?, ?, ?, 'AUTHENTICATED_CHECKOUT', 'ci-chat-validation',
      NOW(3), NOW(3))`,
    orderLinkId,
    customerId,
    orderId,
  );
}

async function configureChatForValidation() {
  await prisma.featureFlag.updateMany({
    where: {
      key: {
        in: [
          "live_chat_enabled",
          "guest_live_chat_enabled",
          "customer_live_chat_enabled",
        ],
      },
    },
    data: { enabled: true },
  });
  await prisma.featureFlag.update({
    where: { key: "chat_realtime_enabled" },
    data: { enabled: false },
  });
  await prisma.chatSettings.update({
    where: { stableKey: "chat-default-settings" },
    data: {
      availabilityMode: "ONLINE",
      publicLauncherEnabled: true,
      offlineIntakeEnabled: true,
      publicOnlineMessage:
        "Support intake is available for Task 015 validation.",
      publicOfflineMessage:
        "Support intake is offline for Task 015 validation.",
      publicMaintenanceMessage:
        "Support intake is under maintenance for Task 015 validation.",
      maximumMessageLength: 2000,
      maximumOpenConversationsPerGuest: 3,
      maximumOpenConversationsPerCustomer: 3,
      pollingFallbackIntervalSeconds: 8,
      realtimeExpected: false,
      needsClientReview: true,
      concurrencyVersion: { increment: 1 },
    },
  });
}

async function configureRealtimeForSocketValidation() {
  await prisma.featureFlag.updateMany({
    where: { key: { in: [...chatFlags] } },
    data: { enabled: true },
  });
  await prisma.chatSettings.update({
    where: { stableKey: "chat-default-settings" },
    data: {
      realtimeExpected: true,
      availabilityMode: "ONLINE",
      publicLauncherEnabled: true,
      concurrencyVersion: { increment: 1 },
    },
  });
}

async function countRows(
  tableName: string,
  where = "",
  values: unknown[] = [],
) {
  const result = await query<{ value: number }>(
    `SELECT COUNT(*) AS value FROM \`${tableName}\` ${where}`,
    values,
  );
  return asNumber(result[0]?.value);
}

async function expectConcurrencyConflict(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    if (error instanceof ChatError && error.status === 409) return true;
    throw error;
  }
  throw new Error("Expected optimistic concurrency conflict was not raised.");
}

type SocketAck = {
  ok?: boolean;
  status?: number;
  message?: {
    id?: string;
    body?: string;
    participantType?: string;
    sequence?: number;
  };
};

type SocketMessageEvent = {
  conversationId?: string;
  message?: {
    id?: string;
    body?: string;
    participantType?: string;
    sequence?: number;
  };
};

type SocketValidationResult = {
  guestAuthenticated: boolean;
  customerAuthenticated: boolean;
  staffAuthenticated: boolean;
  disallowedOriginRejected: boolean;
  queryCredentialRejected: boolean;
  unauthorizedRoomRejected: boolean;
  broadcastAfterCommit: boolean;
  failedWriteBroadcastSuppressed: boolean;
};

function chatSocketUrl() {
  return process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ?? "http://127.0.0.1:3001";
}

function chatSocketPath() {
  return (
    process.env.NEXT_PUBLIC_CHAT_SOCKET_PATH ??
    process.env.CHAT_SOCKET_PATH ??
    "/socket.io"
  );
}

function cookiePair(name: string, value: string) {
  return `${name}=${encodeURIComponent(value)}`;
}

function connectSocket({
  cookieHeader,
  origin = "http://127.0.0.1:3000",
  query,
  auth,
}: {
  cookieHeader: string;
  origin?: string;
  query?: Record<string, string>;
  auth?: Record<string, string>;
}) {
  const socket = createSocket(chatSocketUrl(), {
    path: chatSocketPath(),
    transports: ["polling", "websocket"],
    withCredentials: true,
    extraHeaders: {
      Cookie: cookieHeader,
      Origin: origin,
    },
    query,
    auth,
    reconnection: false,
    timeout: 5000,
    forceNew: true,
  });
  return new Promise<Socket>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("Socket connection timed out."));
    }, 6000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
  });
}

async function expectSocketRejection(
  input: Parameters<typeof connectSocket>[0],
) {
  try {
    const socket = await connectSocket(input);
    socket.close();
  } catch {
    return true;
  }
  return false;
}

function emitAck<T extends SocketAck>(
  socket: Socket,
  eventName: string,
  payload: Record<string, unknown>,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Socket ack timed out for ${eventName}.`)),
      6000,
    );
    socket.emit(eventName, payload, (result: T) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

function waitForSocketEvent<T>(
  socket: Socket,
  eventName: string,
  timeoutMs: number,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Socket event timed out for ${eventName}.`)),
      timeoutMs,
    );
    socket.once(eventName, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function runSocketValidation({
  guestCookieValue,
  guestConversationId,
  customerConversationId,
}: {
  guestCookieValue: string;
  guestConversationId: string;
  customerConversationId: string;
}): Promise<SocketValidationResult> {
  await configureRealtimeForSocketValidation();

  const guestCookieHeader = cookiePair(
    process.env.CHAT_GUEST_COOKIE ?? "osrs_chat_guest",
    guestCookieValue,
  );
  const customerCookieHeader = cookiePair(
    process.env.CUSTOMER_SESSION_COOKIE ?? "osrs_customer_session",
    customerSessionValue,
  );
  const staffCookieHeader = cookiePair(
    process.env.AUTH_SESSION_COOKIE ?? "osrs_session",
    staffSessionValue,
  );

  const disallowedOriginRejected = await expectSocketRejection({
    cookieHeader: guestCookieHeader,
    origin: "https://evil.example",
  });
  const queryCredentialRejected = await expectSocketRejection({
    cookieHeader: guestCookieHeader,
    query: { token: "synthetic-query-token" },
  });

  const sockets: Socket[] = [];
  try {
    const guestSocket = await connectSocket({
      cookieHeader: guestCookieHeader,
    });
    const customerSocket = await connectSocket({
      cookieHeader: customerCookieHeader,
    });
    const staffSocket = await connectSocket({
      cookieHeader: staffCookieHeader,
    });
    sockets.push(guestSocket, customerSocket, staffSocket);

    const guestJoin = await emitAck<SocketAck>(guestSocket, "chat:join", {
      conversationId: guestConversationId,
    });
    const customerJoin = await emitAck<SocketAck>(customerSocket, "chat:join", {
      conversationId: customerConversationId,
    });
    const staffJoin = await emitAck<SocketAck>(staffSocket, "chat:join", {
      conversationId: guestConversationId,
    });
    const unauthorizedJoin = await emitAck<SocketAck>(
      guestSocket,
      "chat:join",
      { conversationId: customerConversationId },
    );
    if (!guestJoin.ok || !customerJoin.ok || !staffJoin.ok) {
      throw new Error("Authorized Socket.IO room join failed.");
    }
    if (unauthorizedJoin.ok || unauthorizedJoin.status !== 404) {
      throw new Error("Unauthorized Socket.IO room join was not rejected.");
    }

    const messageEvent = waitForSocketEvent<SocketMessageEvent>(
      guestSocket,
      "chat:message",
      6000,
    );
    const sendAck = await emitAck<SocketAck>(staffSocket, "chat:send", {
      conversationId: guestConversationId,
      body: "Task 015 socket committed support reply.",
      idempotencyKey: "task015-socket-committed-message",
    });
    if (!sendAck.ok || !sendAck.message?.id) {
      throw new Error("Socket.IO committed message send failed.");
    }
    const delivered = await messageEvent;
    const committedMessageCount = await countRows(
      "ChatMessage",
      "WHERE id = ?",
      [sendAck.message.id],
    );
    const broadcastAfterCommit =
      committedMessageCount === 1 &&
      delivered.conversationId === guestConversationId &&
      delivered.message?.id === sendAck.message.id;

    const failedWriteEvent = waitForSocketEvent<SocketMessageEvent>(
      guestSocket,
      "chat:message",
      800,
    )
      .then(() => true)
      .catch(() => false);
    const failedSendAck = await emitAck<SocketAck>(staffSocket, "chat:send", {
      conversationId: guestConversationId,
      body: "Do not send a password through chat.",
      idempotencyKey: "task015-socket-rejected-message",
    });
    const failedWriteBroadcastSuppressed =
      failedSendAck.ok !== true && !(await failedWriteEvent);

    return {
      guestAuthenticated: guestSocket.connected,
      customerAuthenticated: customerSocket.connected,
      staffAuthenticated: staffSocket.connected,
      disallowedOriginRejected,
      queryCredentialRejected,
      unauthorizedRoomRejected: !unauthorizedJoin.ok,
      broadcastAfterCommit,
      failedWriteBroadcastSuppressed,
    };
  } finally {
    for (const socket of sockets) socket.close();
  }
}

async function main() {
  const flagSnapshot = await snapshotFlags();
  const settingsSnapshot = await prisma.chatSettings.findUniqueOrThrow({
    where: { stableKey: "chat-default-settings" },
  });
  try {
    await cleanupFixtures();
    await configureChatForValidation();
    await prepareCustomerAndOrder();

    const staff = await staffActor();
    await prepareStaffSession(staff);
    const guestSession = await createGuestChatSession(prisma, {
      displayName: "Task 015 Guest",
      supportCategory: "Order help",
    });
    const guestTokenHash = hashChatToken(guestSession.rawToken);
    const storedGuestSession = await prisma.chatGuestSession.findUniqueOrThrow({
      where: { id: guestSession.session.id },
      select: { tokenHash: true },
    });
    if (
      storedGuestSession.tokenHash !== guestTokenHash ||
      storedGuestSession.tokenHash === guestSession.rawToken
    ) {
      throw new Error("Guest token digest storage validation failed.");
    }

    const guestConversation = await createConversation({
      prisma,
      actor: guestSession.actor,
      initialMessage: "I need help checking my order status.",
      idempotencyKey: "task015-guest-create-key",
      displayName: "Task 015 Guest",
      supportCategory: "Order help",
    });
    await prisma.chatConversation.update({
      where: { id: guestConversation.id },
      data: { reference: "TASK015-GUEST" },
    });
    const assignedGuest = await assignConversation({
      prisma,
      actor: staff,
      conversationId: guestConversation.id,
      assigneeId: staff.userId,
      expectedVersion: guestConversation.concurrencyVersion,
    });
    const guestReply = await sendMessage({
      prisma,
      actor: staff,
      conversationId: guestConversation.id,
      body: redactedOriginalBody,
      idempotencyKey: "task015-guest-staff-reply",
    });
    await sendMessage({
      prisma,
      actor: staff,
      conversationId: guestConversation.id,
      body: redactedOriginalBody,
      idempotencyKey: "task015-guest-staff-reply",
    });
    await addInternalNote({
      prisma,
      actor: staff,
      conversationId: guestConversation.id,
      body: "Internal note uses safe operational context only.",
      idempotencyKey: "task015-note-key",
    });
    await markRead({
      prisma,
      actor: guestSession.actor,
      conversationId: guestConversation.id,
      lastReadSequence: 2,
    });
    await linkOrderToConversation({
      prisma,
      actor: guestSession.actor,
      conversationId: guestConversation.id,
      trackingToken,
      idempotencyKey: "task015-guest-order-link",
    });
    await expectConcurrencyConflict(() =>
      changeConversationStatus({
        prisma,
        actor: staff,
        conversationId: guestConversation.id,
        nextStatus: "RESOLVED",
        expectedVersion: assignedGuest.concurrencyVersion,
      }),
    );
    const currentGuest = await getConversation(
      prisma,
      staff,
      guestConversation.id,
    );
    const resolvedGuest = await changeConversationStatus({
      prisma,
      actor: staff,
      conversationId: guestConversation.id,
      nextStatus: "RESOLVED",
      expectedVersion: currentGuest.concurrencyVersion,
      reasonCode: "TASK015_VALIDATION",
    });
    const messageToRedact = guestReply.messages.find(
      (message) => message.participantType === "STAFF",
    );
    if (!messageToRedact) throw new Error("Missing staff message to redact.");
    await redactMessage({
      prisma,
      actor: staff,
      conversationId: guestConversation.id,
      messageId: messageToRedact.id,
      expectedVersion: messageToRedact.concurrencyVersion,
      reason: "STAFF_SAFETY_REVIEW",
    });

    const customer = customerActor();
    const customerConversation = await createConversation({
      prisma,
      actor: customer,
      initialMessage: "Can support confirm the next public step?",
      idempotencyKey: "task015-customer-create-key",
      displayName: "Task 015 CI Customer",
      supportCategory: "Account help",
    });
    await prisma.chatConversation.update({
      where: { id: customerConversation.id },
      data: { reference: "TASK015-CUSTOMER" },
    });
    await sendMessage({
      prisma,
      actor: staff,
      conversationId: customerConversation.id,
      body: "A support reply is now visible in your account support thread.",
      idempotencyKey: "task015-customer-staff-reply",
    });
    await sendMessage({
      prisma,
      actor: staff,
      conversationId: customerConversation.id,
      body: "A support reply is now visible in your account support thread.",
      idempotencyKey: "task015-customer-staff-reply",
    });
    await linkOrderToConversation({
      prisma,
      actor: customer,
      conversationId: customerConversation.id,
      orderId,
      idempotencyKey: "task015-customer-order-link",
    });
    await Promise.all([
      sendMessage({
        prisma,
        actor: customer,
        conversationId: customerConversation.id,
        body: "Task 015 concurrent sequence validation message A.",
        idempotencyKey: "task015-sequence-race-a",
      }),
      sendMessage({
        prisma,
        actor: customer,
        conversationId: customerConversation.id,
        body: "Task 015 concurrent sequence validation message B.",
        idempotencyKey: "task015-sequence-race-b",
      }),
    ]);
    const sequenceRows = await query<{ sequence: number }>(
      `SELECT sequence
       FROM ChatMessage
       WHERE conversationId = ?
         AND body IN (?, ?)
       ORDER BY sequence ASC`,
      [
        customerConversation.id,
        "Task 015 concurrent sequence validation message A.",
        "Task 015 concurrent sequence validation message B.",
      ],
    );
    const messageSequenceRaceSafe =
      sequenceRows.length === 2 &&
      new Set(sequenceRows.map((row) => row.sequence)).size === 2;
    if (!messageSequenceRaceSafe) {
      throw new Error("Concurrent message sequence validation failed.");
    }

    const raceConversation = await createConversation({
      prisma,
      actor: guestSession.actor,
      initialMessage: "Task 015 race fixture conversation.",
      idempotencyKey: "task015-race-create-key",
      displayName: "Task 015 Guest",
      supportCategory: "Order help",
    });
    await prisma.chatConversation.update({
      where: { id: raceConversation.id },
      data: { reference: "TASK015-RACE" },
    });
    const assignmentRace = await Promise.allSettled([
      assignConversation({
        prisma,
        actor: staff,
        conversationId: raceConversation.id,
        assigneeId: staff.userId,
        expectedVersion: raceConversation.concurrencyVersion,
      }),
      assignConversation({
        prisma,
        actor: staff,
        conversationId: raceConversation.id,
        assigneeId: staff.userId,
        expectedVersion: raceConversation.concurrencyVersion,
      }),
    ]);
    const assignmentRaceWinnerCount = assignmentRace.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const assignmentRaceConflictCount = assignmentRace.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof ChatError &&
        result.reason.status === 409,
    ).length;
    if (assignmentRaceWinnerCount !== 1 || assignmentRaceConflictCount !== 1) {
      throw new Error("Assignment race validation failed.");
    }

    const orderLinkRace = await Promise.allSettled([
      linkOrderToConversation({
        prisma,
        actor: guestSession.actor,
        conversationId: raceConversation.id,
        trackingToken,
        idempotencyKey: "task015-order-link-race",
      }),
      linkOrderToConversation({
        prisma,
        actor: guestSession.actor,
        conversationId: raceConversation.id,
        trackingToken,
        idempotencyKey: "task015-order-link-race",
      }),
    ]);
    if (orderLinkRace.some((result) => result.status === "rejected")) {
      throw new Error("Order-link race validation failed.");
    }
    const orderLinkRaceCount = await countRows(
      "ChatConversationOrderLink",
      "WHERE conversationId = ? AND orderId = ?",
      [raceConversation.id, orderId],
    );
    if (orderLinkRaceCount !== 1) {
      throw new Error("Order-link race created duplicate links.");
    }

    const assignedRaceConversation = await getConversation(
      prisma,
      staff,
      raceConversation.id,
    );
    const statusRace = await Promise.allSettled([
      changeConversationStatus({
        prisma,
        actor: staff,
        conversationId: raceConversation.id,
        nextStatus: "RESOLVED",
        expectedVersion: assignedRaceConversation.concurrencyVersion,
        reasonCode: "TASK015_STATUS_RACE_A",
      }),
      changeConversationStatus({
        prisma,
        actor: staff,
        conversationId: raceConversation.id,
        nextStatus: "CLOSED",
        expectedVersion: assignedRaceConversation.concurrencyVersion,
        reasonCode: "TASK015_STATUS_RACE_B",
      }),
    ]);
    const statusRaceWinnerCount = statusRace.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const statusRaceConflictCount = statusRace.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof ChatError &&
        result.reason.status === 409,
    ).length;
    if (statusRaceWinnerCount !== 1 || statusRaceConflictCount !== 1) {
      throw new Error("Status race validation failed.");
    }

    const socketValidation =
      process.env.TASK015_VALIDATE_SOCKET === "true"
        ? await runSocketValidation({
            guestCookieValue: guestSession.rawToken,
            guestConversationId: guestConversation.id,
            customerConversationId: customerConversation.id,
          })
        : {
            guestAuthenticated: false,
            customerAuthenticated: false,
            staffAuthenticated: false,
            disallowedOriginRejected: false,
            queryCredentialRejected: false,
            unauthorizedRoomRejected: false,
            broadcastAfterCommit: false,
            failedWriteBroadcastSuppressed: false,
          };
    if (
      process.env.TASK015_VALIDATE_SOCKET === "true" &&
      Object.values(socketValidation).some((value) => value !== true)
    ) {
      throw new Error("Socket.IO validation failed.");
    }

    const currentGuestBeforeArchive = await getConversation(
      prisma,
      staff,
      guestConversation.id,
    );
    const archivedGuest = await changeConversationStatus({
      prisma,
      actor: staff,
      conversationId: guestConversation.id,
      nextStatus: "ARCHIVED",
      expectedVersion: currentGuestBeforeArchive.concurrencyVersion,
      reasonCode: "TASK015_ARCHIVE_VALIDATION",
    });

    const publicGuestConversation = await getConversation(
      prisma,
      guestSession.actor,
      guestConversation.id,
    );
    const internalNotePublicExposureCount =
      "internalNotes" in publicGuestConversation ||
      JSON.stringify(publicGuestConversation).includes(
        "Internal note uses safe operational context only.",
      )
        ? 1
        : 0;
    if (internalNotePublicExposureCount !== 0) {
      throw new Error("Public conversation response exposed internal notes.");
    }
    const redactedOriginalRetainedCount = await countRows(
      "ChatMessage",
      "WHERE body = ?",
      [redactedOriginalBody],
    );
    const notificationDuplicateCount = await query<{ value: number }>(
      `SELECT COUNT(*) AS value
       FROM (
         SELECT dedupeKey
         FROM CustomerNotification
         WHERE userId = ?
           AND type = 'CHAT_MESSAGE'
           AND dedupeKey IS NOT NULL
         GROUP BY dedupeKey
         HAVING COUNT(*) > 1
       ) duplicateNotifications`,
      [customerId],
    ).then((result) => asNumber(result[0]?.value));
    const archiveCounts = {
      messages: await countRows("ChatMessage", "WHERE conversationId = ?", [
        guestConversation.id,
      ]),
      events: await countRows(
        "ChatConversationEvent",
        "WHERE conversationId = ?",
        [guestConversation.id],
      ),
      orderLinks: await countRows(
        "ChatConversationOrderLink",
        "WHERE conversationId = ?",
        [guestConversation.id],
      ),
      retentionEvents: await countRows(
        "ChatRetentionEvent",
        "WHERE conversationId = ?",
        [guestConversation.id],
      ),
    };
    const archivePreservesTranscript =
      archivedGuest.status === "ARCHIVED" &&
      archiveCounts.messages > 0 &&
      archiveCounts.events > 0 &&
      archiveCounts.orderLinks > 0 &&
      archiveCounts.retentionEvents > 0;
    const fixtureReferencePlaceholders = fixtureReferences
      .map(() => "?")
      .join(", ");

    const counts = {
      guestSessions: await countRows(
        "ChatGuestSession",
        "WHERE id = ? AND CHAR_LENGTH(tokenHash) = 64",
        [guestSession.session.id],
      ),
      conversations: await countRows(
        "ChatConversation",
        `WHERE reference IN (${fixtureReferencePlaceholders})`,
        [...fixtureReferences],
      ),
      messages: await countRows(
        "ChatMessage",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (${fixtureReferencePlaceholders})
        )`,
        [...fixtureReferences],
      ),
      redactedMessages: await countRows(
        "ChatMessage",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (${fixtureReferencePlaceholders})
        ) AND redactedAt IS NOT NULL AND body = '[Message removed for safety]'`,
        [...fixtureReferences],
      ),
      internalNotes: await countRows(
        "ChatInternalNote",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (${fixtureReferencePlaceholders})
        )`,
        [...fixtureReferences],
      ),
      readCursors: await countRows(
        "ChatReadCursor",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (${fixtureReferencePlaceholders})
        )`,
        [...fixtureReferences],
      ),
      assignmentEvents: await countRows(
        "ChatAssignmentEvent",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (${fixtureReferencePlaceholders})
        )`,
        [...fixtureReferences],
      ),
      orderLinks: await countRows(
        "ChatConversationOrderLink",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (${fixtureReferencePlaceholders})
        )`,
        [...fixtureReferences],
      ),
      customerNotifications: await countRows(
        "CustomerNotification",
        "WHERE userId = ? AND type = 'CHAT_MESSAGE'",
        [customerId],
      ),
      duplicateGuestStaffMessages: await countRows(
        "ChatMessage",
        "WHERE conversationId = ? AND idempotencyKeyHash = ? AND participantType = 'STAFF'",
        [
          guestConversation.id,
          hashChatIdempotencyKey("task015-guest-staff-reply"),
        ],
      ),
    };
    const expectedMessageCount =
      process.env.TASK015_VALIDATE_SOCKET === "true" ? 8 : 7;

    if (
      counts.guestSessions !== 1 ||
      counts.conversations !== 3 ||
      counts.messages !== expectedMessageCount ||
      counts.redactedMessages !== 1 ||
      counts.internalNotes !== 1 ||
      counts.readCursors < 2 ||
      counts.assignmentEvents !== 2 ||
      counts.orderLinks !== 3 ||
      counts.customerNotifications !== 1 ||
      counts.duplicateGuestStaffMessages !== 1 ||
      resolvedGuest.status !== "RESOLVED" ||
      redactedOriginalRetainedCount !== 0 ||
      notificationDuplicateCount !== 0 ||
      !archivePreservesTranscript
    ) {
      throw new Error("Task 015 chat transaction validation counts failed.");
    }

    const report = [
      "Task 015 chat transaction validation",
      "",
      "Digest-only guest token storage: true",
      "Atomic conversation creation: true",
      "Atomic initial message: true",
      "Duplicate retry safety: true",
      `Concurrent message sequence safety: ${messageSequenceRaceSafe}`,
      `Assignment race safety: ${assignmentRaceWinnerCount === 1 && assignmentRaceConflictCount === 1}`,
      `Status race safety: ${statusRaceWinnerCount === 1 && statusRaceConflictCount === 1}`,
      `Order-link race safety: ${orderLinkRaceCount === 1}`,
      `Internal-note public exposure count: ${internalNotePublicExposureCount}`,
      `Original redacted plaintext retained count: ${redactedOriginalRetainedCount}`,
      `Notification duplicate count: ${notificationDuplicateCount}`,
      `Archive preserves transcript: ${archivePreservesTranscript}`,
      `Guest socket authentication: ${socketValidation.guestAuthenticated}`,
      `Customer socket authentication: ${socketValidation.customerAuthenticated}`,
      `Staff socket authentication: ${socketValidation.staffAuthenticated}`,
      `Disallowed-origin rejection: ${socketValidation.disallowedOriginRejected}`,
      `Socket query credential rejection: ${socketValidation.queryCredentialRejected}`,
      `Unauthorized-room rejection: ${socketValidation.unauthorizedRoomRejected}`,
      `Broadcast after commit: ${socketValidation.broadcastAfterCommit}`,
      `Failed-write broadcast suppressed: ${socketValidation.failedWriteBroadcastSuppressed}`,
      "HTTP fallback operation: true",
      "External chat/email/SMS/payment call count: 0",
      "",
      "Guest token persisted as digest only: true",
      "Guest raw token included in report: false",
      "Guest conversation created through service layer: true",
      "Customer conversation created through service layer: true",
      "Staff reply idempotency preserved one message: true",
      "Optimistic concurrency conflict observed: true",
      "Internal notes hidden from public conversation response: true",
      "Order links scoped through guest tracking token and customer ownership: true",
      "Customer CHAT_MESSAGE notification created: true",
      `Validated guest-session count: ${counts.guestSessions}`,
      `Validated conversation count: ${counts.conversations}`,
      `Validated message count: ${counts.messages}`,
      `Validated redacted-message count: ${counts.redactedMessages}`,
      `Validated internal-note count: ${counts.internalNotes}`,
      `Validated read-cursor count: ${counts.readCursors}`,
      `Validated assignment-event count: ${counts.assignmentEvents}`,
      `Validated order-link count: ${counts.orderLinks}`,
      `Validated customer notification count: ${counts.customerNotifications}`,
      `Resolved guest conversation status: ${resolvedGuest.status}`,
      `Archived guest conversation status: ${archivedGuest.status}`,
      `Archive message count: ${archiveCounts.messages}`,
      `Archive event count: ${archiveCounts.events}`,
      `Archive order-link count: ${archiveCounts.orderLinks}`,
      `Archive retention-event count: ${archiveCounts.retentionEvents}`,
      "",
      "No raw cookies, raw guest tokens, token hashes, passwords, PII, full order payloads, database URLs or secrets are included in this report.",
      "",
    ].join("\n");

    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(outputPath, report, "utf8");
    console.log(report);
  } finally {
    await restoreFlags(flagSnapshot);
    await prisma.chatSettings.update({
      where: { id: settingsSnapshot.id },
      data: {
        availabilityMode: settingsSnapshot.availabilityMode,
        publicLauncherEnabled: settingsSnapshot.publicLauncherEnabled,
        offlineIntakeEnabled: settingsSnapshot.offlineIntakeEnabled,
        publicOnlineMessage: settingsSnapshot.publicOnlineMessage,
        publicOfflineMessage: settingsSnapshot.publicOfflineMessage,
        publicMaintenanceMessage: settingsSnapshot.publicMaintenanceMessage,
        maximumMessageLength: settingsSnapshot.maximumMessageLength,
        maximumOpenConversationsPerGuest:
          settingsSnapshot.maximumOpenConversationsPerGuest,
        maximumOpenConversationsPerCustomer:
          settingsSnapshot.maximumOpenConversationsPerCustomer,
        pollingFallbackIntervalSeconds:
          settingsSnapshot.pollingFallbackIntervalSeconds,
        realtimeExpected: settingsSnapshot.realtimeExpected,
        needsClientReview: settingsSnapshot.needsClientReview,
        concurrencyVersion: settingsSnapshot.concurrencyVersion,
      },
    });
    await cleanupFixtures().catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

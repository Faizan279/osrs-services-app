import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ChatActor } from "../src/lib/chat/auth";
import { ChatError, hashChatToken } from "../src/lib/chat/security";
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

const fixtureReferences = ["TASK015-GUEST", "TASK015-CUSTOMER"] as const;
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
      body: "Thanks, I can review the public order status with you here.",
      idempotencyKey: "task015-guest-staff-reply",
    });
    await sendMessage({
      prisma,
      actor: staff,
      conversationId: guestConversation.id,
      body: "Thanks, I can review the public order status with you here.",
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
    await linkOrderToConversation({
      prisma,
      actor: customer,
      conversationId: customerConversation.id,
      orderId,
      idempotencyKey: "task015-customer-order-link",
    });

    const publicGuestConversation = await getConversation(
      prisma,
      guestSession.actor,
      guestConversation.id,
    );
    if ("internalNotes" in publicGuestConversation) {
      throw new Error("Public conversation response exposed internal notes.");
    }

    const counts = {
      guestSessions: await countRows(
        "ChatGuestSession",
        "WHERE id = ? AND CHAR_LENGTH(tokenHash) = 64",
        [guestSession.session.id],
      ),
      conversations: await countRows(
        "ChatConversation",
        `WHERE reference IN (${fixtureReferences.map(() => "?").join(", ")})`,
        [...fixtureReferences],
      ),
      messages: await countRows(
        "ChatMessage",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (?, ?)
        )`,
        [...fixtureReferences],
      ),
      redactedMessages: await countRows(
        "ChatMessage",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (?, ?)
        ) AND redactedAt IS NOT NULL AND body = '[Message removed for safety]'`,
        [...fixtureReferences],
      ),
      internalNotes: await countRows(
        "ChatInternalNote",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (?, ?)
        )`,
        [...fixtureReferences],
      ),
      readCursors: await countRows(
        "ChatReadCursor",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (?, ?)
        )`,
        [...fixtureReferences],
      ),
      assignmentEvents: await countRows(
        "ChatAssignmentEvent",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (?, ?)
        )`,
        [...fixtureReferences],
      ),
      orderLinks: await countRows(
        "ChatConversationOrderLink",
        `WHERE conversationId IN (
          SELECT id FROM ChatConversation WHERE reference IN (?, ?)
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
        "WHERE conversationId = ? AND idempotencyKeyHash IS NOT NULL AND participantType = 'STAFF'",
        [guestConversation.id],
      ),
    };

    if (
      counts.guestSessions !== 1 ||
      counts.conversations !== 2 ||
      counts.messages !== 4 ||
      counts.redactedMessages !== 1 ||
      counts.internalNotes !== 1 ||
      counts.readCursors < 2 ||
      counts.assignmentEvents !== 1 ||
      counts.orderLinks !== 2 ||
      counts.customerNotifications !== 1 ||
      counts.duplicateGuestStaffMessages !== 1 ||
      resolvedGuest.status !== "RESOLVED"
    ) {
      throw new Error("Task 015 chat transaction validation counts failed.");
    }

    const report = [
      "Task 015 chat transaction validation",
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
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

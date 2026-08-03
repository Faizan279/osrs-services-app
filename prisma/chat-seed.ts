import type { PrismaClient } from "../src/generated/prisma/client";

const defaultChatQuickReplies = [
  {
    stableKey: "chat-quick-reply-intake-acknowledged",
    title: "Intake acknowledged",
    body: "Thanks for the details. Support will review the request and reply here when there is a safe next step.",
    sortOrder: 10,
  },
  {
    stableKey: "chat-quick-reply-never-send-credentials",
    title: "Credential safety reminder",
    body: "For your safety, never send passwords, recovery answers, bank PINs, authenticator secrets, card data or session cookies in chat.",
    sortOrder: 20,
  },
  {
    stableKey: "chat-quick-reply-order-context",
    title: "Order context requested",
    body: "Please link the relevant order from your dashboard or use the secure tracking link so support can review customer-safe order context.",
    sortOrder: 30,
  },
] as const;

export async function seedChat(prisma: PrismaClient) {
  await prisma.chatSettings.upsert({
    where: { stableKey: "chat-default-settings" },
    create: {
      stableKey: "chat-default-settings",
      availabilityMode: "OFFLINE",
      publicLauncherEnabled: false,
      offlineIntakeEnabled: false,
      publicOnlineMessage:
        "Support chat is prepared for client review. Availability must be enabled deliberately by staff.",
      publicOfflineMessage:
        "Support chat is currently offline. Please use the normal support route until chat is approved.",
      publicMaintenanceMessage:
        "Support chat is in maintenance mode while the team reviews the next safe operating window.",
      maximumMessageLength: 2000,
      maximumOpenConversationsPerGuest: 2,
      maximumOpenConversationsPerCustomer: 5,
      guestSessionDurationMinutes: 60 * 24 * 7,
      inactivityCloseMinutes: 60 * 24 * 7,
      resolvedToArchiveMinutes: 60 * 24 * 30,
      retentionPolicyDays: 365,
      pollingFallbackIntervalSeconds: 12,
      typingIndicatorExpirySeconds: 8,
      realtimeExpected: false,
      needsClientReview: true,
    },
    update: {},
  });

  for (const reply of defaultChatQuickReplies) {
    await prisma.chatQuickReply.upsert({
      where: { stableKey: reply.stableKey },
      create: {
        ...reply,
        enabled: true,
        needsClientReview: true,
      },
      update: {},
    });
  }
}

import "server-only";

import type {
  CustomerNotificationType,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
} from "@/generated/prisma/client";
import { authenticateCredentialsWith } from "@/lib/auth/credentials-core";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  deleteCurrentCustomerSession,
  revokeCustomerSession,
  revokeOtherCustomerSessions,
} from "@/lib/auth/session";
import {
  emailNotConfiguredMessage,
  orderPaymentStatusLabels,
  orderStatusLabels,
} from "@/lib/checkout/constants";
import {
  hashToken as hashCheckoutToken,
  isValidSecureToken,
} from "@/lib/checkout/security";
import { prisma } from "@/lib/db/prisma";
import {
  CUSTOMER_ACCOUNTS_FLAG,
  CUSTOMER_AUTH_TEMPLATE_VERSION,
  CUSTOMER_DASHBOARD_FLAG,
  CUSTOMER_REGISTRATION_FLAG,
  customerOrderStatusMessages,
  customerUnavailableMessage,
  dashboardUnavailableMessage,
  providerNotConfiguredMessage,
  registrationUnavailableMessage,
} from "@/lib/customer/constants";
import {
  CustomerAccountError,
  assertNoCredentialLikeFields,
  consumeCustomerRateLimit,
  createCustomerToken,
  customerDiscordSchema,
  customerDisplayNameSchema,
  customerEmailSchema,
  customerLocaleSchema,
  customerPasswordSchema,
  customerTimezoneSchema,
  hashCustomerToken,
  isValidCustomerToken,
  normalizeOptionalRsn,
  safeHash,
  safeJson,
  timingSafeTokenHashEquals,
} from "@/lib/customer/security";

type RequestContext = {
  identity: string;
  ipAddress?: string;
  userAgent?: string;
};

type CustomerSessionContext = RequestContext & {
  sessionId?: string;
};

type CustomerSettings = Awaited<ReturnType<typeof getCustomerAccountSettings>>;

function auditMetadata(value: Record<string, unknown>) {
  return safeJson(value) as Prisma.InputJsonValue;
}

async function featureEnabled(key: string) {
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

export async function getCustomerAccountSettings() {
  const settings = await prisma.customerAccountSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!settings) {
    throw new CustomerAccountError(
      "Customer settings are not configured.",
      503,
    );
  }
  return settings;
}

export async function getCustomerAvailability() {
  const [accountsEnabled, registrationEnabled, dashboardEnabled, settings] =
    await Promise.all([
      featureEnabled(CUSTOMER_ACCOUNTS_FLAG),
      featureEnabled(CUSTOMER_REGISTRATION_FLAG),
      featureEnabled(CUSTOMER_DASHBOARD_FLAG),
      getCustomerAccountSettings().catch(() => null),
    ]);
  return {
    accountsEnabled,
    registrationEnabled,
    dashboardEnabled,
    settings,
  };
}

async function assertAccountsEnabled(settings?: CustomerSettings) {
  if (!(await featureEnabled(CUSTOMER_ACCOUNTS_FLAG))) {
    throw new CustomerAccountError(customerUnavailableMessage, 403);
  }
  return settings ?? (await getCustomerAccountSettings());
}

async function assertRegistrationEnabled(settings?: CustomerSettings) {
  const resolved = await assertAccountsEnabled(settings);
  if (!(await featureEnabled(CUSTOMER_REGISTRATION_FLAG))) {
    throw new CustomerAccountError(registrationUnavailableMessage, 403);
  }
  if (!resolved.registrationEnabled) {
    throw new CustomerAccountError(registrationUnavailableMessage, 403);
  }
  return resolved;
}

async function assertDashboardEnabled(settings?: CustomerSettings) {
  const resolved = await assertAccountsEnabled(settings);
  if (
    !(await featureEnabled(CUSTOMER_DASHBOARD_FLAG)) ||
    !resolved.dashboardEnabled
  ) {
    throw new CustomerAccountError(dashboardUnavailableMessage, 403);
  }
  return resolved;
}

async function createNotification(
  transaction: Prisma.TransactionClient,
  input: {
    userId: string;
    type: CustomerNotificationType;
    title: string;
    body: string;
    orderId?: string | null;
    dedupeKey?: string | null;
    safeMetadata?: Record<string, unknown>;
  },
) {
  if (input.dedupeKey) {
    const existing = await transaction.customerNotification.findFirst({
      where: { userId: input.userId, dedupeKey: input.dedupeKey },
      select: { id: true },
    });
    if (existing) return existing;
  }
  return transaction.customerNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 160),
      body: input.body.slice(0, 500),
      orderId: input.orderId ?? null,
      dedupeKey: input.dedupeKey?.slice(0, 160) ?? null,
      safeMetadata: input.safeMetadata
        ? auditMetadata(input.safeMetadata)
        : undefined,
    },
    select: { id: true },
  });
}

async function createDefaultNotificationPreferences(
  transaction: Prisma.TransactionClient,
  userId: string,
) {
  const types: CustomerNotificationType[] = [
    "ACCOUNT",
    "SECURITY",
    "ORDER_CREATED",
    "ORDER_STATUS_CHANGED",
    "ORDER_PAYMENT_CHANGED",
    "CHAT_MESSAGE",
    "EMAIL_VERIFICATION",
    "PASSWORD_RECOVERY",
  ];
  await transaction.customerNotificationPreference.createMany({
    data: types.map((type) => ({
      userId,
      type,
      inAppEnabled: true,
      emailEnabled: false,
      marketingConsent: false,
    })),
    skipDuplicates: true,
  });
}

async function createCustomerAuthToken(
  transaction: Prisma.TransactionClient,
  input: {
    userId: string;
    purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
    expiresInMinutes: number;
  },
) {
  const rawToken = createCustomerToken();
  const tokenHash = hashCustomerToken(rawToken);
  const now = new Date();
  await transaction.customerAuthToken.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      tokenHash,
      expiresAt: new Date(now.getTime() + input.expiresInMinutes * 60 * 1000),
    },
  });
  return rawToken;
}

async function recordSecurityEvent(
  transaction: Prisma.TransactionClient,
  input: {
    userId: string;
    eventType: Prisma.CustomerSecurityEventUncheckedCreateInput["eventType"];
    context?: RequestContext;
    safeMetadata?: Record<string, unknown>;
  },
) {
  await transaction.customerSecurityEvent.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      ipHash: safeHash(input.context?.ipAddress),
      userAgentHash: safeHash(input.context?.userAgent),
      safeMetadata: input.safeMetadata
        ? auditMetadata(input.safeMetadata)
        : undefined,
    },
  });
}

async function enforceCustomerSessionLimit(userId: string, maximum: number) {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      audience: "CUSTOMER",
      revokedAt: null,
      expires: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const excess = sessions
    .slice(Math.max(1, maximum))
    .map((session) => session.id);
  if (excess.length) {
    await prisma.session.updateMany({
      where: { id: { in: excess } },
      data: { revokedAt: new Date() },
    });
  }
}

function customerSessionExpiry(settings: CustomerSettings) {
  return new Date(
    Date.now() + settings.customerSessionDurationHours * 60 * 60 * 1000,
  );
}

export type RegisterCustomerInput = {
  email: unknown;
  password: unknown;
  passwordConfirmation: unknown;
  displayName: unknown;
  discordUsername?: unknown;
  defaultRsn?: unknown;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  orderTrackingToken?: string | null;
  exposeVerificationTokenForTest?: boolean;
};

export async function registerCustomer(
  input: RegisterCustomerInput,
  context: RequestContext,
) {
  const settings = await assertRegistrationEnabled();
  if (
    !(await consumeCustomerRateLimit({
      identity: `${context.identity}:register`,
      action: "customer-register",
      limit: 6,
    }))
  ) {
    throw new CustomerAccountError("Too many attempts. Try again later.", 429);
  }
  assertNoCredentialLikeFields({
    displayName: input.displayName,
    discordUsername: input.discordUsername,
    defaultRsn: input.defaultRsn,
  });
  const email = customerEmailSchema.parse(input.email);
  const password = customerPasswordSchema.parse(input.password);
  if (password !== input.passwordConfirmation) {
    throw new CustomerAccountError("Password confirmation does not match.");
  }
  if (!input.termsAccepted || !input.privacyAccepted) {
    throw new CustomerAccountError("Accept the terms and privacy policy.");
  }
  const displayName = customerDisplayNameSchema.parse(input.displayName);
  const discordUsername = customerDiscordSchema.parse(
    input.discordUsername ?? "",
  );
  const defaultRsn = normalizeOptionalRsn(input.defaultRsn);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, accountType: true },
  });
  if (existing) {
    throw new CustomerAccountError(
      existing.accountType === "CUSTOMER"
        ? "Registration could not be completed."
        : "Registration could not be completed.",
    );
  }

  const trackingToken = input.orderTrackingToken?.trim() || null;
  let orderToLink: {
    id: string;
    guestContact: { email: string };
    customerOrderLink: { userId: string } | null;
  } | null = null;
  if (trackingToken) {
    if (!isValidSecureToken(trackingToken)) {
      throw new CustomerAccountError("Order tracking link is invalid.");
    }
    orderToLink = await prisma.order.findUnique({
      where: { trackingTokenHash: hashCheckoutToken(trackingToken) },
      select: {
        id: true,
        guestContact: { select: { email: true } },
        customerOrderLink: { select: { userId: true } },
      },
    });
    if (!orderToLink || orderToLink.guestContact.email !== email) {
      throw new CustomerAccountError("Order cannot be linked to this account.");
    }
    if (orderToLink.customerOrderLink) {
      throw new CustomerAccountError("Order already belongs to a customer.");
    }
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const result = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        email,
        name: displayName,
        passwordHash,
        status: "ACTIVE",
        accountType: "CUSTOMER",
      },
      select: { id: true, email: true, name: true },
    });
    await transaction.customerProfile.create({
      data: {
        userId: user.id,
        displayName,
        discordUsername,
        defaultRsn,
        emailVerificationStatus: settings.emailVerificationRequired
          ? settings.notificationProviderConfigured
            ? "PENDING_VERIFICATION"
            : "DELIVERY_UNAVAILABLE"
          : "UNVERIFIED",
        registrationSource: trackingToken
          ? "POST_CHECKOUT_ACCOUNT_CREATION"
          : "PUBLIC_REGISTRATION",
        termsVersion: "needs-client-review",
        privacyPolicyVersion: "needs-client-review",
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
      },
    });
    await createDefaultNotificationPreferences(transaction, user.id);
    const verificationToken = await createCustomerAuthToken(transaction, {
      userId: user.id,
      purpose: "EMAIL_VERIFICATION",
      expiresInMinutes: 60 * 24,
    });
    await createNotification(transaction, {
      userId: user.id,
      type: "EMAIL_VERIFICATION",
      title: "Email verification pending",
      body: settings.notificationProviderConfigured
        ? "Email verification is queued for delivery."
        : providerNotConfiguredMessage,
      dedupeKey: `email-verification:${user.id}`,
      safeMetadata: {
        deliveryStatus: settings.notificationProviderConfigured
          ? "PENDING"
          : "SUPPRESSED_NOT_CONFIGURED",
        templateVersion: CUSTOMER_AUTH_TEMPLATE_VERSION,
      },
    });
    if (orderToLink) {
      await transaction.customerOrderLink.create({
        data: {
          userId: user.id,
          orderId: orderToLink.id,
          source: "POST_CHECKOUT_ACCOUNT_CREATION",
          safeCreatedByContext: "post-checkout",
        },
      });
      await createNotification(transaction, {
        userId: user.id,
        type: "ORDER_CREATED",
        title: "Order linked",
        body: "Your recent order is now visible in your dashboard.",
        orderId: orderToLink.id,
        dedupeKey: `order-linked:${orderToLink.id}`,
      });
    }
    await recordSecurityEvent(transaction, {
      userId: user.id,
      eventType: "REGISTRATION",
      context,
      safeMetadata: {
        source: trackingToken
          ? "POST_CHECKOUT_ACCOUNT_CREATION"
          : "PUBLIC_REGISTRATION",
      },
    });
    await transaction.customerAccountEvent.create({
      data: {
        userId: user.id,
        eventType: "CREATED",
        safeMetadata: auditMetadata({
          source: trackingToken
            ? "POST_CHECKOUT_ACCOUNT_CREATION"
            : "PUBLIC_REGISTRATION",
        }),
      },
    });
    return { user, verificationToken };
  });

  const session = await createSession(
    result.user.id,
    { ipAddress: context.ipAddress, userAgent: context.userAgent },
    { audience: "CUSTOMER", expiresAt: customerSessionExpiry(settings) },
  );
  await enforceCustomerSessionLimit(
    result.user.id,
    settings.maximumActiveCustomerSessions,
  );

  return {
    user: result.user,
    session,
    emailDeliveryStatus: settings.notificationProviderConfigured
      ? "PENDING"
      : "SUPPRESSED_NOT_CONFIGURED",
    verificationToken: input.exposeVerificationTokenForTest
      ? result.verificationToken
      : null,
  };
}

export async function loginCustomer(
  input: { email: unknown; password: unknown },
  context: RequestContext,
) {
  const settings = await assertAccountsEnabled();
  const parsedEmail =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (
    !(await consumeCustomerRateLimit({
      identity: `${context.identity}:login:${parsedEmail || "unknown"}`,
      action: "customer-login",
      limit: 8,
    }))
  ) {
    throw new CustomerAccountError("Too many attempts. Try again later.", 429);
  }
  const result = await authenticateCredentialsWith(
    input,
    (email) =>
      prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          status: true,
          accountType: true,
        },
      }),
    verifyPassword,
    "CUSTOMER",
  );
  if (!result.ok) {
    const existing = parsedEmail
      ? await prisma.user.findUnique({
          where: { email: parsedEmail },
          select: { id: true, accountType: true },
        })
      : null;
    if (existing?.accountType === "CUSTOMER") {
      await prisma.customerSecurityEvent.create({
        data: {
          userId: existing.id,
          eventType: "LOGIN_FAILED",
          ipHash: safeHash(context.ipAddress),
          userAgentHash: safeHash(context.userAgent),
          safeMetadata: auditMetadata({ reason: "generic_failure" }),
        },
      });
    }
    throw new CustomerAccountError("Email or password is incorrect.", 401);
  }
  const session = await createSession(
    result.user.id,
    { ipAddress: context.ipAddress, userAgent: context.userAgent },
    { audience: "CUSTOMER", expiresAt: customerSessionExpiry(settings) },
  );
  await enforceCustomerSessionLimit(
    result.user.id,
    settings.maximumActiveCustomerSessions,
  );
  await prisma.customerSecurityEvent.create({
    data: {
      userId: result.user.id,
      eventType: "LOGIN_SUCCESS",
      ipHash: safeHash(context.ipAddress),
      userAgentHash: safeHash(context.userAgent),
      safeMetadata: auditMetadata({ sessionRotated: true }),
    },
  });
  return { user: result.user, session };
}

export async function logoutCustomer(userId?: string | null) {
  if (userId) {
    await prisma.customerSecurityEvent.create({
      data: { userId, eventType: "LOGOUT" },
    });
  }
  await deleteCurrentCustomerSession();
}

export async function updateCustomerProfile(
  userId: string,
  input: {
    displayName: unknown;
    discordUsername?: unknown;
    defaultRsn?: unknown;
    timezone?: unknown;
    locale?: unknown;
    expectedVersion: number;
  },
) {
  await assertAccountsEnabled();
  assertNoCredentialLikeFields(input);
  const displayName = customerDisplayNameSchema.parse(input.displayName);
  const discordUsername = customerDiscordSchema.parse(
    input.discordUsername ?? "",
  );
  const defaultRsn = normalizeOptionalRsn(input.defaultRsn);
  const timezone = customerTimezoneSchema.parse(input.timezone ?? "");
  const locale = customerLocaleSchema.parse(input.locale ?? "");
  const updated = await prisma.customerProfile.updateMany({
    where: { userId, concurrencyVersion: input.expectedVersion },
    data: {
      displayName,
      discordUsername,
      defaultRsn,
      timezone,
      locale,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new CustomerAccountError("Profile changed before save.", 409);
  }
  await prisma.customerSecurityEvent.create({
    data: {
      userId,
      eventType: "PROFILE_UPDATED",
      safeMetadata: auditMetadata({ profileUpdated: true }),
    },
  });
  return getCustomerProfile(userId);
}

export async function getCustomerProfile(userId: string) {
  return prisma.customerProfile.findUniqueOrThrow({
    where: { userId },
    select: {
      displayName: true,
      discordUsername: true,
      defaultRsn: true,
      timezone: true,
      locale: true,
      emailVerificationStatus: true,
      emailVerifiedAt: true,
      needsReview: true,
      concurrencyVersion: true,
    },
  });
}

export async function changeCustomerPassword(
  userId: string,
  input: {
    currentPassword: unknown;
    newPassword: unknown;
    newPasswordConfirmation: unknown;
  },
  context: CustomerSessionContext,
) {
  await assertAccountsEnabled();
  const currentPassword = customerPasswordSchema.parse(input.currentPassword);
  const newPassword = customerPasswordSchema.parse(input.newPassword);
  if (newPassword !== input.newPasswordConfirmation) {
    throw new CustomerAccountError("Password confirmation does not match.");
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true, accountType: true, status: true },
  });
  if (user.accountType !== "CUSTOMER" || user.status !== "ACTIVE") {
    throw new CustomerAccountError("Password could not be changed.", 403);
  }
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new CustomerAccountError("Current password is incorrect.", 400);
  }
  const nextHash = await hashPassword(newPassword);
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: { passwordHash: nextHash },
    });
    await recordSecurityEvent(transaction, {
      userId,
      eventType: "PASSWORD_CHANGED",
      context,
      safeMetadata: { otherSessionsRevoked: true },
    });
  });
  const settings = await getCustomerAccountSettings();
  const session = await createSession(
    userId,
    { ipAddress: context.ipAddress, userAgent: context.userAgent },
    { audience: "CUSTOMER", expiresAt: customerSessionExpiry(settings) },
  );
  await revokeOtherCustomerSessions({ userId, keepSessionId: session.id });
  return { session };
}

export async function listCustomerSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, audience: "CUSTOMER", expires: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      lastSeenAt: true,
      expires: true,
      revokedAt: true,
      ipAddress: true,
      userAgent: true,
    },
  });
  return sessions.map((session) => ({
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    lastSeenAt: session.lastSeenAt.toISOString(),
    expires: session.expires.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
    ipHashPresent: Boolean(session.ipAddress),
    userAgentSummary: session.userAgent
      ? session.userAgent.slice(0, 80)
      : "Unknown device",
  }));
}

export async function revokeOwnCustomerSession(
  userId: string,
  sessionId: string,
) {
  await revokeCustomerSession({ userId, sessionId });
  await prisma.customerSecurityEvent.create({
    data: {
      userId,
      eventType: "SESSION_REVOKED",
      safeMetadata: auditMetadata({ selfService: true }),
    },
  });
}

export async function requestPasswordRecovery(
  input: { email: unknown },
  context: RequestContext,
) {
  const settings = await assertAccountsEnabled();
  if (!settings.passwordRecoveryEnabled) {
    return {
      message: providerNotConfiguredMessage,
      deliveryStatus: "SUPPRESSED_NOT_CONFIGURED",
    };
  }
  const email = customerEmailSchema.safeParse(input.email);
  const identityEmail = email.success ? email.data : "invalid";
  if (
    !(await consumeCustomerRateLimit({
      identity: `${context.identity}:recovery:${identityEmail}`,
      action: "customer-recovery",
      limit: 5,
    }))
  ) {
    return {
      message:
        "If the account can be recovered, instructions will be prepared.",
      deliveryStatus: "RATE_LIMITED",
    };
  }
  if (email.success) {
    const user = await prisma.user.findUnique({
      where: { email: email.data },
      select: { id: true, accountType: true, status: true },
    });
    if (user?.accountType === "CUSTOMER" && user.status === "ACTIVE") {
      await prisma.$transaction(async (transaction) => {
        await createCustomerAuthToken(transaction, {
          userId: user.id,
          purpose: "PASSWORD_RESET",
          expiresInMinutes: 60,
        });
        await createNotification(transaction, {
          userId: user.id,
          type: "PASSWORD_RECOVERY",
          title: "Password recovery requested",
          body: settings.notificationProviderConfigured
            ? "Password recovery is queued for delivery."
            : providerNotConfiguredMessage,
          dedupeKey: `password-recovery:${user.id}:${Date.now()}`,
          safeMetadata: {
            deliveryStatus: settings.notificationProviderConfigured
              ? "PENDING"
              : "SUPPRESSED_NOT_CONFIGURED",
          },
        });
        await recordSecurityEvent(transaction, {
          userId: user.id,
          eventType: "PASSWORD_RESET_REQUESTED",
          context,
          safeMetadata: {
            deliveryStatus: settings.notificationProviderConfigured
              ? "PENDING"
              : "SUPPRESSED_NOT_CONFIGURED",
          },
        });
      });
    }
  }
  return {
    message: settings.notificationProviderConfigured
      ? "If the account can be recovered, instructions will be prepared."
      : providerNotConfiguredMessage,
    deliveryStatus: settings.notificationProviderConfigured
      ? "PENDING"
      : "SUPPRESSED_NOT_CONFIGURED",
  };
}

export async function resetCustomerPasswordWithToken(input: {
  token: string;
  password: unknown;
  passwordConfirmation: unknown;
}) {
  await assertAccountsEnabled();
  if (!isValidCustomerToken(input.token)) {
    throw new CustomerAccountError("Password reset link is invalid.", 400);
  }
  const password = customerPasswordSchema.parse(input.password);
  if (password !== input.passwordConfirmation) {
    throw new CustomerAccountError("Password confirmation does not match.");
  }
  const tokenHash = hashCustomerToken(input.token);
  const record = await prisma.customerAuthToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { accountType: true, status: true } } },
  });
  if (
    !record ||
    record.purpose !== "PASSWORD_RESET" ||
    record.status !== "ACTIVE" ||
    record.expiresAt <= new Date() ||
    !timingSafeTokenHashEquals(record.tokenHash, tokenHash) ||
    record.user.accountType !== "CUSTOMER" ||
    record.user.status !== "ACTIVE"
  ) {
    throw new CustomerAccountError("Password reset link is invalid.", 400);
  }
  const nextHash = await hashPassword(password);
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: record.userId },
      data: { passwordHash: nextHash },
    });
    await transaction.customerAuthToken.update({
      where: { id: record.id },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });
    await transaction.session.updateMany({
      where: { userId: record.userId, audience: "CUSTOMER", revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordSecurityEvent(transaction, {
      userId: record.userId,
      eventType: "PASSWORD_RESET_COMPLETED",
      safeMetadata: { sessionsRevoked: true },
    });
  });
  return { ok: true };
}

export async function verifyCustomerEmailToken(token: string) {
  await assertAccountsEnabled();
  if (!isValidCustomerToken(token)) {
    throw new CustomerAccountError("Verification link is invalid.", 400);
  }
  const tokenHash = hashCustomerToken(token);
  const record = await prisma.customerAuthToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { customerProfile: true } } },
  });
  if (!record || !timingSafeTokenHashEquals(record.tokenHash, tokenHash)) {
    throw new CustomerAccountError("Verification link is invalid.", 400);
  }
  if (
    record.purpose !== "EMAIL_VERIFICATION" ||
    record.user.accountType !== "CUSTOMER" ||
    record.user.status !== "ACTIVE"
  ) {
    throw new CustomerAccountError("Verification link is invalid.", 400);
  }
  if (
    record.status === "CONSUMED" &&
    record.user.customerProfile?.emailVerifiedAt
  ) {
    return { ok: true, idempotent: true };
  }
  if (record.status !== "ACTIVE" || record.expiresAt <= new Date()) {
    await prisma.customerAuthToken.updateMany({
      where: { id: record.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    throw new CustomerAccountError("Verification link is invalid.", 400);
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    });
    await transaction.customerProfile.update({
      where: { userId: record.userId },
      data: {
        emailVerificationStatus: "VERIFIED",
        emailVerifiedAt: new Date(),
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.customerAuthToken.update({
      where: { id: record.id },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });
    await recordSecurityEvent(transaction, {
      userId: record.userId,
      eventType: "EMAIL_VERIFIED",
    });
  });
  return { ok: true, idempotent: false };
}

export async function claimOrderWithTrackingToken(
  userId: string,
  trackingToken: string,
) {
  await assertAccountsEnabled();
  if (!isValidSecureToken(trackingToken)) {
    throw new CustomerAccountError("Order tracking link is invalid.", 400);
  }
  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, accountType: true, status: true },
  });
  if (
    !customer ||
    customer.accountType !== "CUSTOMER" ||
    customer.status !== "ACTIVE"
  ) {
    throw new CustomerAccountError("Order cannot be claimed.", 403);
  }
  const tokenHash = hashCheckoutToken(trackingToken);
  const order = await prisma.order.findUnique({
    where: { trackingTokenHash: tokenHash },
    include: {
      guestContact: { select: { email: true } },
      customerOrderLink: true,
    },
  });
  if (!order) {
    throw new CustomerAccountError("Order tracking link is invalid.", 400);
  }
  if (order.guestContact.email !== customer.email) {
    throw new CustomerAccountError(
      "Order cannot be claimed by this account.",
      403,
    );
  }
  if (order.customerOrderLink) {
    if (order.customerOrderLink.userId === userId) {
      return { idempotent: true, orderId: order.id };
    }
    throw new CustomerAccountError(
      "Order already belongs to another customer.",
      409,
    );
  }
  await prisma.$transaction(async (transaction) => {
    const link = await transaction.customerOrderLink.create({
      data: {
        userId,
        orderId: order.id,
        source: "SECURE_GUEST_CLAIM",
        safeCreatedByContext: "self-service-claim",
      },
      select: { id: true },
    });
    await transaction.customerOrderClaimEvent.create({
      data: {
        userId,
        orderId: order.id,
        orderLinkId: link.id,
        source: "SECURE_GUEST_CLAIM",
        result: "CLAIMED",
        safeMetadata: auditMetadata({ emailMatched: true }),
      },
    });
    await createNotification(transaction, {
      userId,
      type: "ORDER_CREATED",
      title: "Order claimed",
      body: "The order is now available in your dashboard.",
      orderId: order.id,
      dedupeKey: `order-claimed:${order.id}`,
    });
    await recordSecurityEvent(transaction, {
      userId,
      eventType: "ORDER_CLAIMED",
      safeMetadata: { orderLinked: true },
    });
  });
  return { idempotent: false, orderId: order.id };
}

export async function linkAuthenticatedCheckoutOrder({
  userId,
  orderId,
  transaction,
}: {
  userId: string;
  orderId: string;
  transaction: Prisma.TransactionClient;
}) {
  await transaction.customerOrderLink.create({
    data: {
      userId,
      orderId,
      source: "AUTHENTICATED_CHECKOUT",
      safeCreatedByContext: "authenticated-checkout",
    },
  });
  await createNotification(transaction, {
    userId,
    type: "ORDER_CREATED",
    title: "Order created",
    body: "Your order was created and is available in your dashboard.",
    orderId,
    dedupeKey: `order-created:${orderId}`,
  });
}

export async function notifyLinkedOrderCustomer({
  transaction,
  orderId,
  type,
  title,
  body,
  dedupeKey,
  safeMetadata,
}: {
  transaction: Prisma.TransactionClient;
  orderId: string;
  type: CustomerNotificationType;
  title: string;
  body: string;
  dedupeKey: string;
  safeMetadata?: Record<string, unknown>;
}) {
  const link = await transaction.customerOrderLink.findUnique({
    where: { orderId },
    select: { userId: true },
  });
  if (!link) return;
  await createNotification(transaction, {
    userId: link.userId,
    orderId,
    type,
    title,
    body,
    dedupeKey,
    safeMetadata,
  });
}

function formatCents(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function customerOrderSummary(order: {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  currencyCode: string;
  finalTotalCents: number;
  createdAt: Date;
  items: Array<{ id: string; publicTitle: string }>;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: orderStatusLabels[order.status],
    statusMessage: customerOrderStatusMessages[order.status],
    paymentStatus: order.paymentStatus,
    paymentStatusLabel: orderPaymentStatusLabels[order.paymentStatus],
    total: formatCents(order.finalTotalCents, order.currencyCode),
    createdAt: order.createdAt.toISOString(),
    itemCount: order.items.length,
    primaryItem: order.items[0]?.publicTitle ?? "Order",
  };
}

export async function getCustomerDashboard(userId: string) {
  const [settings, profile, orders, unreadCount] = await Promise.all([
    assertDashboardEnabled(),
    getCustomerProfile(userId),
    prisma.order.findMany({
      where: { customerOrderLink: { userId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        currencyCode: true,
        finalTotalCents: true,
        createdAt: true,
        items: { select: { id: true, publicTitle: true } },
      },
    }),
    prisma.customerNotification.count({
      where: { userId, status: "UNREAD" },
    }),
  ]);
  return {
    settings,
    profile,
    orders: orders.map(customerOrderSummary),
    unreadCount,
  };
}

export async function getCustomerOrders(userId: string) {
  await assertDashboardEnabled();
  const orders = await prisma.order.findMany({
    where: { customerOrderLink: { userId } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      currencyCode: true,
      finalTotalCents: true,
      createdAt: true,
      items: { select: { id: true, publicTitle: true } },
    },
  });
  return orders.map(customerOrderSummary);
}

export async function getCustomerOrderDetail(
  userId: string,
  orderNumber: string,
) {
  await assertDashboardEnabled();
  const order = await prisma.order.findFirst({
    where: { orderNumber, customerOrderLink: { userId } },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          publicTitle: true,
          publicConfigurationSummary: true,
          quantity: true,
          currencyCode: true,
          finalTotalCents: true,
          resourceReservationState: true,
        },
      },
      statusEvents: {
        orderBy: { sequence: "asc" },
        select: {
          eventType: true,
          newStatus: true,
          publicNote: true,
          createdAt: true,
        },
      },
      paymentEvents: {
        orderBy: { sequence: "asc" },
        select: {
          newPaymentStatus: true,
          publicNote: true,
          createdAt: true,
        },
      },
    },
  });
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: orderStatusLabels[order.status],
    statusMessage: customerOrderStatusMessages[order.status],
    paymentStatus: order.paymentStatus,
    paymentStatusLabel: orderPaymentStatusLabels[order.paymentStatus],
    emailDeliveryMessage: emailNotConfiguredMessage,
    currencyCode: order.currencyCode,
    subtotalCents: order.subtotalCents,
    adjustmentTotalCents: order.adjustmentTotalCents,
    finalTotalCents: order.finalTotalCents,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      publicTitle: item.publicTitle,
      publicConfigurationSummary: item.publicConfigurationSummary,
      quantity: item.quantity.toString(),
      currencyCode: item.currencyCode,
      finalTotal: formatCents(item.finalTotalCents, item.currencyCode),
      resourceReservationState: item.resourceReservationState,
    })),
    statusTimeline: order.statusEvents.map((event) => ({
      eventType: event.eventType,
      status: event.newStatus,
      label: orderStatusLabels[event.newStatus],
      message: event.publicNote ?? customerOrderStatusMessages[event.newStatus],
      createdAt: event.createdAt.toISOString(),
    })),
    paymentTimeline: order.paymentEvents.map((event) => ({
      paymentStatus: event.newPaymentStatus,
      label: orderPaymentStatusLabels[event.newPaymentStatus],
      message: event.publicNote ?? "Payment state updated.",
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function getCustomerNotifications(userId: string) {
  await assertDashboardEnabled();
  const notifications = await prisma.customerNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      status: true,
      title: true,
      body: true,
      readAt: true,
      createdAt: true,
      order: { select: { orderNumber: true } },
    },
  });
  return notifications.map((notification) => ({
    ...notification,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    orderNumber: notification.order?.orderNumber ?? null,
  }));
}

export async function getCustomerNotificationPreferences(userId: string) {
  await assertDashboardEnabled();
  return prisma.customerNotificationPreference.findMany({
    where: { userId },
    orderBy: { type: "asc" },
    select: {
      id: true,
      type: true,
      inAppEnabled: true,
      emailEnabled: true,
      marketingConsent: true,
      concurrencyVersion: true,
    },
  });
}

export async function updateCustomerNotificationPreference(
  userId: string,
  input: {
    type: CustomerNotificationType;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    marketingConsent: boolean;
    expectedVersion: number;
  },
) {
  await assertDashboardEnabled();
  const updated = await prisma.customerNotificationPreference.updateMany({
    where: {
      userId,
      type: input.type,
      concurrencyVersion: input.expectedVersion,
    },
    data: {
      inAppEnabled: input.inAppEnabled,
      emailEnabled: input.emailEnabled,
      marketingConsent: input.marketingConsent,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new CustomerAccountError(
      "Notification preference changed before save.",
      409,
    );
  }
}

export async function markCustomerNotificationRead(
  userId: string,
  notificationId: string,
) {
  await prisma.customerNotification.updateMany({
    where: { id: notificationId, userId },
    data: { status: "READ", readAt: new Date() },
  });
}

export async function markAllCustomerNotificationsRead(userId: string) {
  await prisma.customerNotification.updateMany({
    where: { userId, status: "UNREAD" },
    data: { status: "READ", readAt: new Date() },
  });
}

export function sanitizeCustomerError(error: unknown) {
  if (error instanceof CustomerAccountError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof Error && error.name === "ZodError") {
    return { message: "Check the account details and try again.", status: 400 };
  }
  return {
    message: "The account request could not be completed safely.",
    status: 500,
  };
}

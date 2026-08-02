import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { safeJson } from "@/lib/customer/security";

export class CustomerAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerAdminError";
  }
}

function auditMetadata(value: Record<string, unknown>) {
  return safeJson(value) as Prisma.InputJsonValue;
}

export const customerSettingsInputSchema = z.object({
  id: z.string().min(1),
  registrationEnabled: z.boolean(),
  dashboardEnabled: z.boolean(),
  emailVerificationRequired: z.boolean(),
  passwordRecoveryEnabled: z.boolean(),
  customerSessionDurationHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30),
  maximumActiveCustomerSessions: z.coerce.number().int().min(1).max(20),
  publicRegistrationInstructions: z.string().trim().min(1).max(4000),
  publicRecoveryInstructions: z.string().trim().min(1).max(4000),
  needsClientReview: z.boolean(),
});

export async function getAdminCustomerSettings() {
  return prisma.customerAccountSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

export async function getAdminCustomers() {
  return prisma.user.findMany({
    where: { accountType: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
      customerProfile: {
        select: {
          displayName: true,
          emailVerificationStatus: true,
          needsReview: true,
        },
      },
      customerOrderLinks: { select: { id: true } },
      sessions: {
        where: {
          audience: "CUSTOMER",
          revokedAt: null,
          expires: { gt: new Date() },
        },
        select: { id: true },
      },
    },
  });
}

export async function getAdminCustomerDetail(customerId: string) {
  return prisma.user.findFirst({
    where: { id: customerId, accountType: "CUSTOMER" },
    include: {
      roles: { include: { role: { include: { permissions: true } } } },
      customerProfile: true,
      customerOrderLinks: {
        orderBy: { linkedAt: "desc" },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paymentStatus: true,
              finalTotalCents: true,
              currencyCode: true,
              createdAt: true,
            },
          },
        },
      },
      customerNotifications: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      customerSecurityEvents: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      sessions: {
        where: { audience: "CUSTOMER" },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function updateAdminCustomerSettings({
  input,
  expectedVersion,
  actorId,
}: {
  input: z.infer<typeof customerSettingsInputSchema>;
  expectedVersion: number;
  actorId: string;
}) {
  const updated = await prisma.customerAccountSettings.updateMany({
    where: { id: input.id, concurrencyVersion: expectedVersion },
    data: {
      registrationEnabled: input.registrationEnabled,
      dashboardEnabled: input.dashboardEnabled,
      emailVerificationRequired: input.emailVerificationRequired,
      passwordRecoveryEnabled: input.passwordRecoveryEnabled,
      customerSessionDurationHours: input.customerSessionDurationHours,
      maximumActiveCustomerSessions: input.maximumActiveCustomerSessions,
      publicRegistrationInstructions: input.publicRegistrationInstructions,
      publicRecoveryInstructions: input.publicRecoveryInstructions,
      needsClientReview: input.needsClientReview,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new CustomerAdminError("Customer settings changed before save.");
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "customers.settings.updated",
      targetType: "CustomerAccountSettings",
      targetId: input.id,
      metadata: auditMetadata({
        registrationEnabled: input.registrationEnabled,
        dashboardEnabled: input.dashboardEnabled,
        emailVerificationRequired: input.emailVerificationRequired,
        passwordRecoveryEnabled: input.passwordRecoveryEnabled,
      }),
    },
  });
}

export async function setCustomerAccountStatus({
  customerId,
  expectedVersion,
  status,
  actorId,
  reason,
}: {
  customerId: string;
  expectedVersion: number;
  status: "ACTIVE" | "DISABLED";
  actorId: string;
  reason: string;
}) {
  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.updateMany({
      where: {
        id: customerId,
        accountType: "CUSTOMER",
        customerProfile: { is: { concurrencyVersion: expectedVersion } },
      },
      data: { status },
    });
    if (updated.count !== 1) {
      throw new CustomerAdminError("Customer account changed before update.");
    }
    await transaction.customerProfile.update({
      where: { userId: customerId },
      data: { concurrencyVersion: { increment: 1 } },
    });
    if (status === "DISABLED") {
      await transaction.session.updateMany({
        where: {
          userId: customerId,
          audience: "CUSTOMER",
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }
    await transaction.customerSecurityEvent.create({
      data: {
        userId: customerId,
        eventType:
          status === "DISABLED" ? "ACCOUNT_DISABLED" : "ACCOUNT_ENABLED",
        safeMetadata: auditMetadata({ adminAction: true }),
      },
    });
    await transaction.customerAccountEvent.create({
      data: {
        userId: customerId,
        actorId,
        eventType: status === "DISABLED" ? "DISABLED" : "ENABLED",
        safeMetadata: auditMetadata({
          reason: reason.slice(0, 240),
          sessionsRevoked: status === "DISABLED",
        }),
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action:
          status === "DISABLED"
            ? "customers.account.disabled"
            : "customers.account.enabled",
        targetType: "User",
        targetId: customerId,
        metadata: auditMetadata({
          reasonCode: reason.slice(0, 80) || "ADMIN_REVIEW",
          sessionsRevoked: status === "DISABLED",
        }),
      },
    });
  });
}

export async function revokeAdminCustomerSession({
  customerId,
  sessionId,
  actorId,
}: {
  customerId: string;
  sessionId: string;
  actorId: string;
}) {
  await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId: customerId,
      audience: "CUSTOMER",
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "customers.session.revoked",
      targetType: "Session",
      targetId: sessionId,
      metadata: auditMetadata({ customerId }),
    },
  });
}

export function customerAdminActionErrorMessage(error: unknown) {
  if (error instanceof CustomerAdminError) return error.message;
  if (error instanceof Error && error.name === "ZodError") {
    return "Check the customer details.";
  }
  return "Customer action could not be completed.";
}

import "server-only";

import { z } from "zod";

import {
  CheckoutSecurityError,
  normalizePlainText,
} from "@/lib/checkout/security";
import { prisma } from "@/lib/db/prisma";

export const checkoutSettingsInputSchema = z.object({
  id: z.string().trim().min(1).max(30),
  maximumCartItems: z.coerce.number().int().min(1).max(50),
  cartExpiryMinutes: z.coerce.number().int().min(15).max(10080),
  checkoutReservationMinutes: z.coerce.number().int().min(5).max(240),
  orderNumberPrefix: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Za-z0-9]+$/),
  termsVersion: z.string().trim().min(1).max(80),
  privacyPolicyVersion: z.string().trim().min(1).max(80),
  publicCheckoutInstructions: z.unknown(),
  publicPaymentReviewInstructions: z.unknown(),
  guestCheckoutEnabled: z.boolean(),
  needsClientReview: z.boolean(),
});

export const checkoutPaymentMethodInputSchema = z.object({
  id: z.string().trim().min(1).max(30),
  publicName: z.string().trim().min(3).max(120),
  publicDescription: z.unknown(),
  publicInstructions: z.unknown(),
  enabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  needsClientReview: z.boolean(),
});

export function checkoutActionErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Checkout settings could not be saved.";
}

export async function getAdminCheckoutConfiguration() {
  return prisma.checkoutSettings.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      paymentMethods: {
        orderBy: [{ sortOrder: "asc" }, { publicName: "asc" }],
      },
    },
  });
}

function assertUpdated(count: number) {
  if (count !== 1) {
    throw new CheckoutSecurityError(
      "Checkout configuration changed before this update could be saved.",
    );
  }
}

export async function updateCheckoutSettings({
  input,
  expectedVersion,
  actorId,
}: {
  input: z.infer<typeof checkoutSettingsInputSchema>;
  expectedVersion: number;
  actorId: string;
}) {
  const updated = await prisma.checkoutSettings.updateMany({
    where: { id: input.id, concurrencyVersion: expectedVersion },
    data: {
      maximumCartItems: input.maximumCartItems,
      cartExpiryMinutes: input.cartExpiryMinutes,
      checkoutReservationMinutes: input.checkoutReservationMinutes,
      orderNumberPrefix: input.orderNumberPrefix.toUpperCase(),
      termsVersion: input.termsVersion,
      privacyPolicyVersion: input.privacyPolicyVersion,
      publicCheckoutInstructions: normalizePlainText(
        input.publicCheckoutInstructions,
        4000,
      ),
      publicPaymentReviewInstructions: normalizePlainText(
        input.publicPaymentReviewInstructions,
        4000,
      ),
      guestCheckoutEnabled: input.guestCheckoutEnabled,
      needsClientReview: input.needsClientReview,
      notificationProviderConfigured: false,
      concurrencyVersion: { increment: 1 },
    },
  });
  assertUpdated(updated.count);
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "checkout.settings.updated",
      targetType: "CheckoutSettings",
      targetId: input.id,
      metadata: {
        guestCheckoutEnabled: input.guestCheckoutEnabled,
        needsClientReview: input.needsClientReview,
        notificationProviderConfigured: false,
      },
    },
  });
}

export async function updateCheckoutPaymentMethod({
  input,
  expectedVersion,
  actorId,
}: {
  input: z.infer<typeof checkoutPaymentMethodInputSchema>;
  expectedVersion: number;
  actorId: string;
}) {
  const updated = await prisma.checkoutPaymentMethod.updateMany({
    where: {
      id: input.id,
      methodType: "MANUAL_REVIEW",
      concurrencyVersion: expectedVersion,
    },
    data: {
      publicName: input.publicName,
      publicDescription: normalizePlainText(input.publicDescription, 500),
      publicInstructions: normalizePlainText(input.publicInstructions, 4000),
      enabled: input.enabled,
      sortOrder: input.sortOrder,
      needsClientReview: input.needsClientReview,
      concurrencyVersion: { increment: 1 },
    },
  });
  assertUpdated(updated.count);
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "checkout.payment_method.updated",
      targetType: "CheckoutPaymentMethod",
      targetId: input.id,
      metadata: {
        enabled: input.enabled,
        methodType: "MANUAL_REVIEW",
        needsClientReview: input.needsClientReview,
      },
    },
  });
}

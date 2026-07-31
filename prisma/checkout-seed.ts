import type { PrismaClient } from "../src/generated/prisma/client";

export async function seedCheckout(prisma: PrismaClient) {
  const settings = await prisma.checkoutSettings.upsert({
    where: { stableKey: "checkout-default-settings" },
    create: {
      stableKey: "checkout-default-settings",
      currencyCode: "USD",
      maximumCartItems: 12,
      cartExpiryMinutes: 4320,
      checkoutReservationMinutes: 45,
      orderNumberPrefix: "OSRS",
      termsVersion: "needs-client-review",
      privacyPolicyVersion: "needs-client-review",
      publicCheckoutInstructions:
        "Guest checkout is prepared for manual review. A staff member will confirm availability and next steps.",
      publicPaymentReviewInstructions:
        "Payment instructions will be provided after your order is reviewed. Do not submit card details, passwords, PINs, recovery answers or other secrets.",
      guestCheckoutEnabled: false,
      notificationProviderConfigured: false,
      needsClientReview: true,
    },
    update: {
      currencyCode: "USD",
      publicCheckoutInstructions:
        "Guest checkout is prepared for manual review. A staff member will confirm availability and next steps.",
      publicPaymentReviewInstructions:
        "Payment instructions will be provided after your order is reviewed. Do not submit card details, passwords, PINs, recovery answers or other secrets.",
      notificationProviderConfigured: false,
      needsClientReview: true,
    },
    select: { id: true },
  });

  await prisma.checkoutPaymentMethod.upsert({
    where: { stableKey: "manual-review" },
    create: {
      stableKey: "manual-review",
      settingsId: settings.id,
      methodType: "MANUAL_REVIEW",
      publicName: "Manual payment review",
      publicDescription:
        "Staff will review the order and provide safe payment instructions outside this form.",
      publicInstructions:
        "No live payment provider is connected. Wait for staff review before sending payment.",
      enabled: true,
      sortOrder: 0,
      needsClientReview: true,
    },
    update: {
      settingsId: settings.id,
      methodType: "MANUAL_REVIEW",
      publicName: "Manual payment review",
      publicDescription:
        "Staff will review the order and provide safe payment instructions outside this form.",
      publicInstructions:
        "No live payment provider is connected. Wait for staff review before sending payment.",
      enabled: true,
      sortOrder: 0,
      needsClientReview: true,
    },
  });
}

import type {
  CartItemKind,
  CatalogueCategory,
  CatalogueService,
  PaymentEligibilityMode,
  PrismaClient,
} from "../src/generated/prisma/client";

const task016Templates = [
  {
    stableKey: "task016-verify-email-v1",
    templateType: "VERIFY_EMAIL" as const,
    version: "task016-v1",
    subject: "Verify your OSRS Services email",
    htmlBody:
      '<p>Hi {{displayName}},</p><p>Use the secure verification link to finish reviewing your customer account email.</p><p><a href="{{verificationUrl}}">Verify email</a></p><p>If you did not request this, ignore this message.</p>',
    textBody:
      "Hi {{displayName}},\n\nUse this secure verification link to finish reviewing your customer account email:\n{{verificationUrl}}\n\nIf you did not request this, ignore this message.",
  },
  {
    stableKey: "task016-password-reset-v1",
    templateType: "PASSWORD_RESET" as const,
    version: "task016-v1",
    subject: "Reset your OSRS Services password",
    htmlBody:
      '<p>Hi {{displayName}},</p><p>Use the secure reset link to choose a new password. The link expires soon and can be used once.</p><p><a href="{{resetUrl}}">Reset password</a></p>',
    textBody:
      "Hi {{displayName}},\n\nUse this secure reset link to choose a new password. The link expires soon and can be used once:\n{{resetUrl}}",
  },
  {
    stableKey: "task016-order-confirmation-v1",
    templateType: "ORDER_CONFIRMATION" as const,
    version: "task016-v1",
    subject: "Order {{orderNumber}} received",
    htmlBody:
      "<p>Your order {{orderNumber}} was received for review.</p><p>Total: {{orderTotal}}</p><p>Keep your secure tracking link available. Staff will confirm safe next steps.</p>",
    textBody:
      "Your order {{orderNumber}} was received for review.\nTotal: {{orderTotal}}\nKeep your secure tracking link available. Staff will confirm safe next steps.",
  },
  {
    stableKey: "task016-payment-received-v1",
    templateType: "PAYMENT_RECEIVED" as const,
    version: "task016-v1",
    subject: "Payment received for order {{orderNumber}}",
    htmlBody:
      "<p>Payment was confirmed for order {{orderNumber}}.</p><p>Staff will prepare the next safe step.</p>",
    textBody:
      "Payment was confirmed for order {{orderNumber}}.\nStaff will prepare the next safe step.",
  },
  {
    stableKey: "task016-payment-failed-v1",
    templateType: "PAYMENT_FAILED" as const,
    version: "task016-v1",
    subject: "Payment update for order {{orderNumber}}",
    htmlBody:
      "<p>Payment could not be verified for order {{orderNumber}}.</p><p>No card or account credentials are accepted by email. Contact support for safe next steps.</p>",
    textBody:
      "Payment could not be verified for order {{orderNumber}}.\nNo card or account credentials are accepted by email. Contact support for safe next steps.",
  },
  {
    stableKey: "task016-order-status-update-v1",
    templateType: "ORDER_STATUS_UPDATE" as const,
    version: "task016-v1",
    subject: "Order {{orderNumber}} status updated",
    htmlBody:
      "<p>Order {{orderNumber}} was updated to {{orderStatus}}.</p><p>Open your secure order view for customer-safe details.</p>",
    textBody:
      "Order {{orderNumber}} was updated to {{orderStatus}}.\nOpen your secure order view for customer-safe details.",
  },
] as const;

const readinessDefaults = [
  {
    stableKey: "database",
    category: "Database",
    label: "MySQL migrations",
    status: "NEEDS_CLIENT_REVIEW" as const,
    safeSummary:
      "Production database, migration deployment and restore testing require client review.",
  },
  {
    stableKey: "authentication",
    category: "Authentication",
    label: "Session and admin credentials",
    status: "NEEDS_CLIENT_REVIEW" as const,
    safeSummary:
      "Production secrets, secure cookies and admin seed reset policy must be verified.",
  },
  {
    stableKey: "email",
    category: "Email",
    label: "SMTP delivery",
    status: "DISABLED" as const,
    safeSummary:
      "Email delivery is disabled until SMTP sender details are configured.",
  },
  {
    stableKey: "payments",
    category: "Payments",
    label: "Provider approval",
    status: "NEEDS_CLIENT_REVIEW" as const,
    safeSummary:
      "External payments require merchant confirmation for each product and service category.",
  },
  {
    stableKey: "checkout",
    category: "Checkout",
    label: "Terms, privacy and refund links",
    status: "NEEDS_CLIENT_REVIEW" as const,
    safeSummary:
      "Guest checkout preview uses manual review while legal-policy versions still require client review.",
  },
  {
    stableKey: "customer-accounts",
    category: "Customer accounts",
    label: "Customer account activation",
    status: "NEEDS_CLIENT_REVIEW" as const,
    safeSummary:
      "Customer account preview is enabled while SMTP delivery and operating policy still require review.",
  },
  {
    stableKey: "chat",
    category: "Chat",
    label: "Chat gateway and origins",
    status: "DISABLED" as const,
    safeSummary:
      "Chat remains disabled until origins, process management and realtime expectations are reviewed.",
  },
  {
    stableKey: "storage",
    category: "Storage",
    label: "Private attachment storage",
    status: "NEEDS_CLIENT_REVIEW" as const,
    safeSummary:
      "Private attachment root must be outside public assets and included in backups.",
  },
] as const;

const cartKindEligibility: Record<CartItemKind, PaymentEligibilityMode> = {
  SKILLING_ESTIMATE: "PROVIDER_REVIEW_REQUIRED",
  BOSSING_ESTIMATE: "PROVIDER_REVIEW_REQUIRED",
  PREMIUM_ESTIMATE: "PROVIDER_REVIEW_REQUIRED",
  CATALOGUE_OFFERING_ESTIMATE: "PROVIDER_REVIEW_REQUIRED",
  PRODUCT_ESTIMATE: "MANUAL_ONLY",
  ACCOUNT_LISTING_ESTIMATE: "MANUAL_ONLY",
  GOLD_BUY_ESTIMATE: "MANUAL_ONLY",
  ACCEPTED_CUSTOM_BUILD_QUOTE: "MANUAL_ONLY",
};

function categoryMode(category: Pick<CatalogueCategory, "slug" | "name">) {
  const text = `${category.slug} ${category.name}`.toLowerCase();
  if (
    /\b(gold|account|accounts|item|items|bond|bonds|outfit|outfits|product|products|membership)\b/.test(
      text,
    )
  ) {
    return "MANUAL_ONLY" as const;
  }
  return "PROVIDER_REVIEW_REQUIRED" as const;
}

function serviceMode(
  service: Pick<CatalogueService, "engineType" | "slug" | "name">,
) {
  if (
    [
      "GOLD_ENGINE",
      "ACCOUNT_MARKETPLACE",
      "CUSTOM_ACCOUNT_BUILD",
      "PRODUCT_MARKETPLACE",
    ].includes(service.engineType)
  ) {
    return "MANUAL_ONLY" as const;
  }
  const text = `${service.slug} ${service.name}`.toLowerCase();
  if (
    /\b(gold|account|accounts|item|items|bond|bonds|outfit|outfits)\b/.test(
      text,
    )
  ) {
    return "MANUAL_ONLY" as const;
  }
  return "PROVIDER_REVIEW_REQUIRED" as const;
}

function eligibilityReason(mode: PaymentEligibilityMode) {
  if (mode === "MANUAL_ONLY") {
    return "Needs processor review before external hosted checkout can be considered; manual review remains the safe fallback.";
  }
  return "Needs merchant confirmation of payment-provider eligibility before hosted checkout can be enabled.";
}

export async function seedPaymentsLaunchReadiness(prisma: PrismaClient) {
  const manualProvider = await prisma.paymentProviderConfiguration.upsert({
    where: { stableKey: "provider-manual-review" },
    create: {
      stableKey: "provider-manual-review",
      provider: "MANUAL_REVIEW",
      displayName: "Manual review",
      enabled: true,
      productionAllowed: true,
      webhookEnabled: false,
      publicMode: "manual-review",
      safeConfiguration: {
        storesSecrets: false,
        externalNetworkCalls: false,
      },
      healthStatus: "READY",
      needsClientReview: false,
    },
    update: {},
    select: { id: true },
  });

  const testHostedProvider = await prisma.paymentProviderConfiguration.upsert({
    where: { stableKey: "provider-test-hosted" },
    create: {
      stableKey: "provider-test-hosted",
      provider: "TEST_HOSTED",
      displayName: "TEST_HOSTED checkout",
      enabled: false,
      productionAllowed: false,
      webhookEnabled: false,
      publicMode: "ci-only",
      safeConfiguration: {
        storesSecrets: false,
        externalNetworkCalls: false,
        productionBlocked: true,
      },
      healthStatus: "DISABLED",
      needsClientReview: true,
    },
    update: {},
    select: { id: true },
  });

  await prisma.checkoutPaymentMethod.updateMany({
    where: { stableKey: "manual-review" },
    data: {
      methodType: "MANUAL_REVIEW",
      providerType: "MANUAL_REVIEW",
      providerConfigId: manualProvider.id,
    },
  });

  await prisma.checkoutPaymentMethod.upsert({
    where: { stableKey: "test-hosted-checkout" },
    create: {
      stableKey: "test-hosted-checkout",
      settingsId: (
        await prisma.checkoutSettings.findFirstOrThrow({
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
      ).id,
      methodType: "EXTERNAL_HOSTED_CHECKOUT",
      providerType: "TEST_HOSTED",
      providerConfigId: testHostedProvider.id,
      publicName: "Hosted checkout test mode",
      publicDescription:
        "CI-only hosted checkout simulation. This is disabled for production launch.",
      publicInstructions:
        "TEST_HOSTED never calls the internet and must not be enabled in production.",
      enabled: false,
      sortOrder: 50,
      needsClientReview: true,
    },
    update: {},
  });

  for (const [kind, mode] of Object.entries(cartKindEligibility) as Array<
    [CartItemKind, PaymentEligibilityMode]
  >) {
    await prisma.paymentEligibilityRule.upsert({
      where: { stableKey: `cart-kind:${kind}` },
      create: {
        stableKey: `cart-kind:${kind}`,
        sourceType: "CART_ITEM_KIND",
        sourceKey: kind,
        sourceLabel: kind,
        mode,
        safeReason: eligibilityReason(mode),
        merchantConfirmed: false,
        needsClientReview: true,
      },
      update: {},
    });
  }

  const categories = await prisma.catalogueCategory.findMany({
    select: { slug: true, name: true },
  });
  for (const category of categories) {
    const mode = categoryMode(category);
    await prisma.paymentEligibilityRule.upsert({
      where: { stableKey: `category:${category.slug}` },
      create: {
        stableKey: `category:${category.slug}`,
        sourceType: "CATALOGUE_CATEGORY",
        sourceKey: category.slug,
        sourceLabel: category.name,
        mode,
        safeReason: eligibilityReason(mode),
        merchantConfirmed: false,
        needsClientReview: true,
      },
      update: {},
    });
  }

  const services = await prisma.catalogueService.findMany({
    select: { canonicalSlug: true, slug: true, name: true, engineType: true },
  });
  for (const service of services) {
    const mode = serviceMode(service);
    await prisma.paymentEligibilityRule.upsert({
      where: { stableKey: `service:${service.canonicalSlug}` },
      create: {
        stableKey: `service:${service.canonicalSlug}`,
        sourceType: "CATALOGUE_SERVICE",
        sourceKey: service.canonicalSlug,
        sourceLabel: service.name,
        mode,
        safeReason: eligibilityReason(mode),
        merchantConfirmed: false,
        needsClientReview: true,
      },
      update: {},
    });
  }

  for (const template of task016Templates) {
    await prisma.emailTemplate.upsert({
      where: { stableKey: template.stableKey },
      create: { ...template, enabled: true, needsClientReview: true },
      update: {},
    });
  }

  for (const setting of readinessDefaults) {
    await prisma.productionReadinessSetting.upsert({
      where: { stableKey: setting.stableKey },
      create: {
        ...setting,
        needsClientReview: String(setting.status) !== "READY",
      },
      update: {},
    });
  }
}

import "server-only";

import { randomBytes } from "node:crypto";

import type {
  CartItem,
  Order,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
} from "@/generated/prisma/client";
import {
  assertKnownCartItemSnapshot,
  toInputJson,
} from "@/lib/checkout/adapters";
import {
  CART_COOKIE_NAME,
  CART_FEATURE_FLAG,
  CHECKOUT_NOTIFICATION_TEMPLATE_VERSION,
  GUEST_CHECKOUT_FEATURE_FLAG,
  emailNotConfiguredMessage,
  paymentReviewMessage,
} from "@/lib/checkout/constants";
import {
  linkAuthenticatedCheckoutOrder,
  notifyLinkedOrderCustomer,
} from "@/lib/customer/account";
import {
  CheckoutSecurityError,
  createSecureToken,
  expiredCartCookieOptions,
  hashIdempotencyKey,
  hashToken,
  normalizeGuestContact,
  normalizeServiceDetails,
  type NormalizedGuestContact,
} from "@/lib/checkout/security";
import {
  CartError,
  revalidateCart,
  resolveCartByRawToken,
} from "@/lib/checkout/cart";
import { prisma } from "@/lib/db/prisma";

export class CheckoutError extends Error {
  status = 400;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
  }
}

type CheckoutInput = {
  rawCartToken?: string | null;
  idempotencyKey: string;
  authenticatedCustomer?: { userId: string; email: string } | null;
  contact: {
    displayName: unknown;
    email: unknown;
    discordUsername?: unknown;
    rsn?: unknown;
  };
  paymentMethodStableKey?: string | null;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  acceptedUpdatedTotals?: boolean;
  serviceDetails?: unknown;
};

type OrderWithPublicRelations = Order & {
  items: Array<{
    id: string;
    kind: CartItem["kind"];
    publicTitle: string;
    publicConfigurationSummary: string;
    quantity: bigint;
    currencyCode: string;
    priceLines: Prisma.JsonValue;
    finalTotalCents: number;
    resourceReservationState: string;
  }>;
  statusEvents: Array<{
    eventType: string;
    newStatus: OrderStatus;
    publicNote: string | null;
    createdAt: Date;
  }>;
  paymentEvents: Array<{
    newPaymentStatus: OrderPaymentStatus;
    publicNote: string | null;
    createdAt: Date;
  }>;
  notifications: Array<{
    notificationType: string;
    status: string;
    createdAt: Date;
  }>;
};

function stableId() {
  return randomBytes(12).toString("hex");
}

function stableKey(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

function safeJson<T>(value: T) {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    ),
  ) as T;
}

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

async function loadCheckoutConfiguration() {
  const settings = await prisma.checkoutSettings.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      paymentMethods: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { publicName: "asc" }],
      },
    },
  });
  if (!settings) {
    throw new CheckoutError("Checkout settings are not configured.", 503);
  }
  return settings;
}

function generateOrderNumber(prefix: string) {
  const now = new Date();
  const date = `${now.getUTCFullYear().toString().slice(2)}${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `${prefix.replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "OSRS"}-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function orderPublicInclude() {
  return {
    items: {
      orderBy: { createdAt: "asc" as const },
      select: {
        id: true,
        kind: true,
        publicTitle: true,
        publicConfigurationSummary: true,
        quantity: true,
        currencyCode: true,
        priceLines: true,
        finalTotalCents: true,
        resourceReservationState: true,
      },
    },
    statusEvents: {
      orderBy: { sequence: "asc" as const },
      select: {
        eventType: true,
        newStatus: true,
        publicNote: true,
        createdAt: true,
      },
    },
    paymentEvents: {
      orderBy: { sequence: "asc" as const },
      select: {
        newPaymentStatus: true,
        publicNote: true,
        createdAt: true,
      },
    },
    notifications: {
      orderBy: { createdAt: "asc" as const },
      select: {
        notificationType: true,
        status: true,
        createdAt: true,
      },
    },
  };
}

export function publicOrderPayload(
  order: OrderWithPublicRelations,
  trackingToken?: string | null,
) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    currencyCode: order.currencyCode,
    subtotalCents: order.subtotalCents,
    adjustmentTotalCents: order.adjustmentTotalCents,
    finalTotalCents: order.finalTotalCents,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    paymentReviewMessage,
    emailDeliveryMessage: emailNotConfiguredMessage,
    trackingToken: trackingToken ?? null,
    trackingUrl: trackingToken ? `/orders/track/${trackingToken}` : null,
    items: order.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      publicTitle: item.publicTitle,
      publicConfigurationSummary: item.publicConfigurationSummary,
      quantity: item.quantity.toString(),
      currencyCode: item.currencyCode,
      priceLines: item.priceLines,
      finalTotalCents: item.finalTotalCents,
      resourceReservationState: item.resourceReservationState,
    })),
    statusTimeline: order.statusEvents.map((event) => ({
      eventType: event.eventType,
      status: event.newStatus,
      publicNote: event.publicNote,
      createdAt: event.createdAt.toISOString(),
    })),
    paymentTimeline: order.paymentEvents.map((event) => ({
      paymentStatus: event.newPaymentStatus,
      publicNote: event.publicNote,
      createdAt: event.createdAt.toISOString(),
    })),
    notifications: order.notifications.map((notification) => ({
      type: notification.notificationType,
      status: notification.status,
      createdAt: notification.createdAt.toISOString(),
    })),
  };
}

function requireCheckoutCart(
  cart: Awaited<ReturnType<typeof resolveCartByRawToken>>,
) {
  if (!cart || cart.status !== "ACTIVE") {
    throw new CheckoutError("Start with an active cart before checkout.", 400);
  }
  if (cart.expiresAt <= new Date()) {
    throw new CheckoutError("This cart has expired.", 400);
  }
  if (!cart.items.length) {
    throw new CheckoutError("Add at least one item before checkout.", 400);
  }
  if (
    cart.items.some(
      (item) =>
        item.repricingRequired ||
        item.validationState === "REPRICE_REQUIRED" ||
        item.validationState === "UNAVAILABLE" ||
        item.validationState === "OUT_OF_STOCK" ||
        item.validationState === "INCOMPATIBLE" ||
        item.validationState === "MANUAL_REVIEW_REQUIRED",
    )
  ) {
    throw new CheckoutError("Review the cart before checkout.", 409);
  }
  return cart;
}

async function nextStatusSequence(
  transaction: Prisma.TransactionClient,
  orderId: string,
) {
  const aggregate = await transaction.orderStatusEvent.aggregate({
    where: { orderId },
    _max: { sequence: true },
  });
  return (aggregate._max.sequence ?? 0) + 1;
}

async function nextPaymentSequence(
  transaction: Prisma.TransactionClient,
  orderId: string,
) {
  const aggregate = await transaction.orderPaymentEvent.aggregate({
    where: { orderId },
    _max: { sequence: true },
  });
  return (aggregate._max.sequence ?? 0) + 1;
}

async function createProductAllocation({
  transaction,
  orderId,
  orderItemId,
  item,
  expiresAt,
}: {
  transaction: Prisma.TransactionClient;
  orderId: string;
  orderItemId: string;
  item: CartItem;
  expiresAt: Date;
}) {
  const [productStableKey, variantStableKey] = item.sourceReference.split(":");
  if (!productStableKey || !variantStableKey) {
    throw new CheckoutError(
      "Product cart item is missing its source reference.",
    );
  }
  const variant = await transaction.productVariant.findFirst({
    where: {
      stableKey: variantStableKey,
      product: { stableKey: productStableKey },
    },
    select: {
      id: true,
      stockMode: true,
      status: true,
      enabled: true,
      availabilityState: true,
      onHandQuantity: true,
      concurrencyVersion: true,
    },
  });
  if (!variant || !variant.enabled || variant.status !== "AVAILABLE") {
    throw new CheckoutError("Product availability changed before checkout.");
  }
  if (variant.stockMode === "UNLIMITED") return;
  if (
    variant.stockMode === "MANUAL_REVIEW" ||
    variant.availabilityState === "MANUAL_REVIEW_REQUIRED"
  ) {
    throw new CheckoutError("Product requires support review before checkout.");
  }
  const reserved = await transaction.productInventoryReservation.aggregate({
    where: {
      variantId: variant.id,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
    _sum: { quantity: true },
  });
  const available = variant.onHandQuantity - (reserved._sum.quantity ?? 0n);
  if (available < item.quantity) {
    throw new CheckoutError("Product stock changed before checkout.");
  }
  const updated = await transaction.productVariant.updateMany({
    where: { id: variant.id, concurrencyVersion: variant.concurrencyVersion },
    data: { concurrencyVersion: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new CheckoutError("Product inventory changed before checkout.");
  }
  const reservation = await transaction.productInventoryReservation.create({
    data: {
      id: stableId(),
      stableKey: stableKey("checkout-product-reservation"),
      variantId: variant.id,
      quantity: item.quantity,
      expiresAt,
      safeInternalPurpose: "Checkout reservation",
      idempotencyKey: `checkout:${orderId}:${orderItemId}`,
      futureExternalRef: orderItemId,
    },
  });
  await transaction.productReservationEvent.create({
    data: {
      id: stableId(),
      reservationId: reservation.id,
      eventType: "ACTIVE",
      safeMetadata: auditMetadata({ orderId, orderItemId }),
    },
  });
  await transaction.orderResourceAllocation.create({
    data: {
      orderId,
      orderItemId,
      itemKind: item.kind,
      state: "ACTIVE",
      productReservationId: reservation.id,
      quantity: item.quantity,
      expiresAt,
      safeMetadata: auditMetadata({ resource: "product" }),
    },
  });
}

async function createAccountAllocation({
  transaction,
  orderId,
  orderItemId,
  item,
  expiresAt,
}: {
  transaction: Prisma.TransactionClient;
  orderId: string;
  orderItemId: string;
  item: CartItem;
  expiresAt: Date;
}) {
  const listing = await transaction.accountListing.findUnique({
    where: { id: item.sourceReference },
    select: { id: true, availability: true, concurrencyVersion: true },
  });
  if (!listing || listing.availability !== "AVAILABLE") {
    throw new CheckoutError("Account listing is no longer available.");
  }
  const updated = await transaction.accountListing.updateMany({
    where: {
      id: listing.id,
      availability: "AVAILABLE",
      concurrencyVersion: listing.concurrencyVersion,
    },
    data: { availability: "HELD", concurrencyVersion: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new CheckoutError("Account listing changed before checkout.");
  }
  const hold = await transaction.accountListingHold.create({
    data: {
      id: stableId(),
      stableKey: stableKey("checkout-account-hold"),
      listingId: listing.id,
      status: "ACTIVE",
      previousAvailability: listing.availability,
      expiresAt,
      reason: "Checkout hold",
    },
  });
  await transaction.orderResourceAllocation.create({
    data: {
      orderId,
      orderItemId,
      itemKind: item.kind,
      state: "ACTIVE",
      accountHoldId: hold.id,
      expiresAt,
      safeMetadata: auditMetadata({ resource: "account_listing" }),
    },
  });
}

async function activeGoldReservedQuantity(
  transaction: Prisma.TransactionClient,
  marketId: string,
  now: Date,
) {
  const aggregate = await transaction.goldInventoryReservation.aggregate({
    where: { marketId, status: "ACTIVE", expiresAt: { gt: now } },
    _sum: { quantityGp: true },
  });
  return aggregate._sum.quantityGp ?? 0n;
}

async function createGoldAllocation({
  transaction,
  orderId,
  orderItemId,
  item,
  expiresAt,
}: {
  transaction: Prisma.TransactionClient;
  orderId: string;
  orderItemId: string;
  item: CartItem;
  expiresAt: Date;
}) {
  const [marketId, quantityText] = item.sourceReference.split(":");
  const quantity = BigInt(quantityText ?? "0");
  if (!marketId || quantity <= 0n) {
    throw new CheckoutError("Gold cart item is missing its source reference.");
  }
  const market = await transaction.goldMarket.findUnique({
    where: { id: marketId },
    select: {
      id: true,
      stockQuantityGp: true,
      stockVersion: true,
      availabilityState: true,
    },
  });
  if (
    !market ||
    market.availabilityState === "PAUSED" ||
    market.availabilityState === "UNAVAILABLE"
  ) {
    throw new CheckoutError("Gold stock is no longer available.");
  }
  const reserved = await activeGoldReservedQuantity(
    transaction,
    market.id,
    new Date(),
  );
  if (market.stockQuantityGp - reserved < quantity) {
    throw new CheckoutError("Gold stock changed before checkout.");
  }
  const updated = await transaction.goldMarket.updateMany({
    where: { id: market.id, stockVersion: market.stockVersion },
    data: { stockVersion: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new CheckoutError("Gold stock changed before checkout.");
  }
  const reservation = await transaction.goldInventoryReservation.create({
    data: {
      id: stableId(),
      stableKey: stableKey("checkout-gold-reservation"),
      marketId: market.id,
      quantityGp: quantity,
      expiresAt,
      safeInternalPurpose: "Checkout reservation",
      idempotencyKeyHash: hashToken(`checkout:${orderId}:${orderItemId}`),
      futureExternalRef: orderItemId,
    },
  });
  await transaction.orderResourceAllocation.create({
    data: {
      orderId,
      orderItemId,
      itemKind: item.kind,
      state: "ACTIVE",
      goldReservationId: reservation.id,
      quantity,
      expiresAt,
      safeMetadata: auditMetadata({ resource: "gold" }),
    },
  });
}

async function createResourceAllocation({
  transaction,
  orderId,
  orderItemId,
  item,
  expiresAt,
}: {
  transaction: Prisma.TransactionClient;
  orderId: string;
  orderItemId: string;
  item: CartItem;
  expiresAt: Date;
}) {
  if (item.kind === "PRODUCT_ESTIMATE") {
    await createProductAllocation({
      transaction,
      orderId,
      orderItemId,
      item,
      expiresAt,
    });
  }
  if (item.kind === "ACCOUNT_LISTING_ESTIMATE") {
    await createAccountAllocation({
      transaction,
      orderId,
      orderItemId,
      item,
      expiresAt,
    });
  }
  if (item.kind === "GOLD_BUY_ESTIMATE") {
    await createGoldAllocation({
      transaction,
      orderId,
      orderItemId,
      item,
      expiresAt,
    });
  }
}

function orderItemData(
  orderId: string,
  item: CartItem,
  serviceDetails: unknown,
) {
  const snapshot = assertKnownCartItemSnapshot(item.customerSafeSnapshot);
  const details = normalizeServiceDetails(serviceDetails);
  const summarySuffix = Object.keys(details).length
    ? `\nSafe details collected for staff review.`
    : "";
  return {
    orderId,
    cartItemId: item.id,
    kind: item.kind,
    publicTitle: snapshot.publicTitle,
    publicConfigurationSummary:
      snapshot.publicConfigurationSummary + summarySuffix,
    quantity: item.quantity,
    currencyCode: item.currencyCode,
    priceLines: toInputJson([
      ...snapshot.authoritativeLineItems,
      ...snapshot.customerSafeGlobalPricingLines,
    ]),
    subtotalCents: item.subtotalCents,
    adjustmentTotalCents: item.adjustmentTotalCents,
    finalTotalCents: item.finalTotalCents,
    sourceReference: item.sourceReference,
    publicSourceSlug: item.publicSourceSlug,
    sourcePublishedRevisionId: item.sourcePublishedRevisionId,
    sourcePublishedRevisionNumber: item.sourcePublishedRevisionNumber,
    sourceSnapshotSchemaVersion: item.snapshotSchemaVersion,
    customerSafeSnapshot: toInputJson({
      ...snapshot,
      checkoutServiceDetailsPresent: Object.keys(details).length > 0,
    }),
    resourceReservationState: snapshot.reservationRequired ? "ACTIVE" : "NONE",
  } satisfies Prisma.OrderItemUncheckedCreateInput;
}

export async function submitGuestCheckout(input: CheckoutInput) {
  if (!(await featureEnabled(CART_FEATURE_FLAG))) {
    throw new CheckoutError("Cart actions are currently disabled.", 403);
  }
  if (!(await featureEnabled(GUEST_CHECKOUT_FEATURE_FLAG))) {
    throw new CheckoutError("Guest checkout is currently disabled.", 403);
  }
  const settings = await loadCheckoutConfiguration();
  if (!settings.guestCheckoutEnabled) {
    throw new CheckoutError("Guest checkout settings need client review.", 403);
  }
  if (!input.termsAccepted || !input.privacyAccepted) {
    throw new CheckoutError("Accept the terms and privacy policy to continue.");
  }
  const idempotencyKeyHash = hashIdempotencyKey(input.idempotencyKey);
  const previousOrder = await prisma.order.findUnique({
    where: { checkoutIdempotencyKeyHash: idempotencyKeyHash },
    include: orderPublicInclude(),
  });
  if (previousOrder) {
    return {
      order: publicOrderPayload(previousOrder as OrderWithPublicRelations),
      idempotent: true,
      cookie: null,
    };
  }

  const revalidated = await revalidateCart({
    rawToken: input.rawCartToken,
    acceptUpdatedTotals: input.acceptedUpdatedTotals ?? false,
  });
  if (revalidated.changed && !input.acceptedUpdatedTotals) {
    return {
      repriceRequired: true as const,
      cart: revalidated.cart,
      idempotent: false,
      cookie: null,
    };
  }
  const cart = requireCheckoutCart(
    await resolveCartByRawToken(input.rawCartToken),
  );
  const contact: NormalizedGuestContact = normalizeGuestContact(input.contact);
  if (
    input.authenticatedCustomer &&
    contact.email !== input.authenticatedCustomer.email
  ) {
    throw new CheckoutError(
      "Checkout email must match the signed-in customer account.",
      403,
    );
  }
  const paymentMethod =
    settings.paymentMethods.find(
      (method) => method.stableKey === input.paymentMethodStableKey,
    ) ?? settings.paymentMethods[0];
  if (!paymentMethod || paymentMethod.methodType !== "MANUAL_REVIEW") {
    throw new CheckoutError("Choose an available payment review method.");
  }
  const trackingToken = createSecureToken();
  const orderNumber = generateOrderNumber(settings.orderNumberPrefix);
  const now = new Date();
  const allocationExpiry = new Date(
    now.getTime() + settings.checkoutReservationMinutes * 60 * 1000,
  );

  const orderId = await prisma.$transaction(async (transaction) => {
    const locked = await transaction.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    requireCheckoutCart(locked);
    await transaction.checkoutAttempt.upsert({
      where: {
        cartId_idempotencyKeyHash: {
          cartId: locked.id,
          idempotencyKeyHash,
        },
      },
      create: {
        cartId: locked.id,
        idempotencyKeyHash,
        status: "STARTED",
      },
      update: {
        status: "STARTED",
        failureCode: null,
        safeFailureSummary: null,
      },
    });
    await transaction.checkoutIdempotencyRecord.upsert({
      where: {
        scopeKey_keyHash: {
          scopeKey: "guest-checkout",
          keyHash: idempotencyKeyHash,
        },
      },
      create: {
        cartId: locked.id,
        scopeKey: "guest-checkout",
        keyHash: idempotencyKeyHash,
        status: "STARTED",
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
      update: {
        cartId: locked.id,
        status: "STARTED",
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    const contactRecord = await transaction.guestOrderContact.create({
      data: {
        displayName: contact.displayName,
        email: contact.email,
        discordUsername: contact.discordUsername,
        rsn: contact.rsn,
        consentAt: now,
        termsVersion: settings.termsVersion,
        privacyPolicyVersion: settings.privacyPolicyVersion,
      },
    });
    const order = await transaction.order.create({
      data: {
        orderNumber,
        cartId: locked.id,
        guestContactId: contactRecord.id,
        paymentMethodId: paymentMethod.id,
        trackingTokenHash: hashToken(trackingToken),
        checkoutIdempotencyKeyHash: idempotencyKeyHash,
        status: "AWAITING_PAYMENT",
        paymentStatus: "AWAITING_INSTRUCTIONS",
        paymentMethodType: "MANUAL_REVIEW",
        currencyCode: locked.currencyCode ?? settings.currencyCode,
        subtotalCents: locked.subtotalCents,
        adjustmentTotalCents: locked.adjustmentTotalCents,
        finalTotalCents: locked.finalTotalCents,
        termsVersion: settings.termsVersion,
        privacyPolicyVersion: settings.privacyPolicyVersion,
      },
    });
    if (input.authenticatedCustomer) {
      await linkAuthenticatedCheckoutOrder({
        transaction,
        userId: input.authenticatedCustomer.userId,
        orderId: order.id,
      });
    }
    for (const item of locked.items) {
      const orderItem = await transaction.orderItem.create({
        data: orderItemData(order.id, item, input.serviceDetails),
      });
      await createResourceAllocation({
        transaction,
        orderId: order.id,
        orderItemId: orderItem.id,
        item,
        expiresAt: allocationExpiry,
      });
    }
    await transaction.orderStatusEvent.create({
      data: {
        orderId: order.id,
        eventType: "CREATED",
        previousStatus: null,
        newStatus: "AWAITING_PAYMENT",
        publicNote: "Order received for manual payment review.",
        reasonCode: "CHECKOUT_CREATED",
        sequence: 1,
        safeMetadata: auditMetadata({ itemCount: locked.items.length }),
      },
    });
    await transaction.orderPaymentEvent.create({
      data: {
        orderId: order.id,
        previousPaymentStatus: null,
        newPaymentStatus: "AWAITING_INSTRUCTIONS",
        paymentMethodType: "MANUAL_REVIEW",
        publicNote: paymentReviewMessage,
        reasonCode: "MANUAL_REVIEW_SELECTED",
        sequence: 1,
        safeMetadata: auditMetadata({ paymentMethodType: "MANUAL_REVIEW" }),
      },
    });
    await transaction.orderNotificationOutbox.create({
      data: {
        orderId: order.id,
        notificationType: "ORDER_CONFIRMATION",
        status: settings.notificationProviderConfigured
          ? "PENDING"
          : "SUPPRESSED_NOT_CONFIGURED",
        recipientHash: hashToken(contact.email),
        templateVersion: CHECKOUT_NOTIFICATION_TEMPLATE_VERSION,
        payload: auditMetadata({
          orderNumber: order.orderNumber,
          itemCount: locked.items.length,
          totalCents: locked.finalTotalCents,
          providerConfigured: settings.notificationProviderConfigured,
        }),
      },
    });
    await transaction.checkoutAttempt.update({
      where: {
        cartId_idempotencyKeyHash: {
          cartId: locked.id,
          idempotencyKeyHash,
        },
      },
      data: {
        orderId: order.id,
        status: "SUCCEEDED",
      },
    });
    await transaction.checkoutIdempotencyRecord.update({
      where: {
        scopeKey_keyHash: {
          scopeKey: "guest-checkout",
          keyHash: idempotencyKeyHash,
        },
      },
      data: {
        orderId: order.id,
        status: "SUCCEEDED",
        response: auditMetadata({
          orderNumber: order.orderNumber,
          cartId: locked.id,
        }),
      },
    });
    await transaction.cart.update({
      where: { id: locked.id },
      data: {
        status: "CONVERTED",
        convertedAt: now,
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.auditLog.create({
      data: {
        action: "checkout.cart.converted",
        targetType: "Cart",
        targetId: locked.id,
        metadata: auditMetadata({
          orderId: order.id,
          itemCount: locked.items.length,
        }),
      },
    });
    await transaction.auditLog.create({
      data: {
        action: "orders.created",
        targetType: "Order",
        targetId: order.id,
        metadata: auditMetadata({
          orderNumber: order.orderNumber,
          itemCount: locked.items.length,
          paymentMethodType: "MANUAL_REVIEW",
        }),
      },
    });
    return order.id;
  });

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderPublicInclude(),
  });
  return {
    order: publicOrderPayload(order as OrderWithPublicRelations, trackingToken),
    idempotent: false,
    cookie: {
      name: CART_COOKIE_NAME,
      value: "" as const,
      options: expiredCartCookieOptions(),
    },
  };
}

async function consumeProductAllocation({
  transaction,
  allocation,
  actorId,
}: {
  transaction: Prisma.TransactionClient;
  allocation: Prisma.OrderResourceAllocationGetPayload<{
    include: { productReservation: true };
  }>;
  actorId: string;
}) {
  const reservation = allocation.productReservation;
  if (!reservation || reservation.status !== "ACTIVE") {
    if (reservation?.status === "CONSUMED") return;
    throw new CheckoutError("Product reservation is not active.");
  }
  if (reservation.expiresAt <= new Date()) {
    throw new CheckoutError(
      "Product reservation expired before payment review.",
    );
  }
  const variant = await transaction.productVariant.findUniqueOrThrow({
    where: { id: reservation.variantId },
  });
  if (variant.onHandQuantity < reservation.quantity) {
    throw new CheckoutError("Product stock is no longer sufficient.");
  }
  const referenceKey = `order-paid:${allocation.orderId}:${allocation.id}`;
  const existing = await transaction.productInventoryLedgerEntry.findUnique({
    where: { referenceKey },
  });
  if (!existing) {
    await transaction.productVariant.update({
      where: { id: variant.id },
      data: {
        onHandQuantity: { decrement: reservation.quantity },
        concurrencyVersion: { increment: 1 },
      },
    });
    const updatedVariant = await transaction.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
    });
    await transaction.productInventoryLedgerEntry.create({
      data: {
        id: stableId(),
        variantId: variant.id,
        entryType: "STOCK_OUT",
        quantity: -reservation.quantity,
        resultingOnHandQuantity: updatedVariant.onHandQuantity,
        reason: "Order marked paid",
        actorId,
        reservationId: reservation.id,
        referenceKey,
      },
    });
  }
  await transaction.productInventoryReservation.update({
    where: { id: reservation.id },
    data: {
      status: "CONSUMED",
      concurrencyVersion: { increment: 1 },
    },
  });
  await transaction.productReservationEvent.create({
    data: {
      id: stableId(),
      reservationId: reservation.id,
      eventType: "CONSUMED",
      actorId,
      safeMetadata: auditMetadata({ orderId: allocation.orderId }),
    },
  });
}

async function consumeAccountAllocation({
  transaction,
  allocation,
}: {
  transaction: Prisma.TransactionClient;
  allocation: Prisma.OrderResourceAllocationGetPayload<{
    include: { accountHold: true };
  }>;
}) {
  const hold = allocation.accountHold;
  if (!hold || hold.status !== "ACTIVE") {
    if (hold?.status === "CONSUMED") return;
    throw new CheckoutError("Account hold is not active.");
  }
  if (hold.expiresAt <= new Date()) {
    throw new CheckoutError("Account hold expired before payment review.");
  }
  await transaction.accountListing.update({
    where: { id: hold.listingId },
    data: { availability: "SOLD", concurrencyVersion: { increment: 1 } },
  });
  await transaction.accountListingHold.update({
    where: { id: hold.id },
    data: { status: "CONSUMED", concurrencyVersion: { increment: 1 } },
  });
}

async function consumeGoldAllocation({
  transaction,
  allocation,
  actorId,
}: {
  transaction: Prisma.TransactionClient;
  allocation: Prisma.OrderResourceAllocationGetPayload<{
    include: { goldReservation: true };
  }>;
  actorId: string;
}) {
  const reservation = allocation.goldReservation;
  if (!reservation || reservation.status !== "ACTIVE") {
    if (reservation?.status === "CONSUMED") return;
    throw new CheckoutError("Gold reservation is not active.");
  }
  if (reservation.expiresAt <= new Date()) {
    throw new CheckoutError("Gold reservation expired before payment review.");
  }
  const market = await transaction.goldMarket.findUniqueOrThrow({
    where: { id: reservation.marketId },
  });
  if (market.stockQuantityGp < reservation.quantityGp) {
    throw new CheckoutError("Gold stock is no longer sufficient.");
  }
  const referenceKey = `order-paid:${allocation.orderId}:${allocation.id}`;
  const existing = await transaction.goldInventoryLedgerEntry.findUnique({
    where: { referenceKey },
  });
  if (!existing) {
    await transaction.goldMarket.update({
      where: { id: market.id },
      data: {
        stockQuantityGp: { decrement: reservation.quantityGp },
        stockVersion: { increment: 1 },
      },
    });
    const updatedMarket = await transaction.goldMarket.findUniqueOrThrow({
      where: { id: market.id },
    });
    await transaction.goldInventoryLedgerEntry.create({
      data: {
        marketId: market.id,
        entryType: "STOCK_DECREASE",
        quantityGp: reservation.quantityGp,
        resultingStockQuantityGp: updatedMarket.stockQuantityGp,
        resultingBuyingCapacityGp: updatedMarket.buyingCapacityGp,
        reason: "Order marked paid",
        actorId,
        referenceKey,
      },
    });
  }
  await transaction.goldInventoryReservation.update({
    where: { id: reservation.id },
    data: {
      status: "CONSUMED",
      consumedAt: new Date(),
      concurrencyVersion: { increment: 1 },
    },
  });
}

export async function markOrderPaymentUnderReview({
  orderId,
  actorId,
  expectedVersion,
  publicNote,
  internalNote,
}: {
  orderId: string;
  actorId: string;
  expectedVersion: number;
  publicNote?: string | null;
  internalNote?: string | null;
}) {
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (order.concurrencyVersion !== expectedVersion) {
      throw new CheckoutError("Order changed before payment review.");
    }
    if (order.paymentStatus === "PAID") {
      throw new CheckoutError("Paid orders cannot return to review.");
    }
    const paymentSequence = await nextPaymentSequence(transaction, order.id);
    const statusSequence = await nextStatusSequence(transaction, order.id);
    await transaction.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAYMENT_UNDER_REVIEW",
        status: "PAYMENT_UNDER_REVIEW",
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.orderPaymentEvent.create({
      data: {
        orderId: order.id,
        previousPaymentStatus: order.paymentStatus,
        newPaymentStatus: "PAYMENT_UNDER_REVIEW",
        actorId,
        publicNote: publicNote?.slice(0, 500) ?? "Payment is under review.",
        privateInternalNote: internalNote?.slice(0, 2000) ?? null,
        reasonCode: "PAYMENT_REVIEW_STARTED",
        sequence: paymentSequence,
      },
    });
    await transaction.orderStatusEvent.create({
      data: {
        orderId: order.id,
        eventType: "PAYMENT_STATUS_CHANGED",
        previousStatus: order.status,
        newStatus: "PAYMENT_UNDER_REVIEW",
        actorId,
        publicNote: publicNote?.slice(0, 500) ?? "Payment is under review.",
        privateInternalNote: internalNote?.slice(0, 2000) ?? null,
        reasonCode: "PAYMENT_REVIEW_STARTED",
        sequence: statusSequence,
      },
    });
    await notifyLinkedOrderCustomer({
      transaction,
      orderId: order.id,
      type: "ORDER_PAYMENT_CHANGED",
      title: "Payment under review",
      body: "Payment is under review for this order.",
      dedupeKey: `payment-under-review:${order.id}`,
      safeMetadata: { paymentStatus: "PAYMENT_UNDER_REVIEW" },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "orders.payment.review_started",
        targetType: "Order",
        targetId: order.id,
        metadata: auditMetadata({ orderNumber: order.orderNumber }),
      },
    });
  });
}

export async function markOrderPaid({
  orderId,
  actorId,
  expectedVersion,
  idempotencyKey,
  publicNote,
  internalNote,
}: {
  orderId: string;
  actorId: string;
  expectedVersion: number;
  idempotencyKey: string;
  publicNote?: string | null;
  internalNote?: string | null;
}) {
  const idempotencyKeyHash = hashIdempotencyKey(idempotencyKey);
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        resourceAllocations: {
          include: {
            productReservation: true,
            accountHold: true,
            goldReservation: true,
          },
        },
      },
    });
    if (order.paymentStatus === "PAID") return { idempotent: true };
    const existingEvent = await transaction.orderPaymentEvent.findFirst({
      where: { orderId: order.id, idempotencyKeyHash },
    });
    if (existingEvent) return { idempotent: true };
    if (order.concurrencyVersion !== expectedVersion) {
      throw new CheckoutError("Order changed before payment confirmation.");
    }
    for (const allocation of order.resourceAllocations) {
      if (allocation.state !== "ACTIVE") continue;
      if (allocation.productReservationId) {
        await consumeProductAllocation({
          transaction,
          allocation,
          actorId,
        });
      }
      if (allocation.accountHoldId) {
        await consumeAccountAllocation({ transaction, allocation });
      }
      if (allocation.goldReservationId) {
        await consumeGoldAllocation({ transaction, allocation, actorId });
      }
      await transaction.orderResourceAllocation.update({
        where: { id: allocation.id },
        data: {
          state: "CONSUMED",
          consumedAt: new Date(),
          concurrencyVersion: { increment: 1 },
        },
      });
    }
    const paymentSequence = await nextPaymentSequence(transaction, order.id);
    const statusSequence = await nextStatusSequence(transaction, order.id);
    await transaction.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "PAID",
        paidAt: new Date(),
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.orderPaymentEvent.create({
      data: {
        orderId: order.id,
        previousPaymentStatus: order.paymentStatus,
        newPaymentStatus: "PAID",
        actorId,
        publicNote:
          publicNote?.slice(0, 500) ?? "Payment was confirmed by staff.",
        privateInternalNote: internalNote?.slice(0, 2000) ?? null,
        reasonCode: "PAYMENT_CONFIRMED",
        sequence: paymentSequence,
        idempotencyKeyHash,
      },
    });
    await transaction.orderStatusEvent.create({
      data: {
        orderId: order.id,
        eventType: "PAYMENT_CONFIRMED",
        previousStatus: order.status,
        newStatus: "PAID",
        actorId,
        publicNote: "Payment confirmed. Staff will prepare the next step.",
        reasonCode: "PAYMENT_CONFIRMED",
        sequence: statusSequence,
      },
    });
    await notifyLinkedOrderCustomer({
      transaction,
      orderId: order.id,
      type: "ORDER_PAYMENT_CHANGED",
      title: "Payment confirmed",
      body: "Payment was confirmed. Staff will prepare the next step.",
      dedupeKey: `payment-paid:${order.id}`,
      safeMetadata: { paymentStatus: "PAID" },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "orders.payment.marked_paid",
        targetType: "Order",
        targetId: order.id,
        metadata: auditMetadata({ orderNumber: order.orderNumber }),
      },
    });
    return { idempotent: false };
  });
}

export async function cancelOrder({
  orderId,
  actorId,
  expectedVersion,
  idempotencyKey,
  publicNote,
  internalNote,
}: {
  orderId: string;
  actorId: string;
  expectedVersion: number;
  idempotencyKey: string;
  publicNote?: string | null;
  internalNote?: string | null;
}) {
  const idempotencyKeyHash = hashIdempotencyKey(idempotencyKey);
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        resourceAllocations: {
          include: {
            productReservation: true,
            accountHold: true,
            goldReservation: true,
          },
        },
      },
    });
    if (order.status === "CANCELLED") return { idempotent: true };
    if (["PAID", "COMPLETED", "REFUNDED"].includes(order.status)) {
      throw new CheckoutError("This order cannot be casually cancelled.");
    }
    if (order.concurrencyVersion !== expectedVersion) {
      throw new CheckoutError("Order changed before cancellation.");
    }
    const existingEvent = await transaction.orderPaymentEvent.findFirst({
      where: { orderId: order.id, idempotencyKeyHash },
    });
    if (existingEvent) return { idempotent: true };
    for (const allocation of order.resourceAllocations) {
      if (allocation.state !== "ACTIVE") continue;
      if (allocation.productReservation) {
        await transaction.productInventoryReservation.updateMany({
          where: { id: allocation.productReservation.id, status: "ACTIVE" },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            concurrencyVersion: { increment: 1 },
          },
        });
        await transaction.productReservationEvent.create({
          data: {
            id: stableId(),
            reservationId: allocation.productReservation.id,
            eventType: "RELEASED",
            actorId,
            safeMetadata: auditMetadata({ orderId: order.id }),
          },
        });
      }
      if (allocation.accountHold) {
        await transaction.accountListing.update({
          where: { id: allocation.accountHold.listingId },
          data: {
            availability: allocation.accountHold.previousAvailability,
            concurrencyVersion: { increment: 1 },
          },
        });
        await transaction.accountListingHold.updateMany({
          where: { id: allocation.accountHold.id, status: "ACTIVE" },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            releasedById: actorId,
            concurrencyVersion: { increment: 1 },
          },
        });
      }
      if (allocation.goldReservation) {
        await transaction.goldInventoryReservation.updateMany({
          where: { id: allocation.goldReservation.id, status: "ACTIVE" },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            concurrencyVersion: { increment: 1 },
          },
        });
      }
      await transaction.orderResourceAllocation.update({
        where: { id: allocation.id },
        data: {
          state: "RELEASED",
          releasedAt: new Date(),
          concurrencyVersion: { increment: 1 },
        },
      });
    }
    const statusSequence = await nextStatusSequence(transaction, order.id);
    const paymentSequence = await nextPaymentSequence(transaction, order.id);
    await transaction.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        paymentStatus: "CANCELLED",
        cancelledAt: new Date(),
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.orderStatusEvent.create({
      data: {
        orderId: order.id,
        eventType: "CANCELLED",
        previousStatus: order.status,
        newStatus: "CANCELLED",
        actorId,
        publicNote:
          publicNote?.slice(0, 500) ?? "Order was cancelled before payment.",
        privateInternalNote: internalNote?.slice(0, 2000) ?? null,
        reasonCode: "ORDER_CANCELLED",
        sequence: statusSequence,
      },
    });
    await transaction.orderPaymentEvent.create({
      data: {
        orderId: order.id,
        previousPaymentStatus: order.paymentStatus,
        newPaymentStatus: "CANCELLED",
        actorId,
        publicNote: "Payment review is cancelled.",
        privateInternalNote: internalNote?.slice(0, 2000) ?? null,
        reasonCode: "ORDER_CANCELLED",
        sequence: paymentSequence,
        idempotencyKeyHash,
      },
    });
    await notifyLinkedOrderCustomer({
      transaction,
      orderId: order.id,
      type: "ORDER_STATUS_CHANGED",
      title: "Order cancelled",
      body: "Order was cancelled before payment.",
      dedupeKey: `order-cancelled:${order.id}`,
      safeMetadata: { status: "CANCELLED" },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "orders.cancelled",
        targetType: "Order",
        targetId: order.id,
        metadata: auditMetadata({ orderNumber: order.orderNumber }),
      },
    });
    return { idempotent: false };
  });
}

const fulfilmentStatuses = new Set<OrderStatus>([
  "AWAITING_ASSIGNMENT",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "COMPLETED",
  "REQUIRES_REVIEW",
  "DISPUTED",
]);

export async function updateOrderFulfillmentStatus({
  orderId,
  actorId,
  expectedVersion,
  nextStatus,
  publicNote,
  internalNote,
}: {
  orderId: string;
  actorId: string;
  expectedVersion: number;
  nextStatus: OrderStatus;
  publicNote?: string | null;
  internalNote?: string | null;
}) {
  if (!fulfilmentStatuses.has(nextStatus)) {
    throw new CheckoutError("Choose a fulfilment status.");
  }
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (["CANCELLED", "REFUNDED"].includes(order.status)) {
      throw new CheckoutError("Closed orders cannot be updated.");
    }
    if (order.concurrencyVersion !== expectedVersion) {
      throw new CheckoutError("Order changed before status update.");
    }
    if (order.status === nextStatus) return { idempotent: true };
    const statusSequence = await nextStatusSequence(transaction, order.id);
    await transaction.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.orderStatusEvent.create({
      data: {
        orderId: order.id,
        eventType: "STATUS_CHANGED",
        previousStatus: order.status,
        newStatus: nextStatus,
        actorId,
        publicNote: publicNote?.slice(0, 500) ?? null,
        privateInternalNote: internalNote?.slice(0, 2000) ?? null,
        reasonCode: "FULFILMENT_STATUS_UPDATED",
        sequence: statusSequence,
      },
    });
    await notifyLinkedOrderCustomer({
      transaction,
      orderId: order.id,
      type: "ORDER_STATUS_CHANGED",
      title: "Order status updated",
      body: publicNote?.slice(0, 500) ?? "Order status was updated.",
      dedupeKey: `order-status:${order.id}:${nextStatus}:${statusSequence}`,
      safeMetadata: { status: nextStatus },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "orders.status.updated",
        targetType: "Order",
        targetId: order.id,
        metadata: auditMetadata({
          orderNumber: order.orderNumber,
          nextStatus,
        }),
      },
    });
    return { idempotent: false };
  });
}

export async function getTrackedOrder(rawTrackingToken: string) {
  if (!/^[A-Za-z0-9_-]{32,120}$/.test(rawTrackingToken)) return null;
  const tokenHash = hashToken(rawTrackingToken);
  const order = await prisma.order.findUnique({
    where: { trackingTokenHash: tokenHash },
    include: orderPublicInclude(),
  });
  if (!order) return null;
  return publicOrderPayload(order as OrderWithPublicRelations);
}

export async function getOrderForConfirmation(rawTrackingToken: string) {
  return getTrackedOrder(rawTrackingToken);
}

export async function getAdminOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      guestContact: true,
      items: { orderBy: { createdAt: "asc" } },
      resourceAllocations: {
        include: {
          productReservation: true,
          accountHold: true,
          goldReservation: true,
        },
        orderBy: { createdAt: "asc" },
      },
      statusEvents: { orderBy: { sequence: "asc" } },
      paymentEvents: { orderBy: { sequence: "asc" } },
      notifications: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getAdminOrders() {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      guestContact: {
        select: {
          displayName: true,
          email: true,
          discordUsername: true,
          rsn: true,
        },
      },
      items: { select: { id: true } },
    },
  });
}

export function sanitizeCheckoutError(error: unknown) {
  if (
    error instanceof CheckoutError ||
    error instanceof CartError ||
    error instanceof CheckoutSecurityError
  ) {
    return {
      message: error.message,
      status:
        error instanceof CheckoutError || error instanceof CartError
          ? error.status
          : 400,
    };
  }
  return {
    message: "Checkout could not be completed safely. Please try again.",
    status: 500,
  };
}

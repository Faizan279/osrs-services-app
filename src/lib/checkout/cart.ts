import "server-only";

import type {
  Cart,
  CartCompatibilityGroup,
  CartItem,
  CartItemKind,
  CartItemValidationState,
  Prisma,
} from "@/generated/prisma/client";
import {
  CartAdapterError,
  assertKnownCartItemSnapshot,
  publicCartItemKind,
  resolveCartSource,
  toInputJson,
  type CartAdapterResult,
  type CartSourceInput,
} from "@/lib/checkout/adapters";
import {
  CART_COOKIE_MAX_AGE_SECONDS,
  CART_FEATURE_FLAG,
  CART_COOKIE_NAME,
  paymentReviewMessage,
} from "@/lib/checkout/constants";
import {
  CheckoutSecurityError,
  cartCookie,
  createSecureToken,
  expiredCartCookieOptions,
  hashIdempotencyKey,
  hashToken,
  isValidSecureToken,
  timingSafeHashEquals,
} from "@/lib/checkout/security";
import { prisma } from "@/lib/db/prisma";

export class CartError extends Error {
  status = 400;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CartError";
    this.status = status;
  }
}

export type CartCookieMutation =
  | ReturnType<typeof cartCookie>
  | {
      name: typeof CART_COOKIE_NAME;
      value: "";
      options: ReturnType<typeof expiredCartCookieOptions>;
    }
  | null;

export type PublicCartItem = {
  id: string;
  kind: CartItemKind;
  kindLabel: string;
  compatibilityGroup: CartCompatibilityGroup;
  title: string;
  description: string;
  configurationSummary: string;
  quantity: string;
  currency: string;
  lineItems: Array<{ label: string; amountCents: number }>;
  subtotalCents: number;
  adjustmentTotalCents: number;
  finalTotalCents: number;
  validationState: CartItemValidationState;
  repricingRequired: boolean;
  stockRecheckRequired: boolean;
  availabilityRecheckRequired: boolean;
  reservationRequired: boolean;
  concurrencyVersion: number;
};

export type PublicCart = {
  featureEnabled: boolean;
  status: Cart["status"] | "MISSING";
  cartId: string | null;
  compatibilityGroup: CartCompatibilityGroup | null;
  currencyCode: string;
  subtotalCents: number;
  adjustmentTotalCents: number;
  finalTotalCents: number;
  itemCount: number;
  expiresAt: string | null;
  priceAcceptedAt: string | null;
  paymentReviewMessage: string;
  items: PublicCartItem[];
  warnings: string[];
  concurrencyVersion: number | null;
};

type CartWithItems = Cart & { items: CartItem[] };

async function featureEnabled(key: string) {
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

async function checkoutSettings() {
  return prisma.checkoutSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      maximumCartItems: true,
      cartExpiryMinutes: true,
      currencyCode: true,
    },
  });
}

function defaultCartExpiry(now = new Date()) {
  return new Date(now.getTime() + CART_COOKIE_MAX_AGE_SECONDS * 1000);
}

function cleanRawToken(rawToken: string | undefined | null) {
  return isValidSecureToken(rawToken) ? rawToken! : null;
}

export async function resolveCartByRawToken(
  rawToken: string | undefined | null,
) {
  const token = cleanRawToken(rawToken);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const cart = await prisma.cart.findUnique({
    where: { tokenHash },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!cart || !timingSafeHashEquals(cart.tokenHash, tokenHash)) return null;
  if (cart.status === "ACTIVE" && cart.expiresAt <= new Date()) {
    await prisma.cart.updateMany({
      where: { id: cart.id, status: "ACTIVE" },
      data: { status: "EXPIRED", concurrencyVersion: { increment: 1 } },
    });
    return { ...cart, status: "EXPIRED" as const, items: [] };
  }
  return cart;
}

async function createCart() {
  const rawToken = createSecureToken();
  const settings = await checkoutSettings();
  const expiresAt = settings
    ? new Date(Date.now() + settings.cartExpiryMinutes * 60 * 1000)
    : defaultCartExpiry();
  const cart = await prisma.cart.create({
    data: {
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
    include: { items: true },
  });
  return {
    rawToken,
    cart,
    cookie: cartCookie(rawToken, expiresAt),
  };
}

function emptyPublicCart(featureEnabledValue: boolean): PublicCart {
  return {
    featureEnabled: featureEnabledValue,
    status: "MISSING",
    cartId: null,
    compatibilityGroup: null,
    currencyCode: "USD",
    subtotalCents: 0,
    adjustmentTotalCents: 0,
    finalTotalCents: 0,
    itemCount: 0,
    expiresAt: null,
    priceAcceptedAt: null,
    paymentReviewMessage,
    items: [],
    warnings: featureEnabledValue
      ? []
      : ["Cart actions are disabled while checkout is under review."],
    concurrencyVersion: null,
  };
}

function publicCartItem(item: CartItem): PublicCartItem {
  const snapshot = assertKnownCartItemSnapshot(item.customerSafeSnapshot);
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: publicCartItemKind(item.kind),
    compatibilityGroup: item.compatibilityGroup,
    title: snapshot.publicTitle,
    description: snapshot.publicDescription,
    configurationSummary: snapshot.publicConfigurationSummary,
    quantity: item.quantity.toString(),
    currency: item.currencyCode,
    lineItems: snapshot.authoritativeLineItems,
    subtotalCents: item.subtotalCents,
    adjustmentTotalCents: item.adjustmentTotalCents,
    finalTotalCents: item.finalTotalCents,
    validationState: item.validationState,
    repricingRequired: item.repricingRequired,
    stockRecheckRequired: item.stockRecheckRequired,
    availabilityRecheckRequired: item.availabilityRecheckRequired,
    reservationRequired: snapshot.reservationRequired,
    concurrencyVersion: item.concurrencyVersion,
  };
}

export function publicCartFromRecord(
  cart: CartWithItems | null,
  featureEnabledValue: boolean,
): PublicCart {
  if (!cart) return emptyPublicCart(featureEnabledValue);
  const warnings = [];
  if (!featureEnabledValue) {
    warnings.push("Cart actions are disabled while checkout is under review.");
  }
  if (cart.status !== "ACTIVE") {
    warnings.push("This cart can no longer be used.");
  }
  if (cart.items.some((item) => item.repricingRequired)) {
    warnings.push("One or more item totals changed. Review the updated cart.");
  }
  if (
    cart.items.some((item) =>
      ["UNAVAILABLE", "OUT_OF_STOCK", "INCOMPATIBLE"].includes(
        item.validationState,
      ),
    )
  ) {
    warnings.push("One or more items need attention before checkout.");
  }
  return {
    featureEnabled: featureEnabledValue,
    status: cart.status,
    cartId: cart.id,
    compatibilityGroup: cart.compatibilityGroup,
    currencyCode: cart.currencyCode ?? "USD",
    subtotalCents: cart.subtotalCents,
    adjustmentTotalCents: cart.adjustmentTotalCents,
    finalTotalCents: cart.finalTotalCents,
    itemCount: cart.itemCount,
    expiresAt: cart.expiresAt.toISOString(),
    priceAcceptedAt: cart.priceAcceptedAt?.toISOString() ?? null,
    paymentReviewMessage,
    items: cart.items.map(publicCartItem),
    warnings,
    concurrencyVersion: cart.concurrencyVersion,
  };
}

export async function getPublicCart(rawToken: string | undefined | null) {
  const [enabled, cart] = await Promise.all([
    featureEnabled(CART_FEATURE_FLAG),
    resolveCartByRawToken(rawToken),
  ]);
  return {
    cart: publicCartFromRecord(
      cart && cart.status === "ACTIVE" ? cart : null,
      enabled,
    ),
    cookie:
      cart && cart.status !== "ACTIVE"
        ? ({
            name: CART_COOKIE_NAME,
            value: "",
            options: expiredCartCookieOptions(),
          } satisfies CartCookieMutation)
        : null,
  };
}

function assertCartUsable(cart: CartWithItems) {
  if (cart.status !== "ACTIVE") {
    throw new CartError("This cart can no longer be used.");
  }
  if (cart.expiresAt <= new Date()) {
    throw new CartError("This cart has expired.");
  }
}

function assertCompatible(
  cart: CartWithItems,
  item: CartAdapterResult,
  maximum: number,
) {
  const existingItems = cart.items;
  if (existingItems.length >= maximum) {
    throw new CartError(`A cart may contain at most ${maximum} items.`);
  }
  if (!existingItems.length) return;
  const currentGroup = cart.compatibilityGroup;
  if (currentGroup !== item.compatibilityGroup) {
    throw new CartError("This item is not compatible with the current cart.");
  }
  if (item.compatibilityGroup !== "STANDARD_SERVICE") {
    throw new CartError("This cart type supports one item only.");
  }
  if (cart.currencyCode && cart.currencyCode !== item.currencyCode) {
    throw new CartError("Cart items must use the same currency.");
  }
}

async function updateCartTotals(
  transaction: Prisma.TransactionClient,
  cartId: string,
) {
  const items = await transaction.cartItem.findMany({
    where: { cartId },
    orderBy: { createdAt: "asc" },
  });
  const subtotalCents = items.reduce(
    (total, item) => total + item.subtotalCents,
    0,
  );
  const adjustmentTotalCents = items.reduce(
    (total, item) => total + item.adjustmentTotalCents,
    0,
  );
  const finalTotalCents = items.reduce(
    (total, item) => total + item.finalTotalCents,
    0,
  );
  const first = items[0] ?? null;
  await transaction.cart.update({
    where: { id: cartId },
    data: {
      itemCount: items.length,
      subtotalCents,
      adjustmentTotalCents,
      finalTotalCents,
      compatibilityGroup: first?.compatibilityGroup ?? null,
      currencyCode: first?.currencyCode ?? null,
      concurrencyVersion: { increment: 1 },
    },
  });
}

function cartItemCreateData(cartId: string, result: CartAdapterResult) {
  return {
    cartId,
    kind: result.kind,
    compatibilityGroup: result.compatibilityGroup,
    sourceReference: result.sourceReference,
    publicSourceSlug: result.publicSourceSlug,
    quantity: result.quantity,
    currencyCode: result.currencyCode,
    customerSelections: toInputJson(result.customerSelections),
    snapshotSchemaVersion: result.snapshot.schemaVersion,
    customerSafeSnapshot: toInputJson(result.snapshot),
    sourcePublishedRevisionId: result.sourcePublishedRevisionId,
    sourcePublishedRevisionNumber: result.sourcePublishedRevisionNumber,
    globalPricingRevisionId: result.globalPricingRevisionId,
    globalPricingRevisionNumber: result.globalPricingRevisionNumber,
    subtotalCents: result.subtotalCents,
    adjustmentTotalCents: result.adjustmentTotalCents,
    finalTotalCents: result.finalTotalCents,
    validationState: result.validationState,
    repricingRequired: result.repricingRequired,
    stockRecheckRequired: result.stockRecheckRequired,
    availabilityRecheckRequired: result.availabilityRecheckRequired,
  } satisfies Prisma.CartItemUncheckedCreateInput;
}

function cartItemUpdateData(result: CartAdapterResult) {
  return {
    kind: result.kind,
    compatibilityGroup: result.compatibilityGroup,
    sourceReference: result.sourceReference,
    publicSourceSlug: result.publicSourceSlug,
    quantity: result.quantity,
    currencyCode: result.currencyCode,
    customerSelections: toInputJson(result.customerSelections),
    snapshotSchemaVersion: result.snapshot.schemaVersion,
    customerSafeSnapshot: toInputJson(result.snapshot),
    sourcePublishedRevisionId: result.sourcePublishedRevisionId,
    sourcePublishedRevisionNumber: result.sourcePublishedRevisionNumber,
    globalPricingRevisionId: result.globalPricingRevisionId,
    globalPricingRevisionNumber: result.globalPricingRevisionNumber,
    subtotalCents: result.subtotalCents,
    adjustmentTotalCents: result.adjustmentTotalCents,
    finalTotalCents: result.finalTotalCents,
    validationState: result.validationState,
    repricingRequired: result.repricingRequired,
    stockRecheckRequired: result.stockRecheckRequired,
    availabilityRecheckRequired: result.availabilityRecheckRequired,
    concurrencyVersion: { increment: 1 },
  } satisfies Prisma.CartItemUncheckedUpdateInput;
}

export async function addCartItem({
  rawToken,
  input,
  idempotencyKey,
}: {
  rawToken?: string | null;
  input: CartSourceInput;
  idempotencyKey?: string | null;
}) {
  if (!(await featureEnabled(CART_FEATURE_FLAG))) {
    throw new CartError("Cart actions are currently disabled.", 403);
  }
  const result = await resolveCartSource(input);
  if (result.validationState === "MANUAL_REVIEW_REQUIRED") {
    throw new CartError("Manual-review items cannot be added to cart.");
  }

  const resolved = await resolveCartByRawToken(rawToken);
  const created = resolved ? null : await createCart();
  const cart = (resolved ?? created!.cart) as CartWithItems;
  assertCartUsable(cart);

  const idempotencyKeyHash = idempotencyKey
    ? hashIdempotencyKey(idempotencyKey)
    : null;
  const settings = await checkoutSettings();
  const maximum = settings?.maximumCartItems ?? 12;

  const persisted = await prisma.$transaction(async (transaction) => {
    const locked = await transaction.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    assertCompatible(locked, result, maximum);
    if (idempotencyKeyHash) {
      const existing = await transaction.cartItem.findFirst({
        where: { cartId: locked.id, idempotencyKeyHash },
      });
      if (existing) return locked.id;
    }
    await transaction.cartItem.create({
      data: {
        ...cartItemCreateData(locked.id, result),
        idempotencyKeyHash,
      },
    });
    await updateCartTotals(transaction, locked.id);
    return locked.id;
  });

  const fresh = await prisma.cart.findUnique({
    where: { id: persisted },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  return {
    cart: publicCartFromRecord(fresh, true),
    cookie: created?.cookie ?? null,
  };
}

export async function removeCartItem({
  rawToken,
  itemId,
}: {
  rawToken?: string | null;
  itemId: string;
}) {
  if (!(await featureEnabled(CART_FEATURE_FLAG))) {
    throw new CartError("Cart actions are currently disabled.", 403);
  }
  const cart = await resolveCartByRawToken(rawToken);
  if (!cart) throw new CartError("Cart not found.", 404);
  assertCartUsable(cart);
  await prisma.$transaction(async (transaction) => {
    await transaction.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
    await updateCartTotals(transaction, cart.id);
  });
  const fresh = await resolveCartByRawToken(rawToken);
  return publicCartFromRecord(fresh, true);
}

export async function updateCartItemQuantity({
  rawToken,
  itemId,
  quantity,
}: {
  rawToken?: string | null;
  itemId: string;
  quantity: string | number;
}) {
  if (!(await featureEnabled(CART_FEATURE_FLAG))) {
    throw new CartError("Cart actions are currently disabled.", 403);
  }
  const cart = await resolveCartByRawToken(rawToken);
  if (!cart) throw new CartError("Cart not found.", 404);
  assertCartUsable(cart);
  const item = cart.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new CartError("Cart item not found.", 404);
  const result = await resolveCartSource({
    kind: item.kind,
    source: { ...(item.customerSelections as object), quantity },
    quantity,
  });
  if (result.compatibilityGroup !== item.compatibilityGroup) {
    throw new CartError("Updated item is not compatible with this cart.");
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.cartItem.update({
      where: { id: item.id },
      data: cartItemUpdateData(result),
    });
    await updateCartTotals(transaction, cart.id);
  });
  const fresh = await resolveCartByRawToken(rawToken);
  return publicCartFromRecord(fresh, true);
}

function hasPriceChanged(item: CartItem, result: CartAdapterResult) {
  return (
    item.finalTotalCents !== result.finalTotalCents ||
    item.subtotalCents !== result.subtotalCents ||
    item.sourcePublishedRevisionId !== result.sourcePublishedRevisionId ||
    item.sourcePublishedRevisionNumber !==
      result.sourcePublishedRevisionNumber ||
    item.globalPricingRevisionId !== result.globalPricingRevisionId ||
    item.globalPricingRevisionNumber !== result.globalPricingRevisionNumber
  );
}

export async function revalidateCart({
  rawToken,
  acceptUpdatedTotals = false,
}: {
  rawToken?: string | null;
  acceptUpdatedTotals?: boolean;
}) {
  if (!(await featureEnabled(CART_FEATURE_FLAG))) {
    throw new CartError("Cart actions are currently disabled.", 403);
  }
  const cart = await resolveCartByRawToken(rawToken);
  if (!cart) throw new CartError("Cart not found.", 404);
  assertCartUsable(cart);
  let changed = false;
  await prisma.$transaction(async (transaction) => {
    for (const item of cart.items) {
      try {
        const result = await resolveCartSource({
          kind: item.kind,
          source: item.customerSelections,
          quantity: item.quantity.toString(),
        });
        const priceChanged = hasPriceChanged(item, result);
        changed ||= priceChanged;
        await transaction.cartItem.update({
          where: { id: item.id },
          data: {
            ...cartItemUpdateData(result),
            repricingRequired: priceChanged && !acceptUpdatedTotals,
            validationState: priceChanged
              ? "REPRICE_REQUIRED"
              : result.validationState,
          },
        });
      } catch (error) {
        if (error instanceof CartAdapterError) {
          changed = true;
          await transaction.cartItem.update({
            where: { id: item.id },
            data: {
              validationState: "UNAVAILABLE",
              repricingRequired: false,
              availabilityRecheckRequired: true,
              concurrencyVersion: { increment: 1 },
            },
          });
          continue;
        }
        throw error;
      }
    }
    await updateCartTotals(transaction, cart.id);
    await transaction.cart.update({
      where: { id: cart.id },
      data: {
        lastRevalidatedAt: new Date(),
        priceAcceptedAt: acceptUpdatedTotals ? new Date() : undefined,
        concurrencyVersion: { increment: 1 },
      },
    });
  });
  const fresh = await resolveCartByRawToken(rawToken);
  return {
    cart: publicCartFromRecord(fresh, true),
    changed,
  };
}

export function sanitizeCartError(error: unknown) {
  if (
    error instanceof CartError ||
    error instanceof CartAdapterError ||
    error instanceof CheckoutSecurityError
  ) {
    return {
      message: error.message,
      status: error instanceof CartError ? error.status : 400,
    };
  }
  return {
    message: "The cart request could not be completed. Please try again.",
    status: 500,
  };
}

export const CART_FEATURE_FLAG = "cart_enabled";
export const GUEST_CHECKOUT_FEATURE_FLAG = "guest_checkout_enabled";
export const CART_COOKIE_NAME = "osrs_guest_cart";
export const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 3;
export const CART_ITEM_SNAPSHOT_SCHEMA_VERSION = 1;
export const CHECKOUT_NOTIFICATION_TEMPLATE_VERSION = "task013-v1";

export const checkoutPermissions = {
  ordersView: "orders.view",
  ordersManage: "orders.manage",
  ordersStatusManage: "orders.status.manage",
  ordersPaymentReview: "orders.payment.review",
  ordersCancel: "orders.cancel",
  checkoutConfigure: "checkout.configure",
} as const;

export const cartItemKindLabels = {
  SKILLING_ESTIMATE: "Skilling service",
  BOSSING_ESTIMATE: "Bossing service",
  PREMIUM_ESTIMATE: "Premium service",
  PRODUCT_ESTIMATE: "Product",
  ACCOUNT_LISTING_ESTIMATE: "Account listing",
  GOLD_BUY_ESTIMATE: "Gold purchase",
  ACCEPTED_CUSTOM_BUILD_QUOTE: "Accepted custom-build quote",
} as const;

export const compatibilityGroupLabels = {
  STANDARD_SERVICE: "Standard service cart",
  ACCOUNT_LISTING: "Account listing checkout",
  GOLD_BUY: "Gold buy checkout",
  ACCEPTED_CUSTOM_QUOTE: "Accepted quote checkout",
} as const;

export const orderStatusLabels = {
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_UNDER_REVIEW: "Payment under review",
  PAID: "Paid",
  AWAITING_ASSIGNMENT: "Awaiting assignment",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  WAITING_FOR_CUSTOMER: "Waiting for customer",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
  REQUIRES_REVIEW: "Requires review",
} as const;

export const orderPaymentStatusLabels = {
  NOT_STARTED: "Not started",
  AWAITING_INSTRUCTIONS: "Awaiting instructions",
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_UNDER_REVIEW: "Payment under review",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
} as const;

export const paymentReviewMessage =
  "Payment instructions will be provided after your order is reviewed.";

export const emailNotConfiguredMessage =
  "Email delivery is not configured yet. Save your secure tracking link.";

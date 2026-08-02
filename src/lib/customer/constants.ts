export const CUSTOMER_ACCOUNTS_FLAG = "customer_accounts_enabled";
export const CUSTOMER_REGISTRATION_FLAG = "customer_registration_enabled";
export const CUSTOMER_DASHBOARD_FLAG = "customer_dashboard_enabled";

export const CUSTOMER_SETTINGS_KEY = "customer-accounts-default-settings";
export const CUSTOMER_AUTH_TEMPLATE_VERSION = "task014-v1";

export const customerUnavailableMessage =
  "Customer accounts are not available while this foundation is under review.";

export const registrationUnavailableMessage =
  "Customer registration is not available right now.";

export const dashboardUnavailableMessage =
  "The customer dashboard is prepared but not enabled yet.";

export const providerNotConfiguredMessage =
  "Email delivery is not configured yet, so no verification or recovery email was sent.";

export const customerNotificationTypeLabels = {
  ACCOUNT: "Account",
  SECURITY: "Security",
  ORDER_CREATED: "Order created",
  ORDER_STATUS_CHANGED: "Order status",
  ORDER_PAYMENT_CHANGED: "Payment state",
  EMAIL_VERIFICATION: "Email verification",
  PASSWORD_RECOVERY: "Password recovery",
} as const;

export const customerOrderStatusMessages = {
  AWAITING_PAYMENT: "Order received for manual payment review.",
  PAYMENT_UNDER_REVIEW: "Payment is under review.",
  PAID: "Payment confirmed. Staff will prepare the next step.",
  AWAITING_ASSIGNMENT: "Order is waiting for a staff assignment.",
  ASSIGNED: "Order has been assigned.",
  IN_PROGRESS: "Service work is in progress.",
  WAITING_FOR_CUSTOMER: "Staff need a safe customer response.",
  COMPLETED: "Order is complete.",
  CANCELLED: "Order was cancelled.",
  REFUNDED: "Refund activity was recorded.",
  DISPUTED: "Order is under dispute review.",
  REQUIRES_REVIEW: "Order requires manual review.",
} as const;

export const permissions = {
  adminAccess: "admin.access",
  designSystemView: "design_system.view",
  productsView: "products.view",
  productsEdit: "products.edit",
  productsPublish: "products.publish",
  productsInventoryAdjust: "products.inventory.adjust",
  productsReservationsManage: "products.reservations.manage",
  productsMediaManage: "products.media.manage",
  pricingView: "pricing.view",
  pricingEdit: "pricing.edit",
  pricingPublish: "pricing.publish",
  goldView: "gold.view",
  goldEdit: "gold.edit",
  goldPublish: "gold.publish",
  goldInventoryAdjust: "gold.inventory.adjust",
  accountsView: "accounts.view",
  accountsEdit: "accounts.edit",
  accountsApprove: "accounts.approve",
  accountsPublish: "accounts.publish",
  accountsAvailabilityManage: "accounts.availability.manage",
  accountsHandoverReview: "accounts.handover.review",
  customBuildsView: "custom_builds.view",
  customBuildsEdit: "custom_builds.edit",
  customBuildsPublish: "custom_builds.publish",
  customBuildsRequestsReview: "custom_builds.requests.review",
  customBuildsAttachmentsReview: "custom_builds.attachments.review",
  customBuildsQuotesManage: "custom_builds.quotes.manage",
  ordersView: "orders.view",
  ordersManage: "orders.manage",
  ordersStatusManage: "orders.status.manage",
  ordersPaymentReview: "orders.payment.review",
  ordersCancel: "orders.cancel",
  ordersUpdate: "orders.update",
  ordersRefund: "orders.refund",
  chatRespond: "chat.respond",
  chatMonitorAll: "chat.monitor_all",
  checkoutConfigure: "checkout.configure",
  paymentsConfigure: "payments.configure",
  usersManage: "users.manage",
  auditView: "audit.view",
  exportsCustomerData: "exports.customer_data",
} as const;

export type PermissionKey = (typeof permissions)[keyof typeof permissions];

export const permissionDescriptions: Record<PermissionKey, string> = {
  [permissions.adminAccess]: "Access the protected administration area.",
  [permissions.designSystemView]: "View the protected design-system showcase.",
  [permissions.productsView]: "View product and service records.",
  [permissions.productsEdit]: "Create and edit product and service records.",
  [permissions.productsPublish]:
    "Publish, discard and restore product marketplace revisions.",
  [permissions.productsInventoryAdjust]:
    "Adjust product marketplace stock through the append-only ledger.",
  [permissions.productsReservationsManage]:
    "Create, release and expire internal product inventory reservations.",
  [permissions.productsMediaManage]:
    "Manage customer-safe product marketplace media references.",
  [permissions.pricingView]: "View pricing configuration.",
  [permissions.pricingEdit]: "Edit pricing configuration.",
  [permissions.pricingPublish]: "Publish pricing revisions.",
  [permissions.goldView]: "View gold markets, rates, presets and inventory.",
  [permissions.goldEdit]: "Edit gold market settings, rates and presets.",
  [permissions.goldPublish]: "Publish and restore gold rate revisions.",
  [permissions.goldInventoryAdjust]:
    "Adjust gold stock and buying capacity balances.",
  [permissions.accountsView]:
    "View account marketplace listings and operational state.",
  [permissions.accountsEdit]: "Create and edit account marketplace listings.",
  [permissions.accountsApprove]: "Approve or reject account listings.",
  [permissions.accountsPublish]:
    "Publish, discard and restore account listing revisions.",
  [permissions.accountsAvailabilityManage]:
    "Manage account listing holds, availability and sold state.",
  [permissions.accountsHandoverReview]:
    "Review safe account handover readiness metadata.",
  [permissions.customBuildsView]:
    "View custom account build configuration and request workflow.",
  [permissions.customBuildsEdit]:
    "Edit custom account build configuration, skill rules and objectives.",
  [permissions.customBuildsPublish]:
    "Publish, discard and restore custom account build revisions.",
  [permissions.customBuildsRequestsReview]:
    "Review custom account build requests and status history.",
  [permissions.customBuildsAttachmentsReview]:
    "Review and download private custom-build attachment metadata.",
  [permissions.customBuildsQuotesManage]:
    "Create, revise, send and void custom account build quotes.",
  [permissions.ordersView]: "View customer orders.",
  [permissions.ordersManage]: "Manage the order administration workspace.",
  [permissions.ordersStatusManage]:
    "Update non-payment order fulfilment status.",
  [permissions.ordersPaymentReview]:
    "Review manual payments and mark orders paid.",
  [permissions.ordersCancel]:
    "Cancel unpaid orders and release checkout reservations.",
  [permissions.ordersUpdate]: "Update order fulfilment state.",
  [permissions.ordersRefund]: "Initiate or record refunds.",
  [permissions.chatRespond]: "Respond to assigned customer conversations.",
  [permissions.chatMonitorAll]:
    "Monitor and transfer all support conversations.",
  [permissions.checkoutConfigure]:
    "Configure guest checkout settings and manual-review payment methods.",
  [permissions.paymentsConfigure]: "Configure payment providers and flags.",
  [permissions.usersManage]: "Manage customers and staff access.",
  [permissions.auditView]: "View sensitive administrative audit records.",
  [permissions.exportsCustomerData]: "Export customer data.",
};

export const allPermissionKeys = Object.values(permissions);

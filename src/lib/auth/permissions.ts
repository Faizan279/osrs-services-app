export const permissions = {
  adminAccess: "admin.access",
  designSystemView: "design_system.view",
  productsView: "products.view",
  productsEdit: "products.edit",
  pricingView: "pricing.view",
  pricingEdit: "pricing.edit",
  pricingPublish: "pricing.publish",
  ordersView: "orders.view",
  ordersUpdate: "orders.update",
  ordersRefund: "orders.refund",
  chatRespond: "chat.respond",
  chatMonitorAll: "chat.monitor_all",
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
  [permissions.pricingView]: "View pricing configuration.",
  [permissions.pricingEdit]: "Edit pricing configuration.",
  [permissions.pricingPublish]: "Publish pricing revisions.",
  [permissions.ordersView]: "View customer orders.",
  [permissions.ordersUpdate]: "Update order fulfilment state.",
  [permissions.ordersRefund]: "Initiate or record refunds.",
  [permissions.chatRespond]: "Respond to assigned customer conversations.",
  [permissions.chatMonitorAll]:
    "Monitor and transfer all support conversations.",
  [permissions.paymentsConfigure]: "Configure payment providers and flags.",
  [permissions.usersManage]: "Manage customers and staff access.",
  [permissions.auditView]: "View sensitive administrative audit records.",
  [permissions.exportsCustomerData]: "Export customer data.",
};

export const allPermissionKeys = Object.values(permissions);

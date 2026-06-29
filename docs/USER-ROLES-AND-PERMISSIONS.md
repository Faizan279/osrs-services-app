# User Roles and Permissions

## Super Administrator
Full platform administration, including staff, catalogue, pricing, orders, customers, chat, reports, integrations, feature flags, exports, and audit records.

## Editor
May manage products, service copy, categories, media, homepage content, blog, FAQ, legal pages, SEO, promotional banners, and publishing workflows.

Editor does not receive access to financial configuration, refunds, staff administration, customer exports, support conversations, or sensitive platform settings. Price editing is a separate capability and is disabled by default.

## Support Agent
May manage new and assigned support conversations, view the customer and linked-order context needed for support, add internal notes, transfer or escalate conversations, use canned replies, and mark conversations resolved.

Support Agent does not receive access to catalogue pricing, inventory administration, refunds, staff administration, global settings, or audit-record deletion.

## Capability model
Use server-enforced capabilities rather than role-name checks alone, including:

- `products.view`
- `products.edit`
- `pricing.view`
- `pricing.edit`
- `orders.view`
- `orders.update`
- `orders.refund`
- `chat.respond`
- `chat.monitor_all`
- `payments.configure`
- `users.manage`
- `audit.view`
- `exports.customer_data`

# CODEX TASK 013 Completion Report

## Repository State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-013`
- Branch: `codex/task-013-cart-guest-checkout`
- Task 012 merge commit: `9289febf2af34b577835a833aab840d9fa269af8`
- Starting main SHA: `9289febf2af34b577835a833aab840d9fa269af8`
- Implementation commit: finalized by the local Task 013 commit after this report is staged; the exact hash is reported in the final handoff because a commit cannot contain its own final hash.
- Final local HEAD: finalized by the local Task 013 commit after this report is staged; the exact hash is reported in the final handoff.

## Migration

- Added migration: `20260731150000_task013_cart_guest_checkout`
- Migration type: additive
- Rollback: manual only. Disable `cart_enabled` and `guest_checkout_enabled`, export any required order, contact, cart, reservation, notification and audit rows, release outstanding resource holds after review, then remove Task 013-dependent rows in reverse dependency order. Do not use `prisma migrate reset` on shared or production data.

## Enums and Models Added

- Enums: `CartStatus`, `CartItemKind`, `CartCompatibilityGroup`, `CartItemValidationState`, `CheckoutAttemptStatus`, `OrderStatus`, `OrderPaymentStatus`, `OrderItemStatus`, `OrderResourceReservationState`, `OrderStatusEventType`, `CheckoutNotificationType`, `CheckoutNotificationStatus`, `CheckoutPaymentMethodType`, `GoldInventoryReservationStatus`
- Models: `CheckoutSettings`, `CheckoutPaymentMethod`, `Cart`, `CartItem`, `CheckoutAttempt`, `CheckoutIdempotencyRecord`, `GuestOrderContact`, `Order`, `OrderItem`, `OrderStatusEvent`, `OrderPaymentEvent`, `OrderResourceAllocation`, `OrderNotificationOutbox`, `GoldInventoryReservation`

## Routes

- Public routes: `/cart`, `/checkout`, `/checkout/confirmation/[token]`, `/orders/track/[token]`
- API routes: `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/[itemId]`, `DELETE /api/cart/items/[itemId]`, `POST /api/cart/revalidate`, `POST /api/checkout`
- Admin routes: `/admin/orders`, `/admin/orders/[orderId]`, `/admin/checkout`, `/admin/checkout/payment-methods`

## Feature Flags and Permissions

- Feature flags: `cart_enabled=false`, `guest_checkout_enabled=false`
- Permissions: `orders.view`, `orders.manage`, `orders.status.manage`, `orders.payment.review`, `orders.cancel`, `checkout.configure`
- Super Admin receives all permissions.
- Support Agent receives limited order visibility/status capability only and cannot mark orders paid or configure checkout by default.

## Supported Cart Sources

- `SKILLING_ESTIMATE`
- `BOSSING_ESTIMATE`
- `PREMIUM_ESTIMATE`
- `PRODUCT_ESTIMATE`
- `ACCOUNT_LISTING_ESTIMATE`
- `GOLD_BUY_ESTIMATE`
- `ACCEPTED_CUSTOM_BUILD_QUOTE`

Unsupported sources such as customer-selling-gold estimates, manual-review-only estimates, unavailable estimates, draft sources, expired quotes, declined quotes, superseded quote revisions and already-converted quotes fail server-side.

## Compatibility and Repricing

- `STANDARD_SERVICE` supports compatible skilling, bossing, premium and product cart items when currency and limits match.
- `ACCOUNT_LISTING`, `GOLD_BUY` and `ACCEPTED_CUSTOM_QUOTE` are exclusive one-item cart groups.
- Cart revalidation reloads every source through its adapter, recalculates totals, detects revision changes and marks changed totals as requiring customer review before checkout.
- Browser-submitted prices, totals, source revisions, compatibility groups and reservation states are ignored.

## Guest Checkout

Guest checkout stores display name, normalized email, optional Discord username, optional RSN/game ID, consent timestamp, terms version and privacy-policy version. It does not create a `User`, customer account or marketing subscription.

Checkout runs as one server-authoritative transaction: feature flags, cart status, idempotency, recalculation, compatibility, changed-total review, contact/consent validation, reservations, order rows, order items, status/payment events, tracking-token hash, notification outbox and cart conversion succeed or roll back together.

## Order and Tracking Security

- Order numbers use the configured prefix plus date/random components instead of a simple exposed sequence.
- Tracking tokens are high entropy, shown once, stored only as hashes and never logged or placed in screenshots/reports.
- Order item snapshots are immutable after creation.
- Public order pages show customer-safe status, payment state, timeline, item summaries and totals only.

## Payment and Notification Boundaries

- Payment method: `MANUAL_REVIEW`
- No live payment provider, external redirect, payment form, stored card data, webhook or automatic paid state was added.
- Payment-state changes are append-only, permission-guarded and audited.
- Marking an order paid consumes active product/account/gold reservations transactionally and rejects expired reservations.
- Confirmation notifications are represented by deterministic outbox records. If no provider is configured, the public message says email delivery is not configured and tells the customer to save the tracking link.

## Resource Reservations

- Product checkout creates `ProductInventoryReservation` rows for tracked variants and consumes them with one stock-out ledger row when payment is manually marked paid.
- Account listing checkout creates `AccountListingHold` rows and moves listings to held until paid or released.
- Gold-buy checkout creates `GoldInventoryReservation` rows and consumes them by deducting reserved gold once when paid.
- Cancellation and expiry release reservations idempotently.

## Seed Behaviour

Seeds add checkout settings, disabled cart/guest-checkout feature flags and one safe manual-review payment method. Seed reruns preserve prior Task 001-012 data, permission edits, feature-flag edits, checkout settings edits, payment-method edits, carts, orders, order items, contacts, status/payment history, resource allocations, reservations, notification outbox rows and audit logs.

## GitHub Validation

Workflow: `.github/workflows/task013-validation.yml`

Jobs:

- `task013-validation`
- `task012-to-task013-upgrade`
- `task013-final-review-pack`

The workflow uses temporary MySQL 8.4 service containers, CI-only credentials and no production secrets. It includes fresh migration/seed validation, transaction and reservation checks, Task 012-to-Task 013 upgrade preservation, E2E, screenshots and final review-pack generation.

## Local Validation

Local validation is run without local MySQL or Docker. MySQL-backed migration, seed, checkout transaction, reservation race, E2E, screenshot and upgrade validation is configured for GitHub Actions temporary MySQL 8.4.

Expected local commands:

- `pnpm exec prisma format`
- `pnpm db:generate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:seed`
- `pnpm format:check`
- `pnpm build`
- `git diff --check`

Final pass/fail results and test totals are reported in the final handoff after the local validation run completes.

## Screenshots

Expected CI artifacts:

- `artifacts/task-013/public-cart-1440.png`
- `artifacts/task-013/public-cart-mixed-items-1440.png`
- `artifacts/task-013/public-cart-repricing-1440.png`
- `artifacts/task-013/public-checkout-1440.png`
- `artifacts/task-013/public-order-confirmation-1440.png`
- `artifacts/task-013/public-order-tracking-1440.png`
- `artifacts/task-013/public-checkout-mobile-390.png`
- `artifacts/task-013/admin-orders-overview-1440.png`
- `artifacts/task-013/admin-order-detail-1440.png`
- `artifacts/task-013/admin-order-payment-review-1440.png`

## Known Limitations

- `cart_enabled` and `guest_checkout_enabled` are seeded disabled pending client review.
- Checkout uses manual payment review only.
- Email delivery is represented by notification outbox rows only.
- Local MySQL-backed validation was intentionally not run because local MySQL/Docker installation was prohibited.
- Live provider payment processing, customer accounts, work assignment, automatic delivery, shipping, refunds, deployment and Task 014 remain deferred.

## Confirmations

- No live payment provider was added.
- No payment-provider credentials, bank details or card-data fields were added.
- No customer account is automatically created.
- No external email provider was configured or called.
- No deployment was performed.
- No push, PR or merge was performed.
- No Task 014 work was started.
- No previous task worktrees were modified or deleted.
- No local MySQL or Docker installation was performed.

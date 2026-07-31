# CODEX TASK 013 - Cart, Guest Checkout and Order Foundation

## Starting State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-013`
- Branch: `codex/task-013-cart-guest-checkout`
- Task 012 merge commit: `9289febf2af34b577835a833aab840d9fa269af8`
- Starting main SHA: `9289febf2af34b577835a833aab840d9fa269af8`
- Previous Task 007 through Task 012 worktrees were verified present and left untouched.
- No local MySQL or Docker installation is part of this task.
- No push, PR, merge, deployment or Task 014 work is part of this task.

## Objective

Implement a secure cart, guest checkout and order foundation that converts server-authoritative charge-side estimates into manual-review orders, while keeping feature flags disabled by default until client review.

## Delivered Scope

- Additive Prisma migration `20260731150000_task013_cart_guest_checkout`.
- Feature flags `cart_enabled` and `guest_checkout_enabled`, both seeded `false` and preserved on reruns.
- Checkout settings and safe manual-review payment method configuration.
- Persistent guest cart model with hashed tokens and an HttpOnly `osrs_guest_cart` cookie.
- Cart-source adapter architecture for skilling, bossing, premium, product, account listing, gold-buy and accepted custom-build quote sources.
- Compatibility groups for standard services/products, account listings, gold buys and accepted custom quotes.
- Public APIs for cart read, item add/update/remove, revalidation and checkout submission.
- Public `/cart`, `/checkout`, `/checkout/confirmation/[token]` and `/orders/track/[token]` routes.
- Guest contact capture with normalized email, optional Discord, optional RSN/game ID, terms consent and privacy consent.
- Order creation with immutable order item snapshots, human-readable order numbers and hashed tracking tokens.
- Order status and payment status event history.
- Manual payment-review foundation with no live payment-provider calls and no automatic paid state.
- Provider-neutral notification outbox foundation without external email delivery.
- Checkout-time resource reservations for product variants, account listings and gold-buy stock.
- Admin order overview/detail routes and checkout configuration routes.
- Permissions for order view, order management, order status management, payment review, cancellation and checkout configuration.
- Non-destructive seed changes, validation scripts, E2E coverage scaffolding, screenshot capture and review-pack builder.

## Explicitly Excluded

Task 013 does not implement live card payments, Stripe, PayPal, cryptocurrency processing, payment webhooks, stored payment instruments, provider credentials, automatic refunds, shipping integrations, real email delivery, customer accounts, customer dashboards, work assignment, staff scheduling, live chat, reviews, deployment or Task 014.

The manual-review payment method never claims that payment succeeded. Staff with `orders.payment.review` may administratively move a reviewed order to paid, which consumes any active reservations inside a transaction.

## Security and Privacy

- Raw cart tokens and raw tracking tokens are generated with high entropy, stored only client-side once where appropriate, and represented in MySQL only by SHA-256 hashes.
- Public cart and order snapshots exclude contact data, Discord usernames, RSNs, credentials, internal notes, inventory balances, ledger details, reservation actors and audit data.
- Checkout rejects credential-like service-detail keys and credential-looking values.
- Public confirmation/tracking pages use no-store and noindex behavior and do not expose customer email.
- Audit metadata stores bounded IDs, reason codes and status summaries rather than PII or full order snapshots.
- Seeds add no carts, orders, guest contacts, tracking tokens, customer data, payment confirmations or production secrets.

## Validation Strategy

Local validation covers non-database checks:

- `pnpm exec prisma format`
- `pnpm db:generate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:seed`
- `pnpm format:check`
- `pnpm build`
- `git diff --check`

MySQL-backed migration, seed, upgrade, checkout transaction, reservation, E2E, screenshot and review-pack validation is configured in `.github/workflows/task013-validation.yml` with temporary MySQL 8.4 service containers and CI-only credentials. This task intentionally does not install local MySQL or Docker.

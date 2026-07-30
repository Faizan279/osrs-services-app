# CODEX TASK 012 - Product Marketplace and Inventory Reservation Engine

## Starting State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-012`
- Branch: `codex/task-012-product-marketplace`
- Task 011 merge commit: `d24adb9a3fc57befc9676b6a2357c9e578408466`
- Starting main SHA: `d24adb9a3fc57befc9676b6a2357c9e578408466`
- Previous task worktrees were not modified or deleted.
- No local MySQL or Docker installation was used.
- No push, PR, merge, deployment or Task 013 work is part of this task.

## Objective

Implement the reusable `PRODUCT_MARKETPLACE` engine for items, bonds and outfits with server-backed public browsing, product detail pages, preview-only estimates, quantity-tier pricing, product inventory, append-only ledgers, internal reservations, draft/published revisions and admin management.

## Delivered Scope

- Additive Prisma migration `20260730150000_task012_product_marketplace`.
- Product marketplace, categories, products, variants, quantity tiers, public tags, images, immutable product revisions, inventory ledger entries, internal reservations and reservation events.
- Public `/products` marketplace and `/products/[productSlug]` detail route.
- Public APIs: `GET /api/products`, `GET /api/products/[productSlug]`, `POST /api/products/estimate`.
- Server-authoritative price modes: `FIXED_UNIT`, `QUANTITY_TIER`, `FIXED_PACKAGE`, `MANUAL_REVIEW`.
- JSON-safe `ProductEstimateSnapshotV1` and published product revision snapshots with unknown-version rejection.
- Task 008 global-pricing integration for available or low-stock product customer-charge estimates.
- Variant-level tracked, unlimited and manual-review stock modes.
- Atomic append-only inventory adjustment service with idempotency keys and optimistic version checks.
- Internal-only reusable reservation service with create, release, cancel and expiry operations.
- Admin Products Centre at `/admin/products` with categories, product editing, variants, pricing, media, inventory, reservations, history and preview routes.
- Permissions: `products.view`, `products.edit`, `products.publish`, `products.inventory.adjust`, `products.reservations.manage`, `products.media.manage`.
- Feature flag: `product_marketplace_enabled`, seeded disabled.
- Non-destructive product seeds with representative review-safe products, zero stock, placeholder media, product permissions and no customer data.
- Unit, seed, E2E, GitHub Actions, screenshot and review-pack scaffolding.

## Explicitly Excluded

Task 012 does not implement cart, add-to-cart persistence, checkout, guest checkout, orders, order items, payments, payment providers, customer accounts, public reservation APIs, customer-created reservations, shipping, automatic delivery, work assignment, refunds, deployment or Task 013.

Public estimates are preview-only. They never reserve stock, deduct stock, create customer records, create carts, create orders or create payments.

## Security and Privacy

- Public product responses exclude internal reference codes, internal SKUs, internal notes, ledger rows, reservation actors, reservation reasons, audit logs, IP/session data, customer data, credentials and authentication material.
- Product images are validated as public repository-relative image paths with allowed formats and no traversal.
- Reservation metadata is internal-only and customer-free in Task 012.
- Seeded products use neutral placeholder media and review wording; no unlicensed game artwork, fake stock, fake reviews, fake purchases or fake scarcity is seeded.

## Validation Strategy

Local validation covers non-database checks. MySQL-backed migration, seed, upgrade, E2E and screenshot validation is configured in `.github/workflows/task012-validation.yml` with temporary MySQL 8.4 service containers and CI-only credentials.

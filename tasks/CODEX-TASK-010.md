# CODEX TASK 010 - Account Marketplace Engine

## Starting State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-010`
- Branch: `codex/task-010-account-marketplace`
- Task 009 merge commit: `105dc91c900ce3a4d68b97d13df925f30455aabb`
- Starting main SHA: `105dc91c900ce3a4d68b97d13df925f30455aabb`
- Previous task worktrees and backups were not deleted.
- No local MySQL or Docker installation was used.
- No push, PR, merge, deployment or Task 011 work is part of this task.

## Objective

Implement a reusable `ACCOUNT_MARKETPLACE` engine for prebuilt account listings, public marketplace browsing, server-side estimates and admin listing operations while preserving all Task 001-009 behavior.

## Delivered Scope

- Additive Prisma migration `20260727150000_task010_account_marketplace`.
- Account models and enums for marketplaces, listings, stats, unlocks, features, images, revisions, holds and handover readiness.
- Public `/accounts` marketplace and `/accounts/[listingSlug]` detail routes.
- Public APIs: `GET /api/accounts`, `GET /api/accounts/[listingSlug]`, `POST /api/accounts/estimate`.
- Server-side search, filtering, stable sorting and pagination.
- Server-authoritative integer-cent listing prices.
- Customer-safe `AccountListingSnapshotV1` and immutable published listing revision snapshots.
- Task 008 global-pricing compatibility for account listing customer-charge estimates.
- Admin Accounts Centre at `/admin/accounts` with listing editor sections, approval, publication, availability, holds, sold/reopen, handover readiness, history and previews.
- Permissions: `accounts.view`, `accounts.edit`, `accounts.approve`, `accounts.publish`, `accounts.availability.manage`, `accounts.handover.review`.
- Feature flag: `account_marketplace_enabled`, seeded disabled.
- Non-destructive account seeds with representative public-safe listings and media.
- Unit, route, seed and E2E coverage.
- GitHub Actions validation with temporary MySQL 8.4.
- Screenshot and review-pack generation scripts.

## Explicitly Excluded

Task 010 does not implement cart, checkout, guest checkout, orders, order items, payments, payment providers, customer accounts, customer dashboards, customer-created reservations, persistent enquiries, seller submissions, custom account builds, items, bonds, credential handover, email transfer execution, deployment or Task 011.

## Security and Privacy

- No login email, login username, password, email password, bank PIN, recovery answers, authenticator secret, session token, cookie or previous-owner personal data is collected, stored, seeded, logged, displayed or serialized.
- Public endpoints expose only approved, published, customer-safe listing data.
- Public estimates never create holds, reservations, orders, payments or customer records.
- Admin holds store a safe reason, staff actor and expiry only; public responses do not expose actor or reason.
- Secure handover is readiness metadata only: booleans and statuses, not secrets.

## Validation

Local validation uses a placeholder `DATABASE_URL` only for Prisma format/generate/type/build tooling. MySQL-backed migration, seed, screenshot and upgrade validation is delegated to GitHub Actions with temporary MySQL 8.4 service containers.

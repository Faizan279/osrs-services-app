# CODEX TASK 003 — Catalogue Foundation, Admin Management and Public Service Directory

## Objective

Build the reusable MySQL/Prisma catalogue required by later calculators, pricing and checkout work while preserving the approved Task 001 foundation and Task 002 homepage.

## Included

- Normalized categories, services, supported game modes, requirements, media references and immutable publication revisions
- Idempotent, non-destructive taxonomy and development-safe service seeds
- Capability-protected admin overview, category management, service listing/editor, draft preview, duplicate, publish, archive and revision workflows
- Server-side validation, stale-edit protection and catalogue audit events
- Public directory, category and service-detail routes with search, filters, metadata and draft/schedule protection
- Real homepage/navigation destinations, automated tests, MySQL migration validation, responsive screenshots and completion documentation

## Security and workflow rules

- All protected catalogue pages and previews require `products.view`.
- Every mutation independently requires `products.edit`.
- Public queries must never expose internal notes.
- Slugs are normalized and conflicts rejected; media protocols are allow-listed.
- Previously published services are archived, not permanently deleted.
- Publication and archive events create immutable revision snapshots.
- Seeds add missing defaults and never overwrite existing catalogue edits or state.

## Explicit exclusions

No pricing formulas, calculator engines, RSN lookup, automatic eligibility checking, inventory, cart, checkout, payments, order creation/tracking, reviews, live chat, full media upload provider, WooCommerce import or Task 004 functionality.

## Required validation

Run lint, strict typecheck, unit tests, two-device E2E tests, format check and production build. Apply migrations to a fresh MySQL database and an existing Task 001/002 database, prove foundation/password/feature-flag preservation, rerun seeds, inspect all required responsive routes, and generate the nine Task 003 screenshots.

## Delivery boundary

Work only on `codex/task-003-catalogue-foundation`. Commit locally and stop for review. Do not push, open a pull request, deploy, merge or begin Task 004.

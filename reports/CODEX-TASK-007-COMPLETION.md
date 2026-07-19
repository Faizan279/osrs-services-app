# Task 007 completion report - Premium Service Configurators

## Branch and baseline

- Repository: `Faizan279/osrs-services-app`
- Branch: `codex/task-007-premium-service-configurators`
- Starting main commit: `2631c2dd53a19e17596bf3a3ee0b40669d009c5f`
- Final local commit: returned in the final handoff; a commit cannot embed
  its own SHA without changing that SHA.
- Migration:
  `prisma/migrations/20260719190000_task007_premium_service_configurators/migration.sql`
- Delivery boundary honored: no push, pull request, merge, deployment or Task 008 work.

## Implemented scope

- Implemented the existing `PREMIUM_SERVICE_CONFIGURATOR` enum value as a reusable premium-service configurator.
- Added `PremiumOptionType`, `PremiumOptionPricingMode`, `PremiumServiceConfig`, `PremiumPackage`, `PremiumOption`, `PremiumRequirementGroup`, `PremiumRequirement` and `PremiumFaq`.
- Extended `CatalogueService` relations for premium config, packages, options, requirement groups and FAQs.
- Added `premium_configurator_enabled`, seeded disabled by default and preserved on seed rerun.
- Added representative Fire Cape premium seed content: 1 premium service config, 2 packages, 4 requirement groups, 11 premium requirements, 3 FAQs and 3 options, all marked for client review.
- Added pure premium estimate utilities for package base/minimum/setup, account mode, customer gear adjustment, fixed/percentage/per-unit options, Discord Stream and delivery speed.
- Added `POST /api/premium/estimate` with Zod validation, server-side published catalogue lookup, no-store responses and safe generic errors.
- Added public premium configurator rendering on published `PREMIUM_SERVICE_CONFIGURATOR` pages only when the feature flag is enabled.
- Added admin premium overview, package create/edit, option create/edit and staged preview routes under `/admin/catalogue/services/[id]/premium`.
- Extended staged snapshots to schema version 5 with `premium`, while upgrading older Task 003-006 snapshots with `premium: null`.
- Extended duplicate, discard, republish and revision snapshots so premium aggregates are applied atomically with the rest of the catalogue service.
- Added audit actions for premium rule/package/option/requirements/FAQ changes, premium republish and premium discard.
- Added Task 007 unit, route, seed, staging, security and Playwright coverage plus screenshot capture script.

## Public routes and API

- Public page integration:
  `/services/[categorySlug]/[serviceSlug]`
- Estimate endpoint:
  `POST /api/premium/estimate`
- Seeded public validation route:
  `/services/premium-services/fire-cape-premium-service`

The endpoint confirms the feature flag, publication status, `PREMIUM_SERVICE_CONFIGURATOR`, enabled package, enabled options, supported game mode and enabled delivery/add-ons before estimating. Public responses do not expose internal rule IDs, client-review state, internal notes or Prisma errors.

## Admin routes

- `/admin/catalogue/services/[id]/premium`
- `/admin/catalogue/services/[id]/premium/packages/new`
- `/admin/catalogue/services/[id]/premium/packages/[packageId]`
- `/admin/catalogue/services/[id]/premium/options/new`
- `/admin/catalogue/services/[id]/premium/options/[optionId]`
- `/admin/catalogue/services/[id]/preview`

Admin reads require `products.view`; mutations require `products.edit` server-side through the existing action guard pattern.

## Estimate formula rules

1. Validate selected package is enabled.
2. Calculate base price from package base cents and minimum cents.
3. Add setup fee.
4. Add account-mode basis-point adjustment.
5. Add configured gear adjustment when customer gear is required but not confirmed.
6. Add selected enabled options:
   fixed fee, percent of current subtotal or per-unit quantity.
7. Add Discord Stream percentage only when the rule enables it.
8. Add enabled delivery percentage and fixed fee.

The result is an estimate preview only. It does not create cart, checkout, quote, order, payment or order price snapshot records.

## RSN and requirements behavior

- Optional RSN lookup is reused only for allow-listed public premium stats: Attack, Strength, Defence, Ranged, Prayer, Magic, Hitpoints and Total level.
- The configurator works without an RSN.
- Gear ownership, bank contents, inventory contents, quests, diaries, membership and account ownership are not inferred.
- The UI never asks for a RuneScape password and the route uses POST bodies, not URL query strings.
- Automatic public-stat requirements, customer-confirmed requirements and support-verified requirements are shown separately.

## Staging and revision behavior

- Published premium edits create or update `CatalogueServiceStage` snapshots and remain private until republish.
- Public pages and `/api/premium/estimate` continue using the last published premium config until republish.
- Admin preview shows staged premium config.
- Republish deletes/recreates dependent premium rows inside the existing transaction.
- Discard removes staged premium changes without touching live rows.
- Revision snapshots include premium rule, package, requirement group, requirement, FAQ and option data.
- Optimistic version checks protect premium rule, package and option saves.

## Seed behavior

- Fresh seed creates the premium feature flag disabled, 1 config, 2 packages, 4 requirement groups, 11 requirements, 3 FAQs and 3 options.
- Standard delivery is enabled by default; Priority and Express are disabled by default.
- Existing seed reruns preserve administrator password hash, feature flag state, edited premium rules, edited package/option content, staged aggregates, revisions and audit logs.

## Validation results

- `pnpm exec prisma format`: passed.
- `pnpm db:generate`: passed, Prisma Client 7.8.0 generated to `src/generated/prisma`.
- `pnpm lint`: passed, `eslint . --max-warnings=0`.
- `pnpm typecheck`: passed, `tsc --noEmit`.
- `pnpm test`: passed, 22 files and 116 tests.
- `pnpm test:seed`: passed, 1 file and 2 tests.
- `pnpm format:check`: passed, all matched files use Prettier style.
- `pnpm build`: Next build completed as part of the Playwright webServer startup after required local secrets were supplied; a standalone rerun was not attempted because the drive had only about 72 MB free.
- `pnpm test:e2e`: blocked locally. The app built and started, then all Task 007 E2E tests failed before page interaction with `ECONNREFUSED 127.0.0.1:3306` because no MySQL service was running and Docker was unavailable.
- `pnpm screenshots:task007`: blocked locally for the same unavailable MySQL/admin-session environment.

## MySQL validation

Not completed in this local environment.

- `docker` is not available in PATH.
- No MySQL or MariaDB service/binary is available locally.
- `Test-NetConnection 127.0.0.1:3306` returned `TcpTestSucceeded: False`.

Required follow-up when MySQL is available:

- Fresh DB: apply migrations, seed, confirm 9 migrations, 7 services, 1 premium rule, 2 packages, 4 groups, 11 requirements, 3 FAQs, 3 options and `premium_configurator_enabled = false`.
- Existing Task 006 DB: apply only Task 007 migration, rerun seeds, confirm admin hash, feature flags, edited premium package/option/rule rows, staged rows, revisions and audit logs are preserved.

## Screenshot evidence

The capture script is implemented as `pnpm screenshots:task007`, but screenshots were not generated locally because the required MySQL service is unavailable.

Expected screenshot paths:

- `artifacts/task-007/public-premium-configurator-1440.png`
- `artifacts/task-007/public-premium-estimate-1440.png`
- `artifacts/task-007/public-premium-validation-1440.png`
- `artifacts/task-007/public-premium-requirements-1440.png`
- `artifacts/task-007/public-premium-mobile-390.png`
- `artifacts/task-007/admin-premium-overview-1440.png`
- `artifacts/task-007/admin-premium-package-editor-1440.png`
- `artifacts/task-007/admin-premium-option-editor-1440.png`
- `artifacts/task-007/admin-premium-preview-1440.png`
- `artifacts/task-007/admin-premium-mobile-390.png`

Responsive checks are covered in the Task 007 Playwright spec for 320px, 390px, 768px, 1024px and 1440px, pending execution against a running MySQL-backed app.

## Review artifacts

- `changed-files.txt` lists source, test, documentation and migration files included for review.
- `task-007-review-summary.txt` summarizes the implementation and validation result.
- `task-007-review-pack.zip` is the path-safe review archive generated for handoff.

## Known limitations

- Seeded premium prices and delivery estimates are representative defaults and remain marked `Needs client review`.
- Public rollout remains gated by `premium_configurator_enabled`.
- Priority and Express delivery are seeded for admin configuration but disabled until approved.
- The premium configurator is an estimate preview only; cart, checkout, quote creation, order creation, payment processing and price snapshots remain later tasks.
- Local DB-backed validation and screenshots require Docker/MySQL to be available.

## Explicit exclusions

Global pricing, cart, checkout, payments, order creation, quote creation, customer dashboard, marketplaces, inventory reservation, capacity reservation, fake reviews, fake availability, live chat, deployment and Task 008 were not started.

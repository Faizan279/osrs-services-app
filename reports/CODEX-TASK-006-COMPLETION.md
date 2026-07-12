# Task 006 completion report - Bossing / PvM Calculator Engine

## Branch and baseline

- Repository: `Faizan279/osrs-services-app`
- Branch: `codex/task-006-bossing-pvm-engine`
- Starting main commit: `2899a540cd56009cb222ef19c7cf15865ea5ccdf`
- Reviewed implementation commit:
  `be5df8339b543ad58193d13127b7ffa08c5d4e71`
- Current reviewed head before documentation-only fix:
  `be5df8339b543ad58193d13127b7ffa08c5d4e71`
- Migration:
  `prisma/migrations/20260712180000_task006_bossing_pvm_engine/migration.sql`
- Delivery boundary honored: no push, pull request, merge, deployment or Task 007 work.

## Implemented scope

- Implemented the existing `BOSSING_ENGINE` enum value as the reusable bossing/PvM calculator engine.
- Added `BossingPriceMode`, `BossingCalculatorRule`, `BossingBossConfig`, `BossingMethod`, `BossingStatRequirement` and `BossingGearRequirement`.
- Extended `CatalogueService` relations for bossing rule, boss configs and methods.
- Added `bossing_calculator_enabled`, seeded disabled by default and preserved on seed rerun.
- Added representative PvM support seed content: 3 bosses, 3 methods, 8 stat requirements and 6 gear requirements, all marked for client review.
- Added pure bossing estimate utilities for direct kill quantity, current KC to target KC, min/max method ranges, account mode, gear adjustment, supplies, Discord Stream and delivery speed.
- Added `POST /api/bossing/estimate` with Zod validation, server-side published catalogue lookup, no-store responses and safe generic errors.
- Added public PvM calculator rendering on published `BOSSING_ENGINE` pages only when the feature flag is enabled.
- Added admin bossing overview, boss create/edit, method create/edit and staged preview routes under `/admin/catalogue/services/[id]/bossing`.
- Extended staged snapshots to schema version 4 with `bossing`, while upgrading older Task 003-005 snapshots with `bossing: null`.
- Extended duplicate, discard, republish and revision snapshots so bossing aggregates are applied atomically with the rest of the catalogue service.
- Added audit actions for boss/rule/method changes, stat/gear requirement updates, bossing republish and bossing discard.
- Added Task 006 unit, route, seed and Playwright coverage plus screenshot capture.

## Public routes and API

- Public page integration:
  `/services/[categorySlug]/[serviceSlug]`
- Estimate endpoint:
  `POST /api/bossing/estimate`
- Seeded public validation route:
  `/services/bossing-pvm/pvm-support`

The endpoint confirms the feature flag, publication status, `BOSSING_ENGINE`, enabled boss, enabled method, supported game mode and enabled delivery/add-ons before estimating. Public responses do not expose internal rule IDs or Prisma errors.

## Admin routes

- `/admin/catalogue/services/[id]/bossing`
- `/admin/catalogue/services/[id]/bossing/bosses/new`
- `/admin/catalogue/services/[id]/bossing/bosses/[bossId]`
- `/admin/catalogue/services/[id]/bossing/methods/new`
- `/admin/catalogue/services/[id]/bossing/methods/[methodId]`
- `/admin/catalogue/services/[id]/preview`

Admin reads require `products.view`; mutations require `products.edit` server-side through the existing action guard pattern.

## Estimate formula rules

1. Validate kill progress:
   direct positive whole-number kills, or target KC greater than current KC.
2. Enforce method minimum and maximum kill counts.
3. Calculate base price from per-kill rate or fixed package rate.
4. Apply method minimum price.
5. Add setup fee.
6. Add account-mode basis-point adjustment.
7. Add configured gear adjustment when customer-provided gear is required but not confirmed.
8. Add supplies/material fee only when the method enables it.
9. Add Discord Stream percentage only when the rule enables it.
10. Add enabled delivery percentage and fixed fee.

The result is an estimate preview only. It does not create cart, checkout, order, payment, quote or order price snapshot records.

## RSN and requirements behavior

- Optional RSN lookup is reused only for allow-listed public bossing stats: Attack, Strength, Defence, Ranged, Prayer, Magic, Hitpoints and Total level.
- The calculator works without an RSN.
- Gear ownership, inventory, bank contents, boss KC ownership, quests, diaries, membership and account ownership are not inferred.
- The UI never asks for a RuneScape password and the route uses POST bodies, not URL query strings.

## Staging and revision behavior

- Published bossing edits create or update `CatalogueServiceStage` snapshots and remain private until republish.
- Public pages and `/api/bossing/estimate` continue using the last published bossing config until republish.
- Admin preview shows staged bossing config.
- Republish deletes/recreates dependent bossing rows inside the existing transaction.
- Discard removes staged bossing changes without touching live rows.
- Revision snapshots include bossing rule, boss, method, stat requirement and gear requirement data.
- Optimistic version checks protect bossing rule, boss and method saves.

## Seed behavior

- Fresh seed creates the bossing feature flag disabled, 1 rule, 3 bosses, 3 methods, 8 stat requirements and 6 gear requirements.
- Standard delivery is enabled by default; Priority and Express are disabled by default.
- Existing seed reruns preserve the administrator password hash, feature flag state, edited bossing method name/rate, edited bossing delivery flags, staged aggregate count, revision count and audit count.

## Validation results

- `pnpm exec prisma format`: passed.
- `pnpm db:generate`: passed, Prisma Client 7.8.0 generated to `src/generated/prisma`.
- `pnpm lint`: passed, `eslint . --max-warnings=0`.
- `pnpm typecheck`: passed, `tsc --noEmit`.
- `pnpm test`: passed, 20 files and 105 tests.
- `pnpm test:seed`: passed, 1 file and 2 tests.
- `pnpm format:check`: passed, all matched files use Prettier style.
- `pnpm build`: passed with Next.js 16.2.9 webpack, 9 static pages generated.
- `pnpm test:e2e`: passed, 61 passed and 15 skipped, 76 total, using the serial E2E script to avoid shared database feature-flag races.
- `pnpm screenshots:task006`: passed.

## MySQL validation

MySQL Community Server 8.4.10 was used on `127.0.0.1:3307`.

Fresh database `task006_fresh_validation`:

- 8 migrations applied.
- 6 catalogue services seeded.
- 1 bossing calculator rule seeded.
- 3 boss configs seeded.
- 3 bossing methods seeded.
- 8 bossing stat requirements seeded.
- 6 bossing gear requirements seeded.
- `bossing_calculator_enabled` seeded disabled.
- Delivery defaults: Standard enabled, Priority disabled, Express disabled.
- 0 staged rows immediately after seed.

Existing database `task006_existing_validation`:

- Started from `task005_existing_validation`.
- Applied only `20260712180000_task006_bossing_pvm_engine`.
- Seed reruns preserved the existing administrator password hash.
- Seed reruns preserved `bossing_calculator_enabled = true` during the preservation check.
- Seed reruns preserved edited bossing method name `Seed preservation bossing method` and rate `777`.
- Seed reruns preserved edited delivery flags: Standard disabled, Priority enabled, Express enabled.
- Stage, revision and audit counts were stable across repeated seed reruns: 0 staged rows, 8 revisions and 46 audit rows.

## Screenshot evidence

- `artifacts/task-006/public-bossing-calculator-1440.png` - 1440x2603
- `artifacts/task-006/public-bossing-estimate-1440.png` - 1440x2603
- `artifacts/task-006/public-bossing-validation-1440.png` - 1440x2603
- `artifacts/task-006/public-bossing-requirements-1440.png` - 1440x2603
- `artifacts/task-006/public-bossing-mobile-390.png` - 390x4273
- `artifacts/task-006/admin-bossing-overview-1440.png` - 1440x3808
- `artifacts/task-006/admin-bossing-method-editor-1440.png` - 1440x2209
- `artifacts/task-006/admin-bossing-preview-1440.png` - 1440x1191
- `artifacts/task-006/admin-bossing-mobile-390.png` - 390x5635

Responsive checks covered 320px, 390px, 768px, 1024px and 1440px with no horizontal overflow in the new bossing E2E coverage.

## Review artifacts

- `changed-files.txt` lists source, test, documentation, migration and screenshot files included for review.
- `task-006-review-summary.txt` summarizes the implementation and validation result.
- `task-006-final-review-pack.zip` is the path-safe final review archive generated for handoff.

## Known limitations

- Seeded bossing prices and delivery estimates are representative defaults and remain marked `Needs client review`.
- Public rollout remains gated by `bossing_calculator_enabled`.
- Priority and Express delivery are seeded for admin configuration but disabled until approved.
- The bossing calculator is an estimate preview only; cart, checkout, order creation, payment processing, quote creation and price snapshots remain later tasks.

## Explicit exclusions

Premium configurators, Fire Cape, Infernal Cape, Colosseum, raids, global pricing, cart, checkout, payments, order creation, quote creation, customer dashboard, marketplaces, inventory reservation, capacity reservation, reviews, live chat, deployment and Task 007 were not started.

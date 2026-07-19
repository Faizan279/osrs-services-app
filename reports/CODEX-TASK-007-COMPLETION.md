# Task 007 correction status - Premium Service Configurators

## Branch and commits

- Branch: `codex/task-007-premium-service-configurators`
- Starting main SHA: `2631c2dd53a19e17596bf3a3ee0b40669d009c5f`
- Original implementation commit: `d07674043535e25ccedd784b0e2a6777e659d533`
- Correction implementation commit: `8c4802379c55789499cfc669f0d87681cc59426c`
- Migration:
  `prisma/migrations/20260719190000_task007_premium_service_configurators/migration.sql`
- No push, pull request, merge, deployment or Task 008 work was done.

## Correction Scope

- Added `PremiumConfiguratorType` with the seeded Fire Cape premium service set to `FIRE_CAPE`.
- Added premium config `enabled` and `supportsManualStatFallback` fields.
- Added `PremiumRequirementType` and per-requirement `comparisonOperator`.
- Added server-side manual-stat fallback using only allow-listed premium public metrics.
- Added public stat-check choices: RSN lookup, manual entry, or no stat check.
- Preserved official RSN precedence when a public lookup succeeds.
- Ensured manual results are labelled `Customer-entered / not independently verified.`
- Kept gear, quests, unlocks, account ownership, inventory, bank contents, membership and diaries out of automatic verification.
- Updated admin rule editing and compact requirement rows for configurator type, manual fallback, requirement type and operator.
- Updated staged snapshots, revision snapshots, publish, duplicate and older premium snapshot normalization.
- Updated Fire Cape seeds and Task 007 route/staging/E2E/screenshot coverage for the new fields.

## Safety Status

- `premium_configurator_enabled` still defaults off.
- Seeded premium values remain marked `Needs client review`.
- Standard delivery defaults enabled.
- Priority and Express delivery default disabled.
- Public estimates ignore client-submitted prices.
- Disabled premium configs are rejected.
- Public responses do not expose internal rule IDs, client-review state, internal notes or Prisma errors.
- No RuneScape password, email login, bank PIN or authenticator field was added.
- RSN and manual stats are submitted by POST body, not URL query strings.
- No cart, checkout, quote, order, payment, deployment or Task 008 work was done.

## Validation Completed Locally

- `pnpm exec prisma format`: passed.
- `pnpm db:generate`: passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 22 files / 123 tests.
- `pnpm test:seed`: passed, 1 file / 2 tests.
- `pnpm format:check`: passed.
- `pnpm build`: passed after full database environment variables were supplied.

## Environment Gate Not Satisfied

The review stop condition is not reached in this local environment because the required MySQL runtime is unavailable.

- `docker`, `mysql`, `mysqld` and `mariadbd` are not available on PATH.
- No Docker, MySQL or MariaDB service was found.
- `Test-NetConnection 127.0.0.1 -Port 3306` returned `TcpTestSucceeded: False`.
- `C:` had less than 100 MB free after the successful Next build.
- Recursive deletion of generated `.next` output was blocked by local command policy, so free space could not be recovered from that artifact.

Because the preflight requirements failed, `pnpm test:e2e`, fresh MySQL validation, existing Task 006 MySQL validation and `pnpm screenshots:task007` were not completed after the correction commit.

## Required DB Validation When MySQL Is Available

Fresh DB:

- Apply all migrations without reset.
- Run seeds.
- Confirm premium feature flag defaults disabled.
- Confirm representative premium config exists with `configuratorType = FIRE_CAPE`.
- Confirm manual fallback configuration exists.
- Confirm packages, options, requirements and FAQs exist.
- Confirm Standard enabled, Priority disabled and Express disabled.
- Confirm no unexpected staged rows.

Existing Task 006 DB:

- Apply only the Task 007 migration from the Task 006 baseline.
- Do not reset.
- Preserve users, sessions, admin hash, roles, permissions, feature flags, catalogue content, Task 005 skilling data, Task 006 bossing data, staged aggregates, revisions and audit logs.
- Confirm repeated seeds preserve premium config/package/option edits.

## Screenshot Paths To Generate

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

## Known Limitations

- Final Task 007 handoff is blocked until a MySQL 8 compatible database is reachable on the configured host and port.
- The final path-safe review ZIP must be regenerated after DB validation and screenshots are complete.
- Seeded premium prices and delivery estimates are representative defaults and remain marked for client review.
- Public rollout remains gated by `premium_configurator_enabled`.

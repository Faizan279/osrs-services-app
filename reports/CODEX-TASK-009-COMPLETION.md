# CODEX TASK 009 Completion Report

## Repository State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-009`
- Branch: `codex/task-009-gold-trading-engine`
- Task 008 merge commit: `5b3a7e4452e7d383bf2095ecd4d3788f19641383`
- Starting main SHA: `5b3a7e4452e7d383bf2095ecd4d3788f19641383`
- Implementation commit: finalized by the local Task 009 commit after this report is staged; the exact hash is reported in the final handoff.
- Final local HEAD: finalized by the local Task 009 commit after this report is staged; the exact hash is reported in the final handoff.

## Migration

- Added migration: `20260725130000_task009_gold_trading_engine`
- Migration type: additive
- Rollback: manual only. Disable `gold_engine_enabled`, export any gold rates, revisions, presets, ledger and audit data that must be retained, then remove dependent gold records in reverse dependency order after review. Do not use `prisma migrate reset` on shared or production data.

## Models and Enums Added

- Enums: `GoldTradeDirection`, `GoldRateSetStatus`, `GoldInventoryEntryType`, `GoldAvailabilityState`, `GoldSecureServicePricingMode`
- Models: `GoldMarket`, `GoldRateSet`, `GoldRate`, `GoldRateRevision`, `GoldQuantityPreset`, `GoldInventoryLedgerEntry`

## Public Routes

- `/services/gold/gold-trading`
- `/gold`
- `POST /api/gold/estimate`

## Admin Routes

- `/admin/gold`
- `/admin/gold/markets`
- `/admin/gold/markets/[marketId]`
- `/admin/gold/markets/[marketId]/rates`
- `/admin/gold/markets/[marketId]/presets`
- `/admin/gold/markets/[marketId]/inventory`
- `/admin/gold/markets/[marketId]/history`
- `/admin/gold/preview`

## Permissions and Feature Flag

- `gold.view`
- `gold.edit`
- `gold.publish`
- `gold.inventory.adjust`
- `gold_engine_enabled`, seeded `false`

Super Admin receives all gold permissions through the default all-permission role assignment. Support Agent receives `gold.view` only by default and cannot publish rates or adjust inventory by default.

## Quantity and Rate Representation

Gold quantities are represented internally as whole-GP `BigInt` values. API responses and snapshots serialize GP quantities as decimal strings.

Gold rates are integer minor units per 1,000,000 GP. The rounding rule is deterministic half-up:

`(rateMinorUnitsPerMillion * quantityGp + 500000) / 1000000`

No floating-point arithmetic is used for GP quantity conversion or rate calculation.

## Customer-Buy Calculation

`CUSTOMER_BUYS_GOLD` means the business sells gold to the customer. The estimate uses the published customer-buy rate, validates quantity limits and current gold stock, applies optional Secure 100+ Combat Service when configured and selected, and may append Task 008 global-pricing lines when `global_pricing_enabled` is enabled.

## Customer-Sell Calculation

`CUSTOMER_SELLS_GOLD` means the business buys gold from the customer. The estimate uses the published customer-sell rate, validates quantity limits and current buying capacity, and applies Secure 100+ Combat Service only when explicitly configured for this direction. Ordinary customer-charge global pricing is deliberately not applied to payouts.

## Inventory Model

`GoldMarket` stores current `stockQuantityGp` and `buyingCapacityGp` separately. `GoldInventoryLedgerEntry` records append-only adjustment history with entry type, quantity, resulting balances, reason, optional internal note, actor and optional reference key. Estimates create no ledger entries and do not reserve or deduct balances.

## Publication and Revision Behaviour

Draft rate edits stay private. Public estimates use only the latest published `GoldRateRevision` snapshot. Publish is transactional, archives previous published rate sets, creates a published copy and immutable revision snapshot, and preserves the previous public revision if publishing fails. Restore copies an old revision into draft and does not publish it immediately.

## Manual Review Behaviour

Quantities within the automatic threshold produce an automatic estimate. Quantities above the automatic threshold but within configured maximum show a manual-review-required estimate. Quantities above configured maximum reject. Quantities above stock or buying capacity return `UNAVAILABLE`. Paused markets reject estimates.

## RSN Privacy

RSN is collected only when market configuration requires it, validated with existing safe RSN rules, and not placed in URLs, snapshots, audit logs or database records for Task 009. The UI never requests a RuneScape password, PIN or authenticator code.

## Seed Behaviour

Seeds add a Gold category, `gold-trading` `GOLD_ENGINE` catalogue service, one paused gold market, draft buy/sell rates, quantity presets and zero live balances. Seed reruns preserve existing users, password hashes, sessions, roles, role permissions, feature flags, catalogue edits, skilling/bossing/premium/global-pricing data, gold rate edits, published gold revisions, inventory balances, ledgers and audit logs.

## GitHub Validation

Workflow: `.github/workflows/task009-validation.yml`

Jobs:

- `task009-validation`
- `task008-to-task009-upgrade`
- `task009-final-review-pack`

The workflow uses temporary MySQL 8.4 service containers and CI-only credentials.

## Local Validation

- `pnpm exec prisma format`: passed
- `pnpm db:generate`: passed
- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed, 26 files / 155 tests
- `pnpm test:seed`: passed, 1 file / 2 tests
- `pnpm format:check`: passed
- `pnpm build`: passed with full placeholder database environment; no local MySQL-backed migration or seed command was run

No local MySQL-backed migrations or seeds were run.

## Screenshots

Expected CI artifacts:

- `artifacts/task-009/public-gold-buy-1440.png`
- `artifacts/task-009/public-gold-sell-1440.png`
- `artifacts/task-009/public-gold-buy-estimate-1440.png`
- `artifacts/task-009/public-gold-manual-review-1440.png`
- `artifacts/task-009/public-gold-unavailable-1440.png`
- `artifacts/task-009/public-gold-mobile-390.png`
- `artifacts/task-009/admin-gold-overview-1440.png`
- `artifacts/task-009/admin-gold-rate-editor-1440.png`
- `artifacts/task-009/admin-gold-inventory-1440.png`
- `artifacts/task-009/admin-gold-history-1440.png`

## Known Limitations

- No cart, checkout, quote, order, payment or reservation flow is implemented in Task 009.
- Gold trading is seeded in review mode with `gold_engine_enabled=false`, no live balances and no default published gold revision.
- Database-backed migration/seed/screenshot validation is intended for GitHub Actions temporary MySQL 8.4, not local MySQL.

## Confirmations

- No push was performed.
- No PR was created.
- No merge was performed.
- No deployment was performed.
- No Task 010 work was started.
- No previous task worktrees or backups were deleted.
- No local MySQL or Docker installation was performed.

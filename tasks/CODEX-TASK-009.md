# CODEX TASK 009 - Gold Trading, Rates and Inventory Engine

## Starting State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-009`
- Branch: `codex/task-009-gold-trading-engine`
- Task 008 merge commit: `5b3a7e4452e7d383bf2095ecd4d3788f19641383`
- Starting main SHA: `5b3a7e4452e7d383bf2095ecd4d3788f19641383`
- Previous task worktrees and backups were not deleted.
- No local MySQL or Docker installation was used.
- No push, PR, merge, deployment or Task 010 work is part of this task.

## Objective

Implement a reusable `GOLD_ENGINE` for public buy/sell gold estimates and admin rate/inventory management while preserving all Task 001-008 behavior.

## Delivered Scope

- Additive Prisma migration `20260725130000_task009_gold_trading_engine`.
- Gold models and enums for markets, rate sets, rates, revisions, presets and inventory ledger entries.
- Public `/services/gold/gold-trading` engine and `/gold` convenience redirect.
- Server-authoritative `POST /api/gold/estimate` endpoint.
- Customer-buy and customer-sell directions named `CUSTOMER_BUYS_GOLD` and `CUSTOMER_SELLS_GOLD`.
- Whole-GP `BigInt` quantity representation with JSON decimal-string serialization.
- Integer minor-unit rates per 1,000,000 GP.
- Deterministic half-up rounding.
- Published gold-rate revision snapshots and customer-safe estimate snapshots.
- Admin Gold Centre at `/admin/gold` with market, rates, presets, inventory, history and preview routes.
- Draft edit, publish, discard and restore workflow.
- Stock and buying-capacity balances with atomic ledger adjustments.
- Permissions: `gold.view`, `gold.edit`, `gold.publish`, `gold.inventory.adjust`.
- Feature flag: `gold_engine_enabled`, seeded disabled.
- Non-destructive gold seeds with paused market, draft rates, presets and zero live balances.
- Unit, route, inventory, seed and E2E coverage.
- GitHub Actions validation with temporary MySQL 8.4.
- Screenshot and review-pack generation scripts.

## Explicitly Excluded

Task 009 does not implement cart, checkout, guest checkout, orders, order items, payment records, payment providers, quote records, persistent customer quote requests, stock reservation, estimate-driven stock deduction, customer accounts, account marketplaces, custom account builds, items, bonds, outfits or Task 010.

## Security and Privacy

- The public endpoint ignores client-submitted rates, totals, stock, capacity, availability and revision data.
- RSN is validated when required, is never put in URLs, is not stored by Task 009, and is excluded from estimate snapshots and audit metadata.
- Estimate snapshots exclude internal notes, ledger history, customer contact data, authentication data and database credentials.
- Estimates never reserve or deduct stock or buying capacity.
- Inventory adjustments use transactions and optimistic stock-version protection.

## Validation

Local validation uses a placeholder `DATABASE_URL` only for Prisma format/generate/type tooling. MySQL-backed migration and seed validation is delegated to GitHub Actions with temporary MySQL 8.4 service containers.

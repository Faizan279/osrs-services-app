# Codex Task 008 - Global Pricing Foundation

## Objective

Add a global pricing foundation that sits above the existing skilling, bossing and premium estimate engines without changing public behavior while the feature flag is disabled.

## Starting Point

- Branch: `codex/task-008-global-pricing-foundation`
- Starting main SHA: `387be5d140ab50ae796f9108867a68dd9641f869`
- Worktree: `E:\Codex\osrs-services-task-008`
- Task 007 worktree left intact.

## Implemented Scope

- Add additive pricing Prisma models and enums:
  - `PricingRuleSet`
  - `PricingRule`
  - `PricingRuleApplicability`
  - `PricingRevision`
- Add `global_pricing_enabled`, seeded disabled and preserved on rerun.
- Add `pricing.publish` permission alongside `pricing.view` and `pricing.edit`.
- Seed a neutral draft pricing rule set and neutral published revision with zero rules.
- Add a pure global pricing engine with fixed additions, percentage additions, minimum totals and maximum totals.
- Support global, engine-type, category and service applicability.
- Support priority, specificity, exclusive groups and effective date windows.
- Add immutable published revision snapshots and estimate `PriceSnapshotV1`.
- Integrate global pricing into skilling, bossing and premium public estimate routes after each service engine calculates its base subtotal.
- Keep RSN and manual stat values out of price snapshots.
- Add `/admin/pricing` overview, rule list, rule editor, preview and history pages.
- Add server actions for draft save, publish, discard and restore with optimistic draft version checks.
- Add Task 008 GitHub Actions validation, screenshot capture and review-pack scripts.

## Explicit Exclusions

- No cart, checkout, quote, order or payment records.
- No taxes, coupons, discount codes or promotion engine.
- No inventory, capacity reservation or fulfillment logic.
- No deployment, push, PR creation, merge or production flag activation.

## Safety Notes

- `global_pricing_enabled` defaults off.
- With the flag disabled, Task 005-007 estimate totals remain unchanged.
- Public estimates never trust client-submitted prices.
- Public routes load only the latest published pricing revision.
- Draft rules are private until published.
- Published revisions are immutable JSON snapshots.
- `pricing.publish` is separate from `pricing.edit`.
- Support Agent does not receive pricing edit or publish permission by default.

## Validation Plan

Local commands:

- `pnpm exec prisma format`
- `pnpm db:generate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:seed`
- `pnpm format:check`
- `pnpm build`

GitHub Actions:

- `.github/workflows/task008-validation.yml`
- Fresh MySQL 8.4 validation
- Task 007-to-Task 008 upgrade validation
- E2E tests
- Task 008 screenshots
- Final review-pack generation

# Codex Task 007 - Premium Service Configurators

## Objective

Make the existing `PREMIUM_SERVICE_CONFIGURATOR` catalogue engine functional for high-value configured services such as Fire Cape, Infernal Cape, Colosseum and raids.

## Implemented Scope

- Add additive premium configurator Prisma models and enums.
- Seed a representative Fire Cape premium service with `PremiumConfiguratorType.FIRE_CAPE`.
- Add the `premium_configurator_enabled` feature flag, seeded disabled and preserved on rerun.
- Add premium config `enabled`, `rsnEligibilityEnabled` and `supportsManualStatFallback`.
- Render a public premium configurator on published premium service pages when the feature flag and config are enabled.
- Add `POST /api/premium/estimate` for server-authoritative estimate previews.
- Support package selection, account mode, customer gear confirmation, optional add-ons, Discord Stream, delivery speed and FAQ/requirement display.
- Support optional RSN lookup, manual stat entry or no stat check.
- Limit manual stat entry and automatic public checks to allow-listed premium metrics.
- Add `PremiumRequirementType` and configured comparison operators.
- Add admin premium overview, package editor, option editor and staged preview routes.
- Preserve Task 003 staged publication, optimistic concurrency, revisions and audit behavior.
- Add focused unit, route, seed, staging, security and Playwright coverage.
- Add Task 007 screenshot capture script and review-pack documentation.

## Explicit Exclusions

- No cart, checkout, quote, order, payment, dashboard, inventory reservation or capacity reservation records.
- No fake reviews, fake availability, fake sales counts or fake guarantees.
- No Task 008 work.
- No deployment, push, pull request or merge.

## Safety Notes

- `premium_configurator_enabled` defaults off.
- Seeded premium values are marked `Needs client review`.
- Standard delivery defaults enabled.
- Priority and Express delivery default disabled.
- Public estimates ignore client-submitted prices.
- Public responses do not expose internal rule IDs, client-review markers, internal notes or Prisma errors.
- Gear, bank, inventory, quests, diaries, membership and account ownership are not inferred from RSN lookup or manual stat entry.
- Manual stat results are labelled `Customer-entered / not independently verified.`
- Official RSN results take precedence when lookup succeeds.
- The public UI has no RuneScape password field and RSNs/manual stats are sent by POST body only.

## Validation Status

Passing locally:

- `pnpm exec prisma format`
- `pnpm db:generate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`: 22 files / 123 tests
- `pnpm test:seed`: 1 file / 2 tests
- `pnpm format:check`
- `pnpm build`

Environment gate not satisfied:

- Docker/MySQL/MariaDB are unavailable locally.
- Port `127.0.0.1:3306` is closed.
- Free disk was below 100 MB after the successful build.

The Task 007 stop condition still requires MySQL-backed E2E tests, fresh/existing MySQL validation, screenshot generation and a final review ZIP.

# Codex Task 007 - Premium Service Configurators

## Objective

Make the existing `PREMIUM_SERVICE_CONFIGURATOR` catalogue engine functional for high-value configured services such as Fire Cape, Infernal Cape, Colosseum and raids.

## Clean Publication History

- Starting main SHA: `2631c2dd53a19e17596bf3a3ee0b40669d009c5f`
- Clean reconstructed implementation commit: `4615b8230287e0ba996afea57c0097ecbf9e0a7c`
- Clean reconstructed correction commit: `74adb8775c24aaedc11f44f0dc1a734925c5e8cd`
- Clean reconstructed documentation status commit: `ff2e082ef92e0a80ba5dda717158e57c2aa924c9`
- Pre-cleanup local commits are retained only in the local backup branch and verified backup bundle.
- Git history was reconstructed before the first GitHub push to remove a generated Task 007 review ZIP from the publishable branch.

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
- No deployment or merge; repository handoff uses a draft pull request only.

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

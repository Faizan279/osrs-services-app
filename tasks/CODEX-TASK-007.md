# Codex Task 007 - Premium Service Configurators

## Objective

Make the existing `PREMIUM_SERVICE_CONFIGURATOR` catalogue engine functional for high-value configured services such as Fire Cape, Infernal Cape, Colosseum and raids.

## Implemented Scope

- Add additive premium configurator Prisma models and enums.
- Seed a representative Fire Cape premium service with client-review pricing defaults.
- Add the `premium_configurator_enabled` feature flag, seeded disabled and preserved on rerun.
- Render a public premium configurator on published premium service pages when the feature flag is enabled.
- Add `POST /api/premium/estimate` for server-authoritative estimate previews.
- Support package selection, account mode, customer gear confirmation, optional add-ons, Discord Stream, delivery speed and FAQ/requirement display.
- Reuse optional RSN eligibility only for allow-listed public stat requirements.
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
- Gear, bank, inventory, quests, diaries, membership and account ownership are not inferred from RSN lookup.
- The public UI has no RuneScape password field and RSNs are sent by POST body only.

## Validation Status

Passing locally:

- `pnpm exec prisma format`
- `pnpm db:generate`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`: 22 files / 116 tests
- `pnpm test:seed`: 1 file / 2 tests
- `pnpm format:check`

Blocked locally:

- `pnpm test:e2e` reached Next build/start, then failed because no MySQL service was listening on `127.0.0.1:3306`.
- `pnpm screenshots:task007` requires the same running MySQL database and admin credentials.
- Fresh/existing MySQL migration validation requires Docker or a local MySQL/MariaDB service, neither of which is available in this environment.

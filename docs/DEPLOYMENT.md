# Deployment Plan

## Current environment

- Domain: osrsservices.com
- Hosting: Hostinger Business Web Hosting
- Existing production site: WordPress and WooCommerce

## Development

Build locally first. Keep the current website live. Use separate development data and no live payment configuration.

## Staging

Create a staging environment before production. Test Hostinger's Node.js application support first. Use an alternative managed Node environment or VPS if the required custom server or real-time connections are limited.

## Production gate

Before switching the domain, verify migration, media, redirects, SSL, administrator access, backups, chat, email, correctly enabled features, rollback, tests, and client approval.

The domain and email may remain at Hostinger even if the application later moves to a VPS or split deployment.

## Eligibility configuration

Configure the server-only timeout, positive/negative cache TTLs, rate-limit window/count, proxy trust, and dedicated HMAC secret from `.env.example`. Never use `NEXT_PUBLIC_*` for secrets. Leave fixture mode and proxy-header trust disabled unless their documented assumptions are explicitly satisfied.

Run `prisma migrate deploy` without reset. Migration `20260706150000_task004_catalogue_engine_eligibility` is additive. Rollback is manual: disable eligibility, export new data, remove new foreign keys in dependency order, and only then remove Task 004 columns/tables after review.

## Skilling calculator deployment notes

Task 005 adds migration `20260711190000_task005_skilling_calculator_engine`. It is additive and creates skilling calculator tables plus enum values used by `CatalogueService.engineType = SKILLING_CALCULATOR`.

Normal seed runs create `skilling_calculator_enabled` disabled because the representative skilling rates and rules are still marked `Needs client review`. Staging or screenshot validation may enable the flag deliberately, but public rollout should wait for client-approved pricing and delivery configuration.

Before enabling the calculator outside local validation:

- run `pnpm db:migrate` without reset
- run `pnpm db:seed` and confirm seed reruns preserve edited skilling rules and feature flags
- confirm the database feature flag `skilling_calculator_enabled` is intentionally enabled
- review every seeded skilling method/rule marked `Needs client review`
- keep Priority and Express delivery disabled until the client approves those fees and estimates
- verify public estimates, admin skilling pages and mobile screenshots against staging data

Rollback is manual. First disable `skilling_calculator_enabled`, then export any admin-edited skilling rows and staged aggregates that must be retained. Remove dependent skilling methods, skills and rules before removing the Task 005 tables or enum usage. Do not use `prisma migrate reset` against shared or production data.

## Bossing calculator deployment notes

Task 006 adds migration `20260712180000_task006_bossing_pvm_engine`. It is additive and creates bossing calculator tables for rules, boss configs, methods, stat requirements and gear requirements. It uses the existing `CatalogueService.engineType = BOSSING_ENGINE` enum value.

Normal seed runs create `bossing_calculator_enabled` disabled because the representative bossing rates and rules are still marked `Needs client review`. Staging or screenshot validation may enable the flag deliberately, but public rollout should wait for client-approved boss/method pricing, requirement wording and delivery configuration.

Before enabling the calculator outside local validation:

- run `pnpm db:migrate` without reset
- run `pnpm db:seed` and confirm seed reruns preserve edited bossing rules, methods, feature flags, staged aggregates and revisions
- confirm the database feature flag `bossing_calculator_enabled` is intentionally enabled
- review every seeded bossing method/rule marked `Needs client review`
- keep Priority and Express delivery disabled until the client approves those fees and estimates
- verify public estimates, admin bossing pages and mobile screenshots against staging data

Rollback is manual. First disable `bossing_calculator_enabled`, then export any admin-edited bossing rows and staged aggregates that must be retained. Remove dependent bossing stat and gear requirements, methods, bosses and rules before removing the Task 006 tables. Do not use `prisma migrate reset` against shared or production data.

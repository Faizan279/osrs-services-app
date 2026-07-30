# Deployment Plan

## Current environment

- Domain: osrsservices.com
- Hosting: Hostinger Business Web Hosting
- Existing production site: WordPress and WooCommerce

## Development

Build locally first. Keep the current website live. Use separate development data and no live payment configuration.

Local MySQL is optional for Task 007 validation handoff. The draft PR workflow `.github/workflows/task007-validation.yml` runs the full Task 007 validation suite on GitHub-hosted runners with temporary MySQL 8.4 service containers, then uploads screenshots, validation reports and the final review pack as workflow artifacts. These CI databases and credentials are disposable and must not be reused for production.

Local MySQL is also optional for Task 008 handoff validation. `.github/workflows/task008-validation.yml` runs fresh MySQL validation, Task 007-to-Task 008 upgrade validation, tests, screenshots and review-pack generation on GitHub-hosted MySQL 8.4 service containers.

Local MySQL remains optional for Task 009 handoff validation. `.github/workflows/task009-validation.yml` runs fresh MySQL validation, Task 008-to-Task 009 upgrade validation, tests, screenshots and review-pack generation on GitHub-hosted MySQL 8.4 service containers.

Local MySQL remains optional for Task 010, Task 011 and Task 012 handoff validation. `.github/workflows/task010-validation.yml`, `.github/workflows/task011-validation.yml` and `.github/workflows/task012-validation.yml` run their database-backed checks on GitHub-hosted MySQL 8.4 service containers with disposable CI credentials.

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

## Premium configurator deployment notes

Task 007 adds migration `20260719190000_task007_premium_service_configurators`. It is additive and creates premium configurator tables for rules, packages, options, requirement groups, requirements and FAQs. It uses the existing `CatalogueService.engineType = PREMIUM_SERVICE_CONFIGURATOR` enum value.

Normal seed runs create `premium_configurator_enabled` disabled because the representative premium package prices and rules are still marked `Needs client review`. Staging or screenshot validation may enable the flag deliberately, but public rollout should wait for client-approved package pricing, requirement wording, option availability and delivery configuration.

Before enabling the configurator outside local validation:

- run `pnpm db:migrate` without reset
- run `pnpm db:seed` and confirm seed reruns preserve edited premium rules, packages, options, feature flags, staged aggregates and revisions
- review the GitHub Actions Task 007 validation artifacts when using PR-based handoff validation
- confirm the database feature flag `premium_configurator_enabled` is intentionally enabled
- review every seeded premium package, option and rule marked `Needs client review`
- keep Priority and Express delivery disabled until the client approves those fees and estimates
- verify public estimates, admin premium pages and mobile screenshots against staging data

Production still requires a real persistent MySQL database at deployment time. Do not point production at the temporary GitHub Actions MySQL service or any CI-only credentials.

Rollback is manual. First disable `premium_configurator_enabled`, then export any admin-edited premium rows and staged aggregates that must be retained. Remove dependent premium requirements, requirement groups, FAQs, options, packages and config before removing the Task 007 tables. Do not use `prisma migrate reset` against shared or production data.

## Global pricing deployment notes

Task 008 adds migration `20260723160000_task008_global_pricing_foundation`. It is additive and creates pricing rule sets, draft rules, applicability rows and immutable published pricing revisions.

Normal seed runs create:

- `global_pricing_enabled` disabled
- one neutral draft pricing rule set
- one neutral published pricing revision with zero rules
- `pricing.publish` permission for Super Admin through the default permission set

Before enabling global pricing outside validation:

- run `pnpm db:migrate` without reset
- run `pnpm db:seed` twice and confirm edited feature flags are preserved
- review `/admin/pricing` and publish a client-approved pricing revision
- confirm `global_pricing_enabled` is intentionally enabled
- verify public estimates for skilling, bossing and premium services
- review Task 008 validation artifacts when using PR-based handoff validation

Rollback is manual. First disable `global_pricing_enabled`, then export any admin-edited pricing rule sets, rules, revisions and audit rows that must be retained. Remove applicability rows, rules, revisions and rule sets in dependency order only after review. Do not use `prisma migrate reset` against shared or production data.

## Gold trading deployment notes

Task 009 adds migration `20260725130000_task009_gold_trading_engine`. It is additive and creates gold markets, draft/published rate sets, rates, immutable rate revisions, quantity presets and inventory ledger entries.

Normal seed runs create:

- the Gold category and `gold-trading` catalogue service
- one paused gold market
- draft customer-buy and customer-sell rates marked `Needs client review`
- quantity presets
- zero gold stock and zero buying capacity
- `gold_engine_enabled` disabled

Before enabling gold trading outside validation:

- run `pnpm db:migrate` without reset
- run `pnpm db:seed` twice and confirm edited gold rates, presets, balances, ledgers, revisions and feature flags are preserved
- review `/admin/gold` and publish a client-approved gold-rate revision
- enter real stock and buying capacity through inventory adjustments
- confirm `gold_engine_enabled` is intentionally enabled
- verify public buy/sell estimates and mobile screenshots against staging data

Rollback is manual. First disable `gold_engine_enabled`, then export any admin-edited gold rates, revisions, presets, inventory ledgers and audit rows that must be retained. Remove ledger entries, presets, revisions, rates, rate sets and markets in dependency order only after review. Do not use `prisma migrate reset` against shared or production data.

## Account marketplace deployment notes

Task 010 adds migration `20260727150000_task010_account_marketplace`. It is additive and creates account marketplaces, listings, public stats, unlocks, features, images, immutable published revisions, temporary holds and secure-handover readiness checklist rows.

Seed creates:

- the Accounts category and `account-marketplace` catalogue service
- one account marketplace
- representative public-safe account listings, stats, unlocks, feature tags and placeholder media
- `account_marketplace_enabled` disabled

Before enabling account marketplace browsing outside validation:

- run `pnpm db:migrate` without reset
- run `pnpm db:seed` twice and confirm edited account listings, revisions, availability, active holds, handover readiness and feature flags are preserved
- review `/admin/accounts` and publish only client-approved listing revisions
- confirm listing screenshots and media contain no login names, emails, private chat, customer data or credentials
- confirm `account_marketplace_enabled` is intentionally enabled
- keep cart, checkout, payment, order, reservation and credential handover flows disabled until later tasks implement them

Rollback is manual. First disable `account_marketplace_enabled`, then export any admin-edited listings, revisions, holds, handover readiness rows and audit rows that must be retained. Remove account holds, revisions, images, features, unlocks, stats, checklists, listings and marketplaces in dependency order only after review. Do not use `prisma migrate reset` against shared or production data.

## Custom account-build deployment notes

Task 011 adds migration `20260728150000_task011_custom_account_build`. It is additive and creates custom-build service configuration, draft rule sets, skill/objective rules, immutable published revisions, persistent requests, request status history, quarantined attachment metadata, quotes, quote revisions, quote lines and customer quote decisions.

Seed creates:

- the Custom Account Builds category and `custom-account-build` catalogue service
- one custom-build service configuration
- representative skill rules and quest/diary/unlock objectives marked `Needs client review`
- one draft rule set
- one neutral published custom-build revision
- `custom_account_build_enabled` disabled

Before enabling custom account-build intake outside validation:

- run `pnpm db:migrate` without reset
- set `CUSTOM_BUILD_PRIVATE_ATTACHMENT_ROOT` to a private non-public filesystem location
- run `pnpm db:seed` twice and confirm edited custom-build config, rules, revisions, requests, attachment metadata, quotes, customer decisions and feature flags are preserved
- review `/admin/custom-builds` and publish only client-approved pricing/prerequisite rules
- confirm production malware-scanning strategy before accepting customer attachments
- confirm public copy still says no passwords or credential screenshots are accepted
- confirm `custom_account_build_enabled` is intentionally enabled
- keep cart, checkout, order, payment, work assignment, customer-dashboard and credential-handover flows disabled until later tasks implement them

Rollback is manual. First disable `custom_account_build_enabled`, then export any custom-build requests, attachment metadata, quote revisions, customer decisions, admin-edited rules and audit rows that must be retained. Remove decisions, quote lines, quote revisions, quotes, attachments, status events, request objectives, request skills, requests, revisions, objective rules, objectives, skill rules, rule sets and service configuration in dependency order only after review. Do not use `prisma migrate reset` against shared or production data.

## Product marketplace deployment notes

Task 012 adds migration `20260730150000_task012_product_marketplace`. It is additive and creates product marketplaces, categories, products, variants, quantity tiers, tags, media, immutable product revisions, inventory ledger entries, internal reservations and reservation events.

Seed creates:

- the Products category and `product-marketplace` catalogue service
- one Product Marketplace configuration
- Items, Bonds and Outfits product categories
- representative products, variants, quantity tiers, tags and safe placeholder images
- zero initial-balance ledger rows
- one neutral published product revision for a paused demo bond product
- `product_marketplace_enabled` disabled

Before enabling product marketplace browsing outside validation:

- run `pnpm db:migrate` without reset
- run `pnpm db:seed` twice and confirm edited product drafts, published revisions, variant prices, tiers, inventory balances, ledger rows, reservations, availability states and feature flags are preserved
- review `/admin/products` and publish only client-approved product revisions
- enter real stock only through authorized inventory adjustments
- confirm product images are licensed/approved and contain no customer or credential information
- confirm `product_marketplace_enabled` is intentionally enabled
- keep public reservations, cart, checkout, order, order item, payment, shipping and automatic delivery flows disabled until later tasks implement them

Rollback is manual. First disable `product_marketplace_enabled`, then export any admin-edited products, published revisions, inventory ledger entries, active reservations and audit rows that must be retained. Remove reservation events, reservations, ledger entries, revisions, images, tag assignments, tags, price tiers, variants, products, categories and marketplace rows in dependency order only after review. Do not use `prisma migrate reset` against shared or production data.

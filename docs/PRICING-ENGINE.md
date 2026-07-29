# Pricing Engine

## Principles

- The server is the source of truth.
- Every price, percentage, and availability rule is editable in admin.
- Published pricing rules need version history before they can support orders.
- Every future order item must store a full price snapshot.
- Client-side totals are previews only.
- Old orders never change when current prices change.

## Task 005 skilling estimate preview

Task 005 adds a skilling-specific preview engine only. It calculates an `Estimated total` from service-scoped skilling rules and training methods, then tells the customer that final price is confirmed before checkout.

Inputs handled by the skilling preview:

- level mode or XP mode using the OSRS XP table
- base cents per 1 million XP
- minimum method price
- optional fixed method fee
- account-mode basis-point adjustments
- optional supplies fee
- optional Discord Stream percentage
- configured delivery percentage and fixed fee

The public route never trusts client-submitted prices and does not expose internal rule IDs or arbitrary formulas. Seeded skilling rates are representative defaults only and are marked `Needs client review`, so the public `skilling_calculator_enabled` feature flag is seeded off until client approval.

Task 005 intentionally does not add checkout/order price snapshots, global discount stacking, taxes, payment-provider logic or the full pricing administration workflow for every engine.

## Task 006 bossing estimate preview

Task 006 adds a bossing-specific preview engine only. It calculates an `Estimated total` from service-scoped bossing rules, enabled bosses and enabled methods, then tells the customer that final price is confirmed before checkout.

Inputs handled by the bossing preview:

- direct kill quantity or current KC to target KC
- base cents per kill or fixed package cents
- minimum method price
- optional setup fee
- account-mode basis-point adjustments
- optional customer-gear adjustment when customer-provided gear is not confirmed
- optional supplies fee
- optional Discord Stream percentage
- configured delivery percentage and fixed fee

The public route never trusts client-submitted prices and does not expose internal rule IDs or arbitrary formulas. Seeded bossing rates are representative defaults only and are marked `Needs client review`, so the public `bossing_calculator_enabled` feature flag is seeded off until client approval.

Task 006 intentionally does not add checkout/order price snapshots, global discount stacking, taxes, payment-provider logic, premium configurators, cart, checkout, orders or the full pricing administration workflow for every engine.

## Task 007 premium estimate preview

Task 007 adds a premium-service-specific preview engine only. It calculates an `Estimated total` from service-scoped premium rules, enabled packages and enabled options, then tells the customer that final price is confirmed before checkout.

Inputs handled by the premium preview:

- package base cents, minimum cents and setup fee
- account-mode basis-point adjustments
- customer gear adjustment when gear confirmation is required but not confirmed
- fixed-fee, percentage-of-current-subtotal and per-unit options
- optional Discord Stream percentage
- configured delivery percentage and fixed fee

The public route never trusts client-submitted prices and does not expose internal rule IDs, client-review state or arbitrary formulas. Seeded premium rates are representative defaults only and are marked `Needs client review`, so the public `premium_configurator_enabled` feature flag is seeded off until client approval.

Task 007 intentionally does not add checkout/order price snapshots, quote creation, cart items, global discount stacking, taxes, payment-provider logic or the full pricing administration workflow for every engine.

## Task 008 global pricing foundation

Task 008 adds a global pricing layer above the existing skilling, bossing and premium preview engines. Service engines still calculate the base subtotal first; the global layer can then apply a published pricing revision when `global_pricing_enabled` is enabled.

The global pricing feature flag is seeded disabled. With the flag off, Task 005-007 estimate behavior and response totals remain unchanged.

Published revision snapshots use schema version `1` and include immutable rule data only. Public estimate responses include a `priceSnapshot` only when global pricing is enabled and a published revision is loaded. Route snapshots store selected service/configuration references but intentionally do not store RSN values or manual stat entries.

Supported rule types:

- `FIXED_ADDITION`
- `PERCENTAGE_ADDITION`
- `MINIMUM_TOTAL`
- `MAXIMUM_TOTAL`

Supported applicability scopes:

- `GLOBAL`
- `ENGINE_TYPE`
- `CATEGORY`
- `SERVICE`

Rule selection:

1. Only enabled rules inside their effective date window are considered.
2. Applicability must match the estimate source.
3. Rules sort by priority ascending, then specificity descending (`SERVICE`, `CATEGORY`, `ENGINE_TYPE`, `GLOBAL`), then stable rule id.
4. Rules sharing an `exclusiveGroupKey` collapse to the first selected rule by the same sort order.

Calculation order:

1. Service engine base subtotal.
2. Fixed global additions.
3. Percentage global additions, rounded half up to whole cents.
4. Minimum total adjustments.
5. Maximum total adjustments.

Admin routes under `/admin/pricing` require `pricing.view` for read access, `pricing.edit` for draft rule edits and `pricing.publish` for publish, discard and restore actions. Draft edits use optimistic `draftVersion` checks; published `PricingRevision` rows are immutable snapshots.

## Task 009 gold estimate pricing

Task 009 adds a gold-specific rate engine. Gold rates are stored as integer minor units per 1,000,000 GP and quantities are whole-GP `BigInt` values. The base calculation is:

`(rateMinorUnitsPerMillion * quantityGp + 500000) / 1000000`

The integer `500000` offset gives half-up rounding to whole minor units without floating-point arithmetic.

Customer-buy estimates represent a customer charge. After the gold subtotal and optional Secure 100+ Combat Service line are calculated, the server may pass the subtotal through Task 008 global pricing when `global_pricing_enabled` is enabled and a published pricing revision is available.

Customer-sell estimates represent a payout to the customer. They intentionally do not receive ordinary customer-charge global additions or minimum/maximum customer-charge rules. Future checkout/order work must recalculate gold estimates server-side from the current published gold revision instead of trusting old snapshots.

## Task 010 account listing pricing

Task 010 adds account listing estimates for `ACCOUNT_MARKETPLACE`. Listing prices are stored as integer USD cents on `AccountListing`; the browser may identify a listing by slug or ID but never supplies an accepted price, total, availability state, approval state, revision or global adjustment.

The base public line is always `Account listing base price`. When `global_pricing_enabled` is enabled and a published pricing revision applies to `ACCOUNT_MARKETPLACE`, the server appends customer-safe global adjustment lines and records the published global-pricing revision reference in `AccountListingSnapshotV1`.

Estimates require an approved, published listing with a published revision and `availability=AVAILABLE`. Held, sold, paused and unavailable listings reject estimates with customer-safe messages. Future cart/checkout work must reload the listing, recalculate from the current server state, and recheck availability before any order can exist.

## Task 011 custom account-build pricing

Task 011 adds custom account-build estimates for `CUSTOM_ACCOUNT_BUILD`. The browser supplies only service slug, game mode, selected skill targets, selected objective references and customer-confirmed completion state. It never supplies currency, rule prices, objective prices, global-pricing lines, estimate state or totals.

Skill rules support per-XP, per-level-band, fixed target package, fixed addition and manual-review-only modes. XP pricing uses integer minor units per 1,000,000 XP and deterministic half-up rounding:

`(xpRequired * centsPerMillionXp + 500000) / 1000000`

Objective rules support fixed additions, fixed target packages, percentage adjustments where configured, and manual-review-only behavior. Missing, disabled, incompatible or manual-only objectives produce customer-safe review reasons instead of false automatic eligibility.

`CustomBuildEstimateSnapshotV1` stores public selections, priced lines, manual-review reasons, published custom-build revision reference, optional published global-pricing revision reference, generated/valid-until timestamps and review/repricing flags. It excludes display name, email, Discord username, RSN, customer notes, attachments, raw tokens, internal notes and admin identities.

Task 008 global pricing may apply only after the custom-build engine calculates an automatic or partial priced subtotal. Manual-review-only estimates keep totals null and do not receive invented global additions. Quote revisions are manually authoritative snapshots and do not auto-change when custom-build or global-pricing rules change later.

## Initial prices

- Existing WooCommerce prices are migration input.
- Firstseller prices may be used as dated seed references where the current catalogue lacks a value.
- All seed prices require client review before launch.

## Default game-mode adjustments

- Normal: +0%
- Iron: +10%
- HCIM: +20%
- UIM: +30%

Allow per-service overrides.

## Add-ons

### Discord Stream

Optional private Discord stream. Default +2%, editable and enabled only for applicable services.

### Secure 100+ Combat Service

Optional. Default +10%, editable and enabled only for applicable services.

### Delivery

- Standard: enabled, default +0%
- Priority: created but disabled until configured
- Express: created but disabled until configured

Each delivery option stores its label, description, fee rule, estimated time, and availability.

## Calculation order

1. Base price
2. Variant or method calculation
3. Account-mode adjustment
4. Service-specific options
5. Secure 100+ Combat fee
6. Discord Stream fee
7. Delivery fee
8. Task 008 global pricing additions, minimums and maximums when enabled and applicable
9. Task 010 account listing base-price and applicable global-pricing lines, for account marketplace estimates only
10. Task 011 custom account-build priced subtotal and applicable global-pricing lines, for automatic or partial custom-build estimates only
11. Discounts according to stacking rules
12. Taxes if later applicable
13. Final total

## Admin requirements

Support fixed or percentage rules, effective dates, drafts, publishing, preview, version history, restore, category applicability, minimum and maximum values, and discount stacking controls.

# Reusable Service Engines

The application must use reusable engines instead of hardcoding every page separately.

## Catalogue Card Engine

Used for Quests, Diaries, Combat Achievements, Minigames, Gathering, Miscellaneous, and selected boss listings. Task 004 implements normalized offerings, server-backed partial search, facets derived from active published offerings, game-mode filtering, stable pagination, requirement dialogs, eligibility, and bounded quantity metadata. An offering with no game-mode rows inherits every parent mode; explicit offering modes may only narrow the parent set.

Pricing, cart actions, checkout, inventory and capacity reservation remain deferred. Public cards use request/review calls to action only.

## Skilling Calculator Engine

Task 005 implements `SKILLING_CALCULATOR` for the published Skill training request service and for future service-specific skilling calculators.

The public engine supports:

- skill selection from enabled service-scoped skills
- current and target level mode
- current and target XP mode
- exact OSRS level 1-99 XP conversion
- account game mode
- enabled training methods scoped to the selected skill
- optional supplies/material support when configured on the method
- optional Discord Stream add-on when configured on the service rule
- configured delivery speed choices
- a server-authoritative estimated total and clear final-price disclaimer

Normal seed runs keep the public skilling calculator feature flag disabled until the client reviews the representative skilling rates. Standard delivery is enabled by default, while Priority and Express are present for admin configuration but disabled until approved.

The admin engine supports service-scoped skilling rules, skill enable/order updates, method create/edit, method range/rate fields, client-review markers, staged preview, optimistic concurrency, audit logging and Task 003 publication staging. Published skilling edits stay private until republish; public pages keep using the last published rules. Older staged snapshots without skilling data upgrade safely with `skilling: null`.

This engine does not create carts, checkout sessions, orders, payment records, quote records, global discounts or global price history. Estimate values are preview-only and remain scoped to skilling services.

## Bossing Engine

Task 006 implements the existing `BOSSING_ENGINE` enum value as the reusable bossing/PvM calculator engine. It is equivalent to the planned bossing calculator name while preserving the repository's current enum style.

The public engine supports:

- enabled boss selection from service-scoped boss configs
- enabled method/package selection scoped to the selected boss
- direct kill quantity mode
- current KC to target KC mode
- account game mode
- automatic public-stat requirement display for allow-listed combat/total stats
- customer/support gear requirement display without inferring bank or inventory contents
- optional customer-provided gear confirmation when configured
- optional supplies/material support when configured on the method
- optional Discord Stream add-on when configured on the service rule
- configured delivery speed choices
- a server-authoritative estimated total and clear final-price disclaimer

Normal seed runs keep the public bossing calculator feature flag disabled until the client reviews the representative boss/method rates. Standard delivery is enabled by default, while Priority and Express are present for admin configuration but disabled until approved.

The admin engine supports service-scoped bossing rules, boss create/edit/order/enable fields, method create/edit, kill-count ranges, price fields, stat and gear requirement text configuration, client-review markers, staged preview, optimistic concurrency, audit logging and Task 003 publication staging. Published bossing edits stay private until republish; public pages keep using the last published rules. Older staged snapshots without bossing data upgrade safely with `bossing: null`.

This engine does not create carts, checkout sessions, orders, payment records, quote records, global discounts or global price history. Estimate values are preview-only and remain scoped to bossing services.

## Premium Service Configurator

Task 007 implements `PREMIUM_SERVICE_CONFIGURATOR` for high-value configured services such as Fire Cape, Infernal Cape, Colosseum, Yama, Royal Titans, Corrupted Gauntlet, Doom of Mokhaiotl, and Raids.

The public engine supports:

- enabled package selection from service-scoped premium packages
- account game mode
- optional RSN public-stat checks for allow-listed stats
- manual/no-RSN operation
- public-stat, customer-confirmed and support-verified requirement summaries
- customer gear/unlock confirmation without inferring bank, inventory, quest or diary state
- optional service-scoped add-ons with fixed, percentage or per-unit pricing
- optional Discord Stream add-on when configured on the service rule
- configured delivery speed choices
- FAQ display
- a server-authoritative estimated total and clear final-price disclaimer

Normal seed runs keep the public premium configurator feature flag disabled until the client reviews the representative premium package prices and rules. Standard delivery is enabled by default, while Priority and Express are present for admin configuration but disabled until approved.

The admin engine supports service-scoped premium rules, package create/edit, option create/edit, package requirement groups, package FAQs, client-review markers, staged preview, optimistic concurrency, audit logging and Task 003 publication staging. Published premium edits stay private until republish; public pages keep using the last published rules. Older staged snapshots without premium data upgrade safely with `premium: null`.

This engine does not create carts, checkout sessions, orders, payment records, quote records, fake reviews, global discounts or global price history. Estimate values are preview-only and remain scoped to premium services.

## Global Pricing Layer

Task 008 adds global pricing as a shared layer above the skilling, bossing and premium preview engines. Each engine still owns its service-specific subtotal, line items and validation. When `global_pricing_enabled` is enabled, the public estimate route passes that server-calculated subtotal into the latest published pricing revision and appends global adjustment lines to the response.

Global pricing supports fixed additions, percentage additions, minimum totals and maximum totals scoped globally, by engine type, by category or by service. Draft rules are managed at `/admin/pricing`; public estimates only use published `PricingRevision` snapshots. Cart, checkout, quote, order and payment flows remain deferred.

## Gold Engine

Task 009 implements `GOLD_ENGINE` for buy/sell gold trading estimates. The public engine supports Buy Gold and Sell Gold tabs, admin-configured quantity presets, custom million-GP quantities, RSN collection, active published rates, minimum/maximum limits, automatic/manual-review thresholds, safe availability states, trade instructions, and optional Secure 100+ Combat Service.

Gold quantities are parsed on the server into whole-GP `BigInt` values and serialized as decimal strings. Rates are integer minor units per 1,000,000 GP and use deterministic half-up rounding to whole minor units. Public estimates use only the latest published gold-rate revision; draft edits stay private until published.

The admin engine supports `/admin/gold`, market settings, draft buy/sell rate editing, presets, inventory and buying-capacity adjustment, append-only ledger history, revision history, restore-to-draft, optimistic concurrency, permissions and audit logs. Estimates never reserve or deduct inventory and do not create cart, checkout, quote, order or payment records.

## Account Marketplace Engine

Supports prebuilt account listings, filters, stats, unlocks, images, availability, reservation, approval, and secure handover.

## Custom Account Build Engine

Supports desired stats, quests, diaries, unlocks, notes, uploads, estimate or quote request, and quote conversion.

## Product Marketplace Engine

Used for Items, Bonds, and Outfits. Supports stock, quantity, price, search, filters, card layouts, and inventory reservation.

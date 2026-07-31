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

Task 010 implements `ACCOUNT_MARKETPLACE` for prebuilt account listing browsing and support-review estimates. The public entry points are `/accounts`, `/accounts/[listingSlug]`, `GET /api/accounts`, `GET /api/accounts/[listingSlug]`, and `POST /api/accounts/estimate`.

Public listing visibility requires `approvalStatus=APPROVED`, `publicationStatus=PUBLISHED`, an immutable published listing revision, an available marketplace, and `account_marketplace_enabled=true`. Draft edits remain private. Operational availability is mutable separately from published content so held, sold, paused and unavailable states can be reflected without rewriting revision history.

The engine supports server-side search, filters, sorting, pagination, public game modes, stats, unlocks, feature tags and image galleries. Estimate responses use the server-stored integer-cent listing price and may append Task 008 global-pricing lines when `global_pricing_enabled` is enabled. No public endpoint creates holds, reservations, orders, payments or customer records.

The admin engine supports `/admin/accounts`, listing creation/editing, stats, unlocks, features, media, approval/rejection, publish/discard/restore, availability, temporary holds, sold/reopen actions, secure-handover readiness and revision history. Secure handover stores booleans/statuses only and never stores credentials.

## Custom Account Build Engine

Task 011 implements `CUSTOM_ACCOUNT_BUILD` for custom account-build estimates, persistent requests and versioned quotes. Public entry points are `/custom-account-build`, `/custom-account-build/track/[token]`, `POST /api/custom-build/estimate`, `POST /api/custom-build/requests`, `POST /api/custom-build/requests/[requestId]/attachments`, and `POST /api/custom-build/quotes/[quoteId]/decision`.

The public engine supports desired/current/target stats, current/target XP, explicit fresh-account mode, unknown-current manual-review mode, quests, achievement diaries, unlocks, customer-confirmed completion state, private plain-text requirements notes and quarantined private attachments. Estimates are server-authoritative and return `AUTOMATIC`, `PARTIAL`, `MANUAL_REVIEW_REQUIRED` or `UNAVAILABLE`.

Skill and objective pricing is managed through draft custom-build rule sets and immutable published revisions. Public estimates load only the latest published custom-build revision. Draft edits remain private until publish; restore creates a new draft and never rewrites old revisions. Custom-build subtotals may receive Task 008 global-pricing adjustments only for automatic or partial customer-charge estimates when `global_pricing_enabled` is enabled.

Persistent requests store minimum contact details, consent timestamp/version, selected skills/objectives, customer notes, estimate snapshot, status history and a SHA-256 tracking-token hash. The raw tracking token is shown once and is never logged or stored. Tracking pages use no-store and noindex behavior and show only customer-safe status and sent quote information.

Admin routes under `/admin/custom-builds` support overview, configuration, skill/objective rules, preview, publish/discard/restore, request review, status transitions, attachment metadata review/download, quote revision creation, quote sending, quote voiding and quote history. Permissions are split across `custom_builds.view`, `custom_builds.edit`, `custom_builds.publish`, `custom_builds.requests.review`, `custom_builds.attachments.review` and `custom_builds.quotes.manage`.

This engine never collects account credentials and never creates cart, checkout, order, order item, payment, customer account, project delivery or account credential handover records. Accepted quotes remain accepted quotes only.

## Product Marketplace Engine

Task 012 implements `PRODUCT_MARKETPLACE` for items, bonds and outfits. Public entry points are `/products`, `/products/[productSlug]`, `GET /api/products`, `GET /api/products/[productSlug]`, and `POST /api/products/estimate`.

The public engine supports server-backed search, product-type/category/tag/price/availability/in-stock/featured filters, stable sorting, bounded pagination, product cards, detail galleries, variant selection, quantity validation and preview-only estimates. Public product content comes from immutable published product revisions; draft edits and archived products stay private.

Price modes are fixed unit, quantity tier, fixed package and manual review. Product subtotals are calculated from server-stored integer-cent prices and validated integer quantities. Quantity-tier resolution is deterministic and overlapping published tiers fail safely. Manual-review estimates keep totals null instead of displaying a zero price.

Variant stock supports tracked, unlimited and manual-review modes. Tracked availability is calculated from on-hand quantity minus active unexpired reservations, but public responses expose only customer-safe stock states. Estimates never reserve or deduct inventory.

The admin engine supports `/admin/products`, categories, product drafts, variants, quantity tiers, media, draft preview, publish/discard/restore, inventory adjustments, append-only ledger history, internal reservation creation/release/expiry and revision history. Permissions are split across `products.view`, `products.edit`, `products.publish`, `products.inventory.adjust`, `products.reservations.manage` and `products.media.manage`.

This engine does not create carts, checkout sessions, customer records, orders, order items, payments, public reservations, shipping or automatic delivery.

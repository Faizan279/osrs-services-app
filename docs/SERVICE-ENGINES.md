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

Supports boss, kill count, current KC, account mode, stats, gear or method, requirements, add-ons, and delivery speed.

## Premium Service Configurator

Used for Fire Cape, Infernal Cape, Colosseum, Yama, Royal Titans, Corrupted Gauntlet, Doom of Mokhaiotl, and Raids. Includes RSN lookup, stats, gear, package selection, live estimate, requirements, FAQs, reviews, and order summary.

## Gold Engine

Supports buy and sell rates, quantity presets, custom quantity, limits, RSN, trade instructions, manual review, stock tracking, and optional Secure 100+ Combat Service.

## Account Marketplace Engine

Supports prebuilt account listings, filters, stats, unlocks, images, availability, reservation, approval, and secure handover.

## Custom Account Build Engine

Supports desired stats, quests, diaries, unlocks, notes, uploads, estimate or quote request, and quote conversion.

## Product Marketplace Engine

Used for Items, Bonds, and Outfits. Supports stock, quantity, price, search, filters, card layouts, and inventory reservation.

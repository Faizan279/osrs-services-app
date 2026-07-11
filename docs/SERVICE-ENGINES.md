# Reusable Service Engines

The application must use reusable engines instead of hardcoding every page separately.

## Catalogue Card Engine

Used for Quests, Diaries, Combat Achievements, Minigames, Gathering, Miscellaneous, and selected boss listings. Task 004 implements normalized offerings, server-backed partial search, facets derived from active published offerings, game-mode filtering, stable pagination, requirement dialogs, eligibility, and bounded quantity metadata. An offering with no game-mode rows inherits every parent mode; explicit offering modes may only narrow the parent set.

Pricing, cart actions, checkout, inventory and capacity reservation remain deferred. Public cards use request/review calls to action only.

## Skilling Calculator Engine

Supports skill, current and target level or XP, account mode, training method, supplies, Discord Stream, and delivery speed.

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

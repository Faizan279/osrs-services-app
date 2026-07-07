# CODEX TASK 004 — Catalogue Card Engine and RSN Eligibility Checker

## Objective

Make `CATALOGUE_CARD` functional with reusable database-backed offerings, normalized filters, requirements, a server-only public-stat provider, and safe eligibility evaluation while preserving Task 003 publication staging and optimistic concurrency.

## Included

- Stable offerings, parent-scoped slugs, facets, effective game modes, quantity metadata, ordering, featured/active state, and client-review state
- Service and offering requirements with automatic, customer-confirmed, and support-verified modes
- Allow-listed metrics, typed comparisons, prerequisite recommendations, and cycle rejection
- Server-backed search, filters, pagination, accessible dialogs, responsive cards, and protected offering administration
- Official OSRS Hiscores provider abstraction, shared RSN normalization, deterministic test fixtures, database cache, and database rate limiting
- Versioned staging, atomic republish, immutable revisions, stale-editor protection, audit events, and non-destructive seeds/feature flags

## Security and privacy

Lookups use strict size-limited POST bodies. No password field or general-purpose proxy exists. Cache and limiter identifiers are HMAC-derived; public projections exclude internal state and raw provider/cache data.

## Explicit exclusions

No final prices, pricing formulas, cart, checkout, payment, orders, quotes, reservation, inventory, marketplaces, customer dashboard, reviews, chat, full import, deployment, or Task 005 work.

## Delivery boundary

Work only on `codex/task-004-catalogue-engine-eligibility`, commit locally, create the review pack, and stop. Do not push, open a pull request, merge, deploy, or begin Task 005.

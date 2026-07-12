# CODEX TASK 006 - Bossing / PvM Calculator Engine

## Objective

Make the existing `BOSSING_ENGINE` enum value functional as the reusable bossing/PvM calculator engine with domain models, server-authoritative estimate previews, public calculator UI, admin bossing management, publication staging, revisions, audit events, seeds, tests and screenshots.

## Included

- Additive Prisma models for bossing calculator rules, boss configs, methods, stat requirements and gear requirements.
- Kill-count validation for direct quantity and current KC to target KC modes.
- Public calculator for boss, method/package, kill count, account mode, customer gear confirmation, supplies, Discord Stream and delivery speed.
- `POST /api/bossing/estimate` with Zod validation, no-store responses and server-side published rule lookup.
- Optional RSN eligibility reuse for allow-listed public combat/total stats only.
- Admin bossing overview, boss create/edit forms, method create/edit forms, staged preview and protected mutations.
- Task 003 staged aggregate compatibility for published bossing service edits, including republish, discard, revisions and optimistic concurrency.
- `bossing_calculator_enabled` feature flag.
- Representative seed data for the PvM support service, with all seeded pricing/rules marked as needing client review.
- Unit, route, seed, MySQL and Playwright coverage.

## Security and pricing boundaries

The calculator is an estimate preview only. The client cannot submit prices, formulas or rule IDs. The server calculates from published catalogue data and returns safe, JSON-compatible summaries. Cart, checkout, orders, payment records, premium configurators, global discounts, taxes and order price snapshots remain later work.

RSN lookup is optional and limited to public stat checks. Boss KC ownership, gear ownership, quests, diaries, membership, account ownership, inventory and bank contents are never inferred. The UI never asks for a RuneScape password and RSNs are not placed in URLs.

## Explicit exclusions

No premium configurators, Fire Cape configurator, Infernal Cape configurator, Colosseum configurator, raids configurator, full global pricing engine, cart, checkout, payment processing, order creation, quote creation, customer dashboard, marketplaces, inventory reservation, capacity reservation, reviews, live chat, deployment or Task 007 work.

## Delivery boundary

Work only on `codex/task-006-bossing-pvm-engine`, commit locally, create the review pack and stop. Do not push, open a pull request, merge, deploy or begin Task 007.

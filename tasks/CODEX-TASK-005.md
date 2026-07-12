# CODEX TASK 005 - Skilling Calculator Engine

## Objective

Make `SKILLING_CALCULATOR` functional with a reusable skilling domain model, exact OSRS XP table utilities, server-authoritative estimate previews, public calculator UI, admin skilling management, publication staging, revisions, audit events, seeds, tests and screenshots.

## Included

- Additive Prisma models for skilling skills, training methods and calculator rules.
- Exact level 1-99 OSRS XP thresholds with level and XP validation.
- Public calculator for skill, method, level/XP input mode, account mode, supplies, Discord Stream and delivery speed.
- `POST /api/skilling/estimate` with Zod validation, no-store responses and server-side published rule lookup.
- Admin skilling overview, method create/edit forms, staged preview and protected mutations.
- Task 003 staged aggregate compatibility for published skilling service edits, including republish, discard, revisions and optimistic concurrency.
- `skilling_calculator_enabled` feature flag.
- Representative seed data for the Skill training request service, with all seeded pricing/rules marked as needing client review.
- Unit, route, seed, MySQL and Playwright coverage.

## Security and pricing boundaries

The calculator is an estimate preview only. The client cannot submit prices, formulas or rule IDs. The server calculates from published catalogue data and returns safe, JSON-compatible summaries. Cart, checkout, orders, payment records, global discounts, taxes and order price snapshots remain later work.

## Explicit exclusions

No bossing calculator, premium configurator, full global pricing engine, cart, checkout, payment processing, order creation, quote creation, customer dashboard, marketplaces, inventory reservation, capacity reservation, reviews, live chat, deployment or Task 006 work.

## Delivery boundary

Work only on `codex/task-005-skilling-calculator-engine`, commit locally, create the review pack and stop. Do not push, open a pull request, merge, deploy or begin Task 006.

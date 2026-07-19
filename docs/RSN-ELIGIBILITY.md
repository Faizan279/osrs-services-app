# RSN Eligibility Checker

## Goal

Allow a guest or customer to enter an RSN and compare public account statistics with a service's requirements.

## Flow

1. Enter RSN.
2. Fetch public OSRS statistics.
3. Cache the response briefly.
4. Compare public numeric requirements.
5. Show Met, Not met, Customer confirmation required, or Support verification required.
6. Recommend prerequisite services where appropriate.

## Automatically verifiable examples

- Public skill levels
- Total level and XP
- Bossing calculator public stat requirements from the allow-listed combat and total-level metrics
- Premium configurator public stat requirements from the allow-listed combat and total-level metrics

## Not reliably verifiable from RSN alone

- Completed quests
- Diary completion
- Inventory or bank contents
- Exact gear
- Untradeables
- Membership
- Account ownership
- Some unlocks

Each requirement stores its type, label, required value, comparison operator, verification method, customer guidance, optional recommended service, and admin notes.

Never request a RuneScape password for eligibility lookup.

## Task 004 implementation

- Browser requests use a strict, size-limited POST body; RSNs never appear in catalogue query parameters.
- `RsnStatsProvider` isolates the fixed official Hiscores request and parser from the evaluator.
- The provider enforces an explicit timeout, 64 KiB response cap, no redirects, numeric validation, and safe not-found/unavailable errors.
- Automatic rules select from the allow-listed `total.*` and `skill.<name>.(level|xp)` registry. Missing metrics require support review and are never zero-filled.
- Successful profiles cache for `RSN_CACHE_TTL_SECONDS`; not-found responses use `RSN_NEGATIVE_CACHE_TTL_SECONDS`.
- Cache and limiter keys use HMAC-SHA256 with `ELIGIBILITY_HMAC_SECRET`, falling back to `AUTH_SECRET` only when a separate secret is absent.
- The database rate limiter uses `RSN_RATE_LIMIT_WINDOW_SECONDS` and `RSN_RATE_LIMIT_COUNT`. Raw IPs are not stored. `X-Real-IP` is used only with explicit trusted-proxy configuration.
- `RSN_DEVELOPMENT_FIXTURE=true` explicitly selects a synthetic provider for local production-build E2E and screenshots. It must never be enabled on a deployed environment. Normal tests never call the live provider.
- `rsn_eligibility_enabled` is seeded disabled and preserved on rerun.

## Task 006 bossing usage

The bossing calculator may optionally reuse the RSN eligibility flow for public stat requirements only: Attack, Strength, Defence, Ranged, Prayer, Magic, Hitpoints and Total level. The calculator still works without an RSN.

Bossing does not infer boss KC ownership, gear ownership, inventory, bank contents, quests, diaries, account ownership or membership from RSN lookup. Gear and manual requirements remain customer-confirmed or support-verified. The public UI never asks for a RuneScape password and the estimate route uses POST bodies so RSNs are not placed in URLs.

## Task 007 premium usage

The premium configurator may optionally reuse the RSN eligibility flow for public stat requirements only: Attack, Strength, Defence, Ranged, Prayer, Magic, Hitpoints and Total level. The configurator still works without an RSN.

Premium does not infer gear ownership, inventory, bank contents, quest completion, diary completion, membership, account ownership, untradeables or unlocks from RSN lookup. Gear/unlock requirements remain customer-confirmed or support-verified. The public UI never asks for a RuneScape password and the estimate route uses POST bodies so RSNs are not placed in URLs.

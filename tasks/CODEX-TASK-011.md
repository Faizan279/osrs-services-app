# CODEX TASK 011 - Custom Account Build and Quote Request Engine

## Starting State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-011`
- Branch: `codex/task-011-custom-account-build`
- Task 010 merge commit: `b20b5c58674681bee989e4363d2d47d2c0fe7d0b`
- Starting main SHA: `b20b5c58674681bee989e4363d2d47d2c0fe7d0b`
- Previous task worktrees and backups were not deleted.
- No local MySQL or Docker installation was used.
- No push, PR, merge, deployment or Task 012 work is part of this task.

## Objective

Implement the reusable `CUSTOM_ACCOUNT_BUILD` engine for desired account statistics, quests, achievement diaries, unlocks, private requirements notes, safe private attachments, server-authoritative estimates, persistent requests, admin request review and versioned quote acceptance/decline.

## Delivered Scope

- Additive Prisma migration `20260728150000_task011_custom_account_build`.
- Custom-build models and enums for service config, draft/published rules, objectives, requests, attachments, quotes, revisions, quote lines and customer decisions.
- Public `/custom-account-build` configurator and `/custom-account-build/track/[token]` secure tracking route.
- Public APIs for estimates, request submission, private attachment upload and quote decisions.
- Server-authoritative estimate states: `AUTOMATIC`, `PARTIAL`, `MANUAL_REVIEW_REQUIRED`, `UNAVAILABLE`.
- JSON-safe estimate and quote snapshots with unknown-version rejection.
- Task 008 global-pricing integration for automatic or partial custom-build customer-charge estimates.
- Persistent request workflow with hashed tracking tokens, consent timestamp/version, idempotency protection, rate limiting and append-only status history.
- Private attachment validation for PNG, JPEG, WebP and PDF, with random storage filenames, SHA-256 metadata, quarantine/scan status and admin-only download.
- Admin Custom Builds Centre at `/admin/custom-builds` with configuration, rules, objectives, requests, attachments, quotes, revisions and preview routes.
- Permissions: `custom_builds.view`, `custom_builds.edit`, `custom_builds.publish`, `custom_builds.requests.review`, `custom_builds.attachments.review`, `custom_builds.quotes.manage`.
- Feature flag: `custom_account_build_enabled`, seeded disabled.
- Non-destructive custom-build seeds with representative rules/objectives and no customer data.
- Unit, seed, E2E, GitHub Actions, screenshot and review-pack scaffolding.

## Explicitly Excluded

Task 011 does not implement cart, checkout, guest checkout, orders, order items, payments, payment providers, quote-to-order conversion, work assignment, project delivery, customer dashboard, customer account creation, account login credential collection or credential handover.

An accepted quote remains an accepted quote only.

## Security and Privacy

- No RuneScape login email, login username, password, email password, bank PIN, recovery answer, authenticator material, browser cookie, session token or previous-owner personal data is collected, stored, logged, displayed or serialized.
- Contact fields are limited to display name, email, optional Discord username and optional RSN/public character name.
- Tracking URLs contain only the raw token; the database stores only the SHA-256 hash.
- Estimate and quote snapshots exclude contact details, RSN, customer notes, attachments, storage paths, raw tokens, internal notes and admin identities.
- Attachment bytes are stored outside public assets and are not included in review-pack artifacts.

## Validation Strategy

Local validation covers non-database checks. MySQL-backed migration, seed, upgrade, E2E and screenshot validation is configured in `.github/workflows/task011-validation.yml` with temporary MySQL 8.4 service containers and CI-only credentials.

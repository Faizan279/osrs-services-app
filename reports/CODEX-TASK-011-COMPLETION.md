# CODEX TASK 011 Completion Report

## Repository State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-011`
- Branch: `codex/task-011-custom-account-build`
- Task 010 merge commit: `b20b5c58674681bee989e4363d2d47d2c0fe7d0b`
- Starting main SHA: `b20b5c58674681bee989e4363d2d47d2c0fe7d0b`
- Implementation commit: finalized by the local Task 011 commit after this report is staged; the exact hash is reported in the final handoff.
- Final local HEAD: finalized by the local Task 011 commit after this report is staged; the exact hash is reported in the final handoff.

## Migration

- Added migration: `20260728150000_task011_custom_account_build`
- Migration type: additive
- Rollback: manual only. Disable `custom_account_build_enabled`, export custom-build requests, attachment metadata, quote revisions, customer decisions, admin-edited rules and audit rows that must be retained, then remove dependent custom-build records in reverse dependency order after review. Do not use `prisma migrate reset` on shared or production data.

## Models and Enums Added

- Enums: `CustomBuildPublicationStatus`, `CustomBuildRequestStatus`, `CustomBuildEstimateState`, `CustomBuildObjectiveType`, `CustomBuildPricingMode`, `CustomBuildQuoteStatus`, `CustomBuildAttachmentStatus`, `CustomBuildAttachmentScanStatus`, `CustomBuildCustomerDecision`, `CustomBuildSkillValueMode`
- Models: `CustomBuildService`, `CustomBuildRuleSet`, `CustomBuildSkillRule`, `CustomBuildObjective`, `CustomBuildObjectiveRule`, `CustomBuildRevision`, `CustomBuildRequest`, `CustomBuildRequestSkill`, `CustomBuildRequestObjective`, `CustomBuildRequestStatusEvent`, `CustomBuildAttachment`, `CustomBuildQuote`, `CustomBuildQuoteRevision`, `CustomBuildQuoteLine`, `CustomBuildQuoteDecision`

## Public Routes and APIs

- `/custom-account-build`
- `/custom-account-build/track/[token]`
- `POST /api/custom-build/estimate`
- `POST /api/custom-build/requests`
- `POST /api/custom-build/requests/[requestId]/attachments`
- `POST /api/custom-build/quotes/[quoteId]/decision`
- `GET /api/admin/custom-build/attachments/[attachmentId]` for permission-protected admin downloads

## Admin Routes

- `/admin/custom-builds`
- `/admin/custom-builds/config`
- `/admin/custom-builds/rules`
- `/admin/custom-builds/objectives`
- `/admin/custom-builds/requests`
- `/admin/custom-builds/requests/[requestId]`
- `/admin/custom-builds/requests/[requestId]/attachments`
- `/admin/custom-builds/requests/[requestId]/quote`
- `/admin/custom-builds/requests/[requestId]/history`
- `/admin/custom-builds/revisions`
- `/admin/custom-builds/preview`

## Feature Flag and Permissions

- Feature flag: `custom_account_build_enabled`, seeded `false`
- Permissions: `custom_builds.view`, `custom_builds.edit`, `custom_builds.publish`, `custom_builds.requests.review`, `custom_builds.attachments.review`, `custom_builds.quotes.manage`
- Super Admin receives all custom-build permissions through the default all-permission role assignment.
- Support Agent receives `custom_builds.view` and `custom_builds.requests.review` only by default.

## Configuration and Publication

Draft skill/objective rules remain private until an authorized publish action creates an immutable `CustomBuildRevision` snapshot. Restore copies a historical revision into the draft and never rewrites historical revisions. Discard restores the draft from the latest published revision. Optimistic concurrency protects service configuration, rules, publication, restore and discard.

## Estimate Engine

The engine supports current/target level, current/target XP, explicit fresh-account mode and unknown-current mode. Pricing modes include per-XP, per-level-band, fixed target package, fixed addition and manual review only. XP pricing uses integer minor units and deterministic half-up rounding. Estimate states are `AUTOMATIC`, `PARTIAL`, `MANUAL_REVIEW_REQUIRED` and `UNAVAILABLE`.

`CustomBuildEstimateSnapshotV1` stores public selections, server-generated lines, manual-review reasons, published custom-build revision reference, optional global-pricing revision reference, generated/valid-until timestamps and review/repricing flags. It excludes display name, email, Discord username, RSN, customer notes, attachments, IP/session data, raw tokens, internal notes and admin identities. Unknown snapshot versions fail safely.

Global pricing applies only after the custom-build subtotal is calculated and only for automatic or partial estimates. Manual-review-only estimates keep totals null and do not receive invented global additions. Quote revisions are manually authoritative and do not change after being sent.

## Request Workflow

Submitted requests store selected skills/objectives, estimate snapshot, private contact fields, private plain-text notes, consent timestamp/version, status, status events, idempotency hash and hashed tracking token. Request intake is blocked when `custom_account_build_enabled=false` or the service is unavailable. No customer user, cart, checkout, order or payment is created.

## Tracking and Attachments

Tracking tokens are high entropy, stored only as SHA-256 hashes and shown once in the confirmation URL. Tracking pages use no-store/noindex behavior and expose only customer-safe status and sent quote data.

Attachments accept PNG, JPEG, WebP and PDF only. MIME, extension and magic bytes are checked; SVG/HTML/script-like files, archives, executables, traversal names and public storage roots are rejected. Storage filenames are random, SHA-256 metadata is recorded, scan status starts at `NOT_SCANNED`, and admin downloads require `custom_builds.attachments.review`.

## Quotes

Authorized staff can create quote records and immutable quote revisions with integer-cent line totals, expiry timestamps, customer-safe terms and private internal notes. Sending a quote publishes the current revision to the secure tracking page. Customer acceptance or decline records a `CustomBuildQuoteDecision`, updates quote/request status and creates safe audit/status events. Expired, draft, void or superseded revisions cannot be accepted.

## Seed Behaviour

Seeds add a Custom Account Builds category, `custom-account-build` catalogue service, one custom-build service config, representative skill rules, representative quest/diary/unlock objectives, one draft rule set, one neutral published revision and `custom_account_build_enabled=false`. Seed reruns preserve users, password hashes, sessions, roles, role-permission changes, feature flags, catalogue edits, previous engines, custom-build config edits, revisions, requests, status history, attachments metadata, quote revisions, decisions and audit logs.

## GitHub Validation

Workflow: `.github/workflows/task011-validation.yml`

Jobs:

- `task011-validation`
- `task010-to-task011-upgrade`
- `task011-final-review-pack`

The workflow uses temporary MySQL 8.4 service containers, CI-only credentials and `CUSTOM_BUILD_PRIVATE_ATTACHMENT_ROOT=/tmp/osrs-services-task011-private`.

## Local Validation

- `pnpm exec prisma format`: passed
- `pnpm db:generate`: passed
- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed, 32 files / 183 tests
- `pnpm test:seed`: passed, 1 file / 2 tests
- `pnpm format:check`: passed
- `pnpm build`: passed with local placeholder environment variables
- `git diff --check`: passed

No local MySQL-backed migrations or seeds were run. Database-backed migration, seed, E2E, screenshot and upgrade validation is configured for GitHub Actions temporary MySQL 8.4.

## Screenshots

Expected CI artifacts:

- `artifacts/task-011/public-custom-build-1440.png`
- `artifacts/task-011/public-custom-build-estimate-1440.png`
- `artifacts/task-011/public-custom-build-partial-review-1440.png`
- `artifacts/task-011/public-custom-build-request-confirmation-1440.png`
- `artifacts/task-011/public-custom-build-tracking-1440.png`
- `artifacts/task-011/public-custom-build-mobile-390.png`
- `artifacts/task-011/admin-custom-build-overview-1440.png`
- `artifacts/task-011/admin-custom-build-config-1440.png`
- `artifacts/task-011/admin-custom-build-request-review-1440.png`
- `artifacts/task-011/admin-custom-build-quote-editor-1440.png`

## Known Limitations

- `custom_account_build_enabled` is seeded disabled pending client approval.
- Production attachment activation still requires an approved malware-scanning strategy.
- No quote-to-order conversion, cart, checkout, order, order item, payment, project delivery, customer dashboard, account creation or credential handover is implemented.
- Local database-backed validation was intentionally not run because local MySQL/Docker installation was prohibited for this task.

## Confirmations

- No push was performed.
- No PR was created.
- No merge was performed.
- No deployment was performed.
- No Task 012 work was started.
- No previous task worktrees or backups were deleted.
- No local MySQL or Docker installation was performed.
- No cart, checkout, order, order item, payment or quote-to-order conversion was implemented.

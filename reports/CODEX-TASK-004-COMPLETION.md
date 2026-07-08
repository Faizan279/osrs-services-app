# Task 004 completion report — Catalogue Card Engine and RSN Eligibility Checker

## Branch and baseline

- Repository: `Faizan279/osrs-services-app`
- Branch: `codex/task-004-catalogue-engine-eligibility`
- Starting main commit: `67347c9d84d19b8ee796ef362aa96f05e5b9db65`
- Final correction implementation commit:
  `4d65705128c8fc9fef905e86418c76e225a09001`
- BigInt snapshot blocker correction commit:
  `99ab12685318ff4d2abaf51d7b50552a4fadc002`
- Report and review-pack refresh: documentation-only follow-up commit recorded
  in the final handoff
- Migration: `20260706150000_task004_catalogue_engine_eligibility`
- Final correction migration: `20260707170000_task004_security_integrity_corrections`

## Final correction pass

The final review corrections were applied on top of reviewed head
`617e9566b476eef637ac18edad310be3babaf1b1` and committed as
`4d65705128c8fc9fef905e86418c76e225a09001`.

Security and integrity updates:

- Public RSN rate limiting now uses an opaque random HttpOnly cookie
  (`osrs_public_client`) instead of user-agent/language fallback identity.
- Public rate-limit buckets store only HMAC-derived identity keys; raw cookie
  tokens and raw IP addresses are never persisted.
- `x-real-ip` contributes to rate-limit identity only when
  `RSN_TRUST_PROXY_IP_HEADER=true` and the value passes real IP parsing.
- `RSN_DEVELOPMENT_FIXTURE=true` is rejected for production startup, and the
  provider factory defensively refuses fixture use in production.
- Offering requirement add/delete now verifies offering ownership before draft
  version claims, requirement writes or audit rows.
- Publish/republish now rebuilds and validates the recommendation graph under a
  Serializable Prisma transaction with deterministic CatalogueService row
  locking. It rejects missing targets and direct/transitive cycles before live
  aggregate replacement.
- Public recommendation links render only for currently reachable public
  targets: published service, active category, publishAt passed/null and
  unpublishAt future/null.
- Requirement `requiredValue` fields are now BIGINT in MySQL and are converted
  through safe Number/BigInt boundaries for JSON, snapshots and API responses.
- Staged aggregate validation now reuses requirement-rule constraints and
  rejects malformed staged requirement, offering, facet, slug and quantity data.
- Unsupported public game-mode filters now return zero offerings instead of
  leaking inherited mode-less offerings.
- The eligibility API route now sanitizes unexpected workflow failures across
  feature flag, rate-limit, catalogue lookup, provider lookup and evaluation
  stages with no-store responses.

Validation updates:

- `pnpm db:generate`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 15 files and 84 tests.
- `pnpm lint`: passed.
- `pnpm build` with `RSN_DEVELOPMENT_FIXTURE=false`: passed. The build script
  now uses `next build --webpack` to avoid the known Windows/pnpm/Turbopack
  symlink resolver issue in this workspace.
- Existing MySQL database `task004_existing`: `prisma migrate deploy` applied
  `20260707170000_task004_security_integrity_corrections` without reset, both
  requirement `requiredValue` columns verified as `bigint`, repeated seed ran
  twice successfully, and existing feature/admin settings were preserved.
- Fresh MySQL database `task004_fresh_validation`: full 6-migration chain
  applied, seed completed, service count verified as 6, and both requirement
  `requiredValue` columns verified as `bigint`.
- `pnpm test:e2e` against the built local server: passed, 44 passed and 12
  skipped. RSN UI browser flows skip while the preserved
  `rsn_eligibility_enabled` feature flag is off by default; the eligibility
  route security/error boundary is covered by Vitest.
- Focused real-MySQL recommendation graph E2E passed: temporary services A/B
  publish A->B, reject B->A, and preserve B stage/revision/live edge state.

## BigInt snapshot blocker correction

Final source review found one remaining BIGINT snapshot path after the
security/integrity correction. The correction was committed locally as
`99ab12685318ff4d2abaf51d7b50552a4fadc002`.

Corrections applied:

- `snapshotFromService` now explicitly maps every offering requirement instead
  of passing `offering.requirements` through raw.
- Offering-level `requiredValue` now uses
  `safeRequirementNumber(requirement.requiredValue)`, matching service-level
  requirement normalization.
- Offering requirement snapshots preserve `id`, `title`, `description`,
  `type`, `isRequired`, `displayOrder`, `verificationMode`,
  `customerGuidance`, `metricKey`, `comparisonOperator`,
  `recommendedServiceId` and `seededKey`.
- Revision snapshot serialization now converts raw Prisma `bigint` values to
  JSON-safe numbers before `JSON.stringify` can fail.
- Historical revision rows were not rewritten.

No migration was needed:

- `prisma/schema.prisma` was unchanged by this correction.
- `prisma/migrations/` was unchanged by this correction.
- `git diff --name-only -- prisma/schema.prisma prisma/migrations` returned no
  changed Prisma schema or migration files after the correction.

Additional BigInt safety review:

- Staged JSON snapshots: `snapshotFromService` and staged requirement mutation
  helpers normalize requirement values with `safeRequirementNumber`.
- Revision JSON snapshots: `revisionSnapshot` now converts raw `bigint` values
  before JSON serialization.
- API JSON responses: the eligibility route evaluates requirements through
  `evaluateRequirements`, which normalizes `requiredValue` before returning
  result payloads.
- Public projections: `src/lib/catalogue/queries.ts` serializes service and
  offering requirement values with `safeRequirementNumber`.
- Cache payloads: RSN cache payloads store public stats profiles, not catalogue
  requirement snapshots.

Focused regression coverage added:

- `snapshotFromService` accepts service and offering automatic requirements
  whose `requiredValue` is `2147483648n`.
- The staged aggregate stores those values as the JSON-safe number
  `2147483648`.
- `JSON.stringify` on the staged aggregate does not throw.
- `editableSnapshot` works for a published service with a live offering-level
  automatic requirement stored as `bigint`.
- `revisionSnapshot` does not serialize raw `bigint` values from service or
  offering requirements.
- Existing service-level BIGINT conversion behavior remains covered by the same
  regression fixture and the full unit suite.

Final validation from this correction run:

- `pnpm exec prisma format` — passed.
- `pnpm db:generate` — passed.
- Focused regression: `pnpm exec vitest run src/tests/catalogue-staging.test.ts`
  — passed, 1 file and 13 tests.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — passed, 15 files and 87 tests.
- `pnpm test:seed` — passed, 1 file and 2 tests.
- `pnpm format:check` — passed.
- `pnpm build` with `RSN_DEVELOPMENT_FIXTURE=false` — passed; 9 static pages
  generated and all dynamic routes collected successfully.
- `pnpm test:e2e` initial attempt — blocked before tests by the intentional
  production guard because local `.env` had `RSN_DEVELOPMENT_FIXTURE=true`.
- `pnpm test:e2e` with `RSN_DEVELOPMENT_FIXTURE=false` — web server started and
  Playwright enumerated 56 tests; 22 passed, 22 failed and 12 skipped because
  the configured local MySQL test database at `127.0.0.1:3307` was not
  reachable (`ECONNREFUSED`/pool timeouts).
- Direct TCP check confirmed `127.0.0.1:3307` was not reachable in this
  environment. No Docker, MySQL or MariaDB executable was available to start the
  configured database locally.

Seed safety evidence for this correction:

- No seed implementation files were changed.
- `pnpm test:seed` passed after the correction.
- No Prisma schema or migration files changed, so no migration/reset was
  required for this BigInt snapshot correction.

Task boundary confirmation:

- Task 005 was not started.
- No push, pull request, merge, deployment or redesign work was performed.

Screenshot update:

- Regenerated `artifacts/task-004/public-requirement-dialog-1440.png`.
- Verified dimensions: 1440 x 1000.
- The screenshot is now the full page/viewport with the requirements dialog
  open, not a cropped dialog-element capture.

## Scope completed

Task 004 implements the reusable `CATALOGUE_CARD` engine with database-backed offerings, facets, game-mode filters, offering/service requirements, public search, requirement dialogs, admin offering management, and a server-only RSN eligibility checker.

No pricing, cart, checkout, order creation, deployment, WooCommerce import, or Task 005 work was started.

## Database changes

Added enum:

- `CatalogueComparisonOperator`

Added models:

- `CatalogueOffering`
- `CatalogueOfferingFacet`
- `CatalogueOfferingGameMode`
- `CatalogueOfferingRequirement`
- `RsnLookupCache`
- `PublicRateLimitBucket`

Extended existing models:

- `CatalogueRequirement`
  - `customerGuidance`
  - `metricKey`
  - `comparisonOperator`
  - `requiredValue`
  - `recommendedServiceId`
- `CatalogueService`
  - offering relations and recommendation relations
- `User`
  - staged catalogue update relation remains compatible with the expanded aggregate

The migration is additive. It does not drop Task 001-003 data and does not rewrite historical revision rows.

## Staging, revisions and compatibility

- Task 003 staged service aggregates are upgraded on read to schema version 2.
- Older snapshots that do not contain offerings default safely to empty offering/facet/game-mode/requirement arrays.
- Published offering changes remain private until republish.
- Preview reads the staged aggregate and shows staged offerings, facets, game modes, requirements and eligibility configuration.
- Republish validates and replaces the complete service/offering aggregate atomically, creates one immutable revision, writes audit events, and deletes only the claimed stage.
- Discard and stale-editor flows preserve newer staged work.

## Admin routes and permissions

Added admin offering routes:

- `/admin/catalogue/services/[id]/offerings`
- `/admin/catalogue/services/[id]/offerings/new`
- `/admin/catalogue/services/[id]/offerings/[offeringId]`

Extended routes:

- `/admin/catalogue/services/[id]`
- `/admin/catalogue/services/[id]/preview`

Permissions:

- `products.view` required for offering lists, offering detail, eligibility views and protected preview.
- `products.edit` required server-side for offering create/edit/duplicate/remove/reorder, facet changes, game-mode changes, requirement changes, rule changes, republish and discard.
- Anonymous and Support Agent access remains denied for management routes.

## Public routes and API

Public catalogue card rendering is integrated into:

- `/services/[categorySlug]/[serviceSlug]`

Added public eligibility route:

- `POST /api/catalogue/eligibility`

Public behavior:

- Server-backed offering search, filters and pagination.
- Facet options derive from published offering data.
- Game-mode filtering uses effective parent/offering modes.
- Inactive offerings, drafts, archived services, internal notes, client-review fields, cache IDs and rate-limit IDs are excluded from public projections.
- Requirement dialog separates service-level and offering-level requirements and shows verification methods, guidance and recommendations.
- RSNs are never placed in URLs.
- No password field is rendered or accepted.

## RSN provider architecture

- Provider abstraction lives under `src/lib/eligibility`.
- Production provider uses the official public OSRS Hiscores endpoint with a fixed allow-listed host.
- The client cannot control the provider URL.
- Requests are server-side only, use an explicit timeout, reject oversized responses, reject malformed responses, distinguish not-found from provider failure, and return safe messages.
- Deterministic development fixtures are available only when `RSN_DEVELOPMENT_FIXTURE=true`.
- Normal tests and screenshots do not depend on live external provider availability.

## Metric registry and eligibility evaluation

Automatic eligibility rules use an allow-listed metric registry. Implemented public-stat metric categories:

- total level
- total XP
- skill levels
- skill XP

Evaluation statuses:

- `MET`
- `NOT_MET`
- `CUSTOMER_CONFIRMATION_REQUIRED`
- `SUPPORT_VERIFICATION_REQUIRED`
- safe missing/unavailable states for unsupported provider metrics

The UI does not infer quest completion, diary completion, gear, inventory, bank contents, membership or account ownership from public stats.

## Cache, rate limiting and privacy

Cache model:

- `RsnLookupCache`

Cache behavior:

- HMAC-derived lookup key.
- Positive TTL default: `RSN_CACHE_TTL_SECONDS=300`.
- Negative TTL default: `RSN_NEGATIVE_CACHE_TTL_SECONDS=60`.
- Corrupt/expired cache entries are rejected safely.
- Provider failures are not stored as long-lived success data.

Rate-limit model:

- `PublicRateLimitBucket`

Rate-limit behavior:

- HMAC-derived request-identity key.
- Window default: `RSN_RATE_LIMIT_WINDOW_SECONDS=60`.
- Count default: `RSN_RATE_LIMIT_COUNT=8`.
- Raw IP addresses are not stored.
- Trusted proxy header use is opt-in via `RSN_TRUST_PROXY_IP_HEADER=true`.

Secrets:

- `ELIGIBILITY_HMAC_SECRET` is server-only and falls back to `AUTH_SECRET` when omitted.
- No RSN eligibility secret is exposed through `NEXT_PUBLIC_*`.

## Feature flags

Added non-destructive seed flags:

- `catalogue_card_engine_enabled` — defaults on.
- `rsn_eligibility_enabled` — defaults off.

Seed reruns preserve administrator changes to feature flags.

## Seed behavior

Seed content remains representative and non-destructive:

- 6 services
- 8 offerings
- 16 offering facets
- 8 seeded offering requirements
- 6 service-level requirements
- 11 feature flags

Repeated seed runs preserve existing users, administrator password hashes, sessions, roles, permissions, feature-flag values, catalogue edits, staged aggregates, revisions and audit history.

## Audit events

Audit coverage was extended for meaningful administrative changes, including:

- offering created/updated/duplicated/removed
- offering activation state changes
- offering ordering changes
- offering facets changed
- offering game modes changed
- offering requirements changed
- automatic eligibility rule changes
- recommended prerequisite changes
- offering aggregate republish
- pending offering changes discarded

Public RSN lookups do not audit raw RSNs.

## Automated validation

Main checkout:

- `pnpm exec prisma format` — passed.
- `pnpm db:generate` — passed.
- `pnpm format` — passed.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — 14 files passed, 68 tests passed.
- `pnpm test:seed` — 1 file passed, 2 tests passed.
- `pnpm format:check` — passed.

Short physical validation checkout:

- `pnpm db:migrate` — passed against `task004_existing`.
- `pnpm db:seed` — passed.
- `pnpm build` — passed.
- `pnpm test:e2e` — 47 passed, 7 skipped, 54 total.

The production build and full Playwright run were executed from `C:\Users\Faizan Qaiser\Documents\Codex\t4v`, a short physical copy of the same source, because the generated workspace path triggers a Windows/pnpm long-path dependency resolution issue during `next build`.

## MySQL migration validation

Fresh database:

- Database: `task004_fresh`
- Applied migrations: 5
- Task 004 migration applied successfully.
- Final seed shape: 6 services, 8 offerings, 16 offering facets, 8 offering requirements, 6 service requirements, 11 feature flags, 0 staged rows.
- Repeated seed passed.

Existing Task 003 database:

- Database: `task004_existing`
- Started from Task 003 schema/data, then applied Task 004 migration with no reset.
- Preserved validation fixtures: user, session, PayPal flag state, audit row, revision row and legacy v1 staged aggregate during migration/seed validation.
- Administrator password hash remained unchanged during preservation validation.
- Final seed shape after E2E cleanup: 6 services, 8 offerings, 16 offering facets, 8 offering requirements, 6 service requirements, 11 feature flags, 0 staged rows.
- `catalogue_card_engine_enabled` on; `rsn_eligibility_enabled` off.

## Accessibility and responsive validation

Covered by Playwright checks and visual screenshot review:

- Public offering cards and filters are keyboard-operable and responsive.
- Requirement dialog has accessible dialog semantics and mobile fit.
- Eligibility results avoid color-only status communication.
- Public and admin pages avoid horizontal overflow at target browser widths.
- Mobile public catalogue and admin offering management fit 390px width.

Manual screenshot inspection was completed for representative public desktop, public dialog, public mobile eligibility and admin offering editor captures.

## Screenshots

Generated under `artifacts/task-004/`:

- `public-catalogue-engine-1440.png`
- `public-catalogue-filtered-1440.png`
- `public-requirement-dialog-1440.png`
- `public-rsn-eligibility-met-1440.png`
- `public-rsn-eligibility-mixed-1440.png`
- `public-catalogue-mobile-390.png`
- `public-eligibility-mobile-390.png`
- `admin-offerings-list-1440.png`
- `admin-offering-editor-1440.png`
- `admin-eligibility-rules-1440.png`
- `admin-offerings-mobile-390.png`

## Known limitations

- Live OSRS Hiscores smoke testing was not run; the optional live-provider path remains disabled by default.
- Boss/activity metric storage is supported by the provider contract, but only total and skill level/XP metrics are currently registered for automatic evaluation.
- RSN eligibility remains behind a conservative feature flag and is off by default.
- Pricing, calculators, cart, checkout, order creation, deployment and Task 005 are intentionally excluded.

## Stop condition

Task 004 is ready for visual, code, database and security review. The branch was not pushed, no pull request was opened, nothing was merged or deployed, and Task 005 was not started.

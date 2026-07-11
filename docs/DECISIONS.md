# Decision Log

## Confirmed

- Product name: OSRS Services
- Domain: osrsservices.com
- Region: United States
- Currency: USD
- Delivery target: seven weeks
- Codex is the primary implementation agent
- No required Figma workflow
- Original UI using black, white, and green branding
- Guest checkout supported
- RSN/game ID collected
- Custom live chat
- Three staff roles at launch
- MySQL selected for initial Hostinger compatibility
- Payment interfaces and adapters now; live activation later
- Discord Stream default: +2%
- Secure 100+ Combat option default: +10%
- Standard, Priority, and Express delivery options
- Membership automatic renewal and cancellation deferred
- Client supplies final prices and real account inventory
- Competitor active account inventory will not be copied

## Task 001 package and implementation decisions — 2026-06-30

- Node.js 24 LTS is pinned in `package.json`; it is both an active LTS release and a Hostinger-supported managed runtime.
- pnpm 11.7.0 is pinned through the `packageManager` field.
- Next.js 16.2.9, React 19.2.7, Tailwind CSS 4.3.2, Prisma 7.8.0, TypeScript 6.0.3, Vitest 4.1.9, and Playwright 1.61.1 are pinned for reproducible installs.
- MySQL 8.4 is used in Docker Compose because it is the MySQL 8 LTS line.
- RSA public-key retrieval is an explicit environment opt-in for the local non-TLS MySQL account and remains disabled by default outside local configuration.
- Credentials authentication uses Auth.js-compatible `User` and `Session` fields with a custom credentials handler. Auth.js credentials providers require JWT session strategy, which conflicts with this task's database-session requirement.
- Raw session secrets are never stored in MySQL. The browser receives the opaque token in an HTTP-only cookie, while MySQL stores an HMAC-SHA256 digest.
- Route protection is layered: the Next.js proxy rejects missing cookies, while server layouts validate the live database session and capability.
- The in-memory login limiter is an initial single-instance defense. A shared limiter is required before multi-instance deployment.
- `assets/branding/osrs-services-logo.svg` is the repository-approved Task 001 development wordmark. It must be replaced with the final approved transparent asset before homepage approval.

## Pending client configuration

- Priority delivery fee and time
- Express delivery fee and time
- Final membership tiers and prices
- Final gold rates before launch
- Real prebuilt account listings
- Approved payment providers
- Final US business address

## Task 003 catalogue decisions — 2026-07-01

- Categories and services use stable IDs plus unique URL slugs; services also retain a unique canonical-ready slug for later migration and SEO work.
- Game modes, requirements, media references and publication revisions are normalized rather than stored as editable JSON blobs.
- Engine type is stored as a typed selection only. Task 003 does not execute calculators, pricing, inventory, checkout or marketplace engines.
- Scheduled visibility is evaluated at request time. No worker or scheduler is introduced.
- Previously published services are archived rather than permanently deleted. Publication, republication and archive events create immutable content snapshots.
- Public queries use an allow-listed scalar projection that excludes internal notes, legacy metadata and actor relations.
- Media management accepts only internal paths and HTTP(S) references with alt text. Production upload/storage remains deferred.
- Seeded catalogue records use stable seed keys and empty update clauses so reruns add missing defaults without overwriting edited content or operational state.
- Category/service mutation inputs are explicitly allow-listed and Zod-validated. Optimistic service versions reject stale editor submissions.

## Task 004 catalogue-card and eligibility decisions — 2026-07-06

- Offerings are normalized children of `CatalogueService`; publication remains inherited from the parent.
- Task 003 stage snapshots upgrade from schema version 1 to version 2 on read. Existing stages/revisions remain readable; new revisions include offerings and eligibility rules.
- Published offering edits remain in the versioned service stage. Republish replaces the aggregate transactionally while retaining staged stable IDs.
- Empty offering game-mode rows mean inheritance; explicit rows may only narrow parent modes.
- Automatic eligibility accepts only allow-listed metrics and typed comparisons. Unknown or missing metrics require support review.
- Official OSRS Hiscores is the deployed provider. Deterministic fixture mode is an explicit local/test switch that also supports local production-build E2E; it must remain disabled in deployments.
- Cache and limiter keys are HMAC-derived. No RuneScape password, raw IP, provider URL, raw response, or lookup history is stored.
- Catalogue cards remain quote/review only. Pricing, cart, checkout and Task 005 remain outside scope.

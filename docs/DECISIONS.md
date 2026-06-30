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

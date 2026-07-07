# Deployment Plan

## Current environment

- Domain: osrsservices.com
- Hosting: Hostinger Business Web Hosting
- Existing production site: WordPress and WooCommerce

## Development

Build locally first. Keep the current website live. Use separate development data and no live payment configuration.

## Staging

Create a staging environment before production. Test Hostinger's Node.js application support first. Use an alternative managed Node environment or VPS if the required custom server or real-time connections are limited.

## Production gate

Before switching the domain, verify migration, media, redirects, SSL, administrator access, backups, chat, email, correctly enabled features, rollback, tests, and client approval.

The domain and email may remain at Hostinger even if the application later moves to a VPS or split deployment.

## Eligibility configuration

Configure the server-only timeout, positive/negative cache TTLs, rate-limit window/count, proxy trust, and dedicated HMAC secret from `.env.example`. Never use `NEXT_PUBLIC_*` for secrets. Leave fixture mode and proxy-header trust disabled unless their documented assumptions are explicitly satisfied.

Run `prisma migrate deploy` without reset. Migration `20260706150000_task004_catalogue_engine_eligibility` is additive. Rollback is manual: disable eligibility, export new data, remove new foreign keys in dependency order, and only then remove Task 004 columns/tables after review.

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

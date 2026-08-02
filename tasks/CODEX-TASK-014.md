# CODEX TASK 014 - Customer Accounts and Dashboard Foundation

## Starting State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-014`
- Branch: `codex/task-014-customer-accounts-dashboard`
- Starting main SHA: `31b8b761b3f89dba75f379ba12a6d8b6fece4b8b`
- Task 013 merge commit: `31b8b761b3f89dba75f379ba12a6d8b6fece4b8b`
- PR #14 state: merged before Task 014 work began

Task 014 starts from latest `origin/main` containing the Task 013 merge commit. It does not continue from the Task 013 branch and does not modify prior task worktrees.

## Delivered Scope

- Additive Prisma migration `20260801150000_task014_customer_accounts_dashboard`.
- Explicit `UserAccountType` and `SessionAudience` isolation for staff and customer users.
- Separate customer session cookie `osrs_customer_session`, HMAC-stored session token digests, bounded expiry and revocation.
- Optional customer registration, customer login/logout, profile edits, password change, session listing and session revocation.
- Provider-neutral email-verification and password-recovery token foundations with hashed tokens and truthful provider-not-configured notification state.
- Secure post-checkout account creation and guest-order claim foundations using server-checked tracking-token hashes.
- Authenticated checkout ownership through `CustomerOrderLink` without mutating immutable `GuestOrderContact` or `OrderItem` snapshots.
- Customer dashboard, orders, order detail, profile, security and notification pages.
- Admin customer overview/detail, settings, disabling/re-enabling and customer-session revocation.
- Customer permissions, audit/security events, feature flags and non-destructive seed defaults.
- MySQL-backed GitHub Actions validation, E2E tests, screenshots and review-pack generation.

## Boundaries

Task 014 does not implement social login, OAuth, MFA, passkeys, live email/SMS/WhatsApp delivery, live payment providers, subscriptions, membership benefits, live chat, reviews, data export, account deletion, impersonation, deployment or Task 015.

No customer account receives staff roles or permissions through registration or seed. Staff login rejects `CUSTOMER` accounts; customer login rejects `STAFF` accounts; `/admin` requires a staff session and existing permission checks; `/account` requires a customer session.

## Feature Flags

The normal seed creates these disabled by default and preserves manual edits:

- `customer_accounts_enabled`
- `customer_registration_enabled`
- `customer_dashboard_enabled`

`CustomerAccountSettings` is also seeded conservatively with registration/dashboard/recovery disabled, email delivery unconfigured and `needsClientReview` set.

## Validation

Local non-database validation covers Prisma format/generate, lint, typecheck, unit tests, seed tests, format check, build and whitespace checks.

Database-backed migration, seed, customer-auth transaction, upgrade, E2E, screenshot and review-pack validation is configured in `.github/workflows/task014-validation.yml` with temporary MySQL 8.4 service containers and CI-only credentials. This task intentionally does not install local MySQL or Docker.

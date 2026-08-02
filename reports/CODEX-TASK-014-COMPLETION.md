# CODEX TASK 014 Completion Report

## Summary

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-014`
- Branch: `codex/task-014-customer-accounts-dashboard`
- Starting main SHA: `31b8b761b3f89dba75f379ba12a6d8b6fece4b8b`
- Task 013 merge commit: `31b8b761b3f89dba75f379ba12a6d8b6fece4b8b`
- Implementation commit: finalized by the local Task 014 commit after this report is staged; the exact hash is reported in the final handoff because a commit cannot contain its own final hash.
- Final local HEAD: finalized by the local Task 014 commit after this report is staged; the exact hash is reported in the final handoff.

## Migration

Added migration: `20260801150000_task014_customer_accounts_dashboard`

Added enums: `UserAccountType`, `SessionAudience`, `CustomerEmailVerificationStatus`, `CustomerAuthTokenPurpose`, `CustomerAuthTokenStatus`, `CustomerOrderLinkSource`, `CustomerNotificationType`, `CustomerNotificationStatus`, `CustomerSecurityEventType`, `CustomerAccountEventType`.

Added models: `CustomerProfile`, `CustomerAccountSettings`, `CustomerAuthToken`, `CustomerOrderLink`, `CustomerOrderClaimEvent`, `CustomerNotification`, `CustomerNotificationPreference`, `CustomerSecurityEvent`, `CustomerAccountEvent`.

Extended models: `User.accountType`, `Session.audience`, `Session.revokedAt`, and `Order` customer ownership, claim and notification relations.

## Authentication And Sessions

Task 014 reuses the existing credential and session foundation. `STAFF` remains the default for existing users and sessions. Customer sessions use audience `CUSTOMER` and the separate `osrs_customer_session` cookie. Every customer lookup validates audience, user account type, active user status, expiry and revocation.

Staff and customer logins are isolated. Customer registration cannot submit or mutate account type, and public flows do not grant roles or permissions.

## Routes

Public/customer routes: `/account/login`, `/account/register`, `/account/recovery`, `/account/reset/[token]`, `/account`, `/account/orders`, `/account/orders/[orderNumber]`, `/account/profile`, `/account/security`, `/account/notifications`.

API routes: `POST /api/account/register`, `POST /api/account/login`, `POST /api/account/logout`, `PATCH /api/account/profile`, `POST /api/account/password`, `GET /api/account/sessions`, `DELETE /api/account/sessions/[sessionId]`, `POST /api/account/recovery`, `POST /api/account/reset`, `POST /api/account/verify`, `POST /api/account/orders/claim`, `GET/PATCH /api/account/notifications`, `POST /api/account/notifications/[notificationId]/read`, `PATCH /api/account/notification-preferences`.

Admin routes: `/admin/customers`, `/admin/customers/[customerId]`.

## Permissions

Task 014 adds `customers.view`, `customers.manage`, `customers.security.manage`, `customers.orders.link`, `customers.notifications.manage` and `customers.configure`.

## Customer Features

Registration creates a `CUSTOMER` user and `CustomerProfile` atomically, stores terms/privacy acceptance, creates a customer session, creates a hashed verification token and records truthful in-app notification state. When no provider is configured, the app does not claim an email was sent.

Password recovery creates hashed one-time reset tokens without live delivery. Public responses do not enumerate accounts. Password change requires the current password, writes a new Argon2id hash, rotates the current customer session and revokes other customer sessions.

Profile updates validate display name, Discord username, RSN, timezone and locale, reject credential-like fields, and use optimistic concurrency. Historical guest contacts and order item snapshots remain immutable.

## Order Ownership

Task 014 links orders through `CustomerOrderLink` rather than rewriting guest checkout snapshots. Authenticated checkout creates a link inside the checkout transaction after confirming the checkout email matches the customer account email. Guest claiming requires a valid tracking token and matching authenticated customer email. Order numbers alone cannot claim or enumerate orders.

Customer order pages expose only customer-safe order status, payment state, item summaries, public notes and notification truth. Internal notes, actors, audit metadata, token hashes, contact records and staff data are not exposed.

## Notifications And Seeds

Customer notifications are in-app only for Task 014. Email preferences are stored but default to false, and marketing consent defaults false. No live email, SMS, OAuth or payment provider integration is configured.

Normal seed is non-destructive: it adds disabled customer feature flags, adds one customer settings singleton if missing, adds customer permissions, preserves staff account types/password hashes/feature flags/role-permission edits/customer rows, and creates zero fresh customer accounts or customer transactional rows.

## Validation

Local non-database validation is required: `pnpm exec prisma format`, `pnpm db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:seed`, `pnpm format:check`, `pnpm build`, `git diff --check`.

GitHub Actions workflow: `.github/workflows/task014-validation.yml`.

Jobs: `task014-validation`, `task013-to-task014-upgrade`, `task014-final-review-pack`.

The workflow uses temporary MySQL 8.4 service containers, CI-only credentials and no production secrets.

## Artifacts

Reports: `artifacts/task-014/task014-fresh-database-validation.txt`, `artifacts/task-014/task014-customer-auth-validation.txt`, `artifacts/task-014/task013-to-task014-validation.txt`.

Screenshots: `artifacts/task-014/public-customer-register-1440.png`, `artifacts/task-014/public-customer-login-1440.png`, `artifacts/task-014/public-customer-dashboard-1440.png`, `artifacts/task-014/public-customer-orders-1440.png`, `artifacts/task-014/public-customer-order-detail-1440.png`, `artifacts/task-014/public-customer-notifications-1440.png`, `artifacts/task-014/public-customer-security-1440.png`, `artifacts/task-014/public-customer-dashboard-mobile-390.png`, `artifacts/task-014/admin-customers-overview-1440.png`, `artifacts/task-014/admin-customer-detail-1440.png`.

Review pack builder: `scripts/build-task014-review-pack.ts`, output `task-014-final-review-pack.zip`. The ZIP is generated in CI and is not committed.

## Known Limitations

Customer accounts remain disabled by default until client review. Email verification and password recovery are provider-neutral foundations only; no live delivery is configured. Customer notifications are in-app only. Admin-assisted order linking is modeled and permissioned, but no public reassignment/unlink flow is provided.

No deployment, PR creation, merge, live provider setup or Task 015 work occurred.

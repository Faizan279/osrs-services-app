# CODEX TASK 015 Completion Report

## Summary

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-015`
- Branch: `codex/task-015-live-chat-support-dashboard`
- Starting main SHA: `9a66f6089995950067408864c57151e436dd4c93`
- Task 014 merge commit: `9a66f6089995950067408864c57151e436dd4c93`
- Implementation commit: finalized by the local Task 015 commit after this report is staged; the exact hash is reported in the final handoff because a commit cannot contain its own final hash.
- Final local HEAD: finalized by the local Task 015 commit after this report is staged; the exact hash is reported in the final handoff.

## Migration

Added migration: `20260803150000_task015_live_chat_support_dashboard`.

Added enums: `ChatAvailabilityMode`, `ChatConversationStatus`, `ChatConversationPriority`, `ChatParticipantType`, `ChatMessageType`, `ChatConversationEventType`, `ChatGuestSessionStatus`, `ChatLinkSource`, `ChatRedactionReason`, `ChatArchiveReason`.

Added models: `ChatSettings`, `ChatGuestSession`, `ChatConversation`, `ChatMessage`, `ChatReadCursor`, `ChatConversationEvent`, `ChatAssignmentEvent`, `ChatInternalNote`, `ChatQuickReply`, `ChatConversationOrderLink`, `ChatRetentionEvent`.

Extended models: `CustomerNotificationType` and `CustomerNotificationPreference.type` include `CHAT_MESSAGE`; `User` and `Order` have chat relation fields.

## Runtime

Task 015 adds `realtime/chat-server.ts`, a separate single-node Socket.IO gateway. It uses the same MariaDB-backed Prisma client through `src/lib/db/runtime.ts`, accepts cookies only, rejects query/auth token payloads and exposes `/health` plus `/chat/health`.

The Next.js app keeps HTTP fallback APIs for all public and staff chat actions. The browser client uses Socket.IO only when `chat_realtime_enabled`, `ChatSettings.realtimeExpected` and `NEXT_PUBLIC_CHAT_SOCKET_URL` are deliberately configured.

## Security And Privacy

Guest chat tokens are generated with high entropy. The raw token is returned only as the `osrs_chat_guest` HttpOnly cookie value; MySQL stores only an HMAC-SHA256 digest. Staff/customer sessions remain isolated by existing session audience checks.

Public chat input rejects HTML-like text, credential-like fields and credential-like content such as passwords, bank PINs, recovery answers, authenticator seeds, cards, wallet seeds, private keys, browser cookies and session tokens.

Internal notes, assignment events, audit rows, redaction metadata and staff-only order context are not returned to guest or customer conversation reads.

## Routes

Public/customer routes: `/support`, `/account/support`.

Public APIs: `GET /api/chat/availability`, `POST /api/chat/guest-session`, `GET/POST /api/chat/conversations`, `GET /api/chat/conversations/[conversationId]`, `POST /api/chat/conversations/[conversationId]/messages`, `POST /api/chat/conversations/[conversationId]/read`, `PATCH /api/chat/conversations/[conversationId]/status`, `POST /api/chat/conversations/[conversationId]/order-links`.

Admin routes: `/admin/chat`, `/admin/chat/[conversationId]`.

Admin APIs: queue listing, detail, staff replies, assignment, internal notes, status updates, message redaction and settings update under `/api/admin/chat`.

## Permissions

Task 015 adds or activates `chat.view`, `chat.respond`, `chat.assign`, `chat.status.manage`, `chat.internal_notes.create`, `chat.order_link`, `chat.settings.manage`, `chat.quick_replies.manage`, `chat.messages.redact`, `chat.archive` and `chat.monitor_all`.

Support Agent receives operational queue permissions only. Settings, quick-reply administration, redaction, archive and monitor-all access remain restricted to Super Admin by default.

## Seeds

Normal seed is non-destructive. It adds missing chat permissions, missing disabled chat feature flags, one offline `ChatSettings` singleton and three neutral quick replies marked `needsClientReview=true`. It creates zero fresh guest sessions, conversations, messages, internal notes, order links or retention events.

## Validation

Local non-database validation is required: `pnpm exec prisma format`, `pnpm db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:seed`, `pnpm format:check`, `pnpm build`, `pnpm chat:check`, `pnpm exec tsx scripts/build-task015-review-pack.ts --scan-sources`, `git diff --check`.

Completed locally before the implementation commit with dummy database environment values and no local MySQL/Docker install: Prisma format, Prisma client generation, lint, typecheck, unit tests, seed tests, format check, production build, static chat check, source privacy scan and whitespace check.

Database-backed validation, E2E and screenshot capture are configured for GitHub Actions because Task 015 uses temporary MySQL 8.4 service containers for those checks.

GitHub Actions workflow: `.github/workflows/task015-validation.yml`.

Jobs: `task015-validation`, `task014-to-task015-upgrade`, `task015-final-review-pack`.

The workflow uses temporary MySQL 8.4 service containers, CI-only credentials and no production secrets.

## Artifacts

Reports: `artifacts/task-015/task015-fresh-database-validation.txt`, `artifacts/task-015/task015-chat-validation.txt`, `artifacts/task-015/task014-to-task015-validation.txt`.

Screenshots: `artifacts/task-015/public-chat-disabled-1440.png`, `artifacts/task-015/public-chat-enabled-1440.png`, `artifacts/task-015/public-chat-active-1440.png`, `artifacts/task-015/support-launcher-1440.png`, `artifacts/task-015/public-chat-mobile-390.png`, `artifacts/task-015/customer-chat-page-1440.png`, `artifacts/task-015/customer-chat-active-1440.png`, `artifacts/task-015/admin-chat-overview-1440.png`, `artifacts/task-015/admin-chat-detail-1440.png`, `artifacts/task-015/admin-chat-mobile-390.png`.

Review pack builder: `scripts/build-task015-review-pack.ts`, output `task-015-final-review-pack.zip`. The ZIP is generated in CI and is not committed.

## Known Limitations

Live chat remains disabled by default until client review. Real-time delivery is single-node only. No third-party chat provider, attachment upload, AI chatbot, support schedule automation, SLA enforcement or multi-node adapter is configured. Customer notifications for chat are in-app only.

# Live Chat

Task 015 adds a custom live-chat foundation with durable MySQL storage, HTTP fallback and a separate single-node Socket.IO gateway.

## Default State

Normal seed keeps chat unavailable until client review:

- `live_chat_enabled=false`
- `guest_live_chat_enabled=false`
- `customer_live_chat_enabled=false`
- `chat_realtime_enabled=false`
- `ChatSettings.availabilityMode=OFFLINE`
- `ChatSettings.publicLauncherEnabled=false`
- `ChatSettings.offlineIntakeEnabled=false`
- `ChatSettings.realtimeExpected=false`
- `ChatSettings.needsClientReview=true`

Staff must deliberately update settings and feature flags before public intake appears.

## Runtime

The Next.js app owns HTTP APIs and page rendering. `realtime/chat-server.ts` is a separate Socket.IO process for real-time delivery:

```bash
pnpm chat:start
```

The gateway uses:

- `CHAT_SOCKET_PORT`, default `3001`
- `CHAT_SOCKET_PATH`, default `/socket.io`
- `CHAT_ALLOWED_ORIGINS`, default `http://127.0.0.1:3000`
- `NEXT_PUBLIC_CHAT_SOCKET_URL`, only public because it is a URL, not a secret

`CHAT_ALLOWED_ORIGINS` must be explicit. Wildcard credentialed CORS is rejected.

## Security Boundary

Socket authentication is cookie-only. Query-string tokens and Socket.IO `auth` token payloads are rejected.

Guest chat tokens are raw only in the `osrs_chat_guest` HttpOnly cookie. MySQL stores only an HMAC-SHA256 digest in `ChatGuestSession.tokenHash`.

Public chat text is plain text only. The service rejects HTML-like text and credential-like content, including passwords, bank PINs, recovery answers, authenticator seeds, card data, wallet seeds, private keys, browser cookies and session tokens.

## Staff Dashboard

`/admin/chat` requires `chat.view`. Staff can view queues, assigned conversations, transcripts and customer-safe order links based on permissions. Staff replies require `chat.respond`; assignment requires `chat.assign`; internal notes require `chat.internal_notes.create`; order linking requires `chat.order_link` plus order view access.

Settings, redaction, archive, quick-reply management and monitor-all access are intentionally higher-trust permissions.

## Deferred Scope

No external chat provider, Redis adapter, message bus, file attachment handling, AI chatbot, SLA engine, schedule automation or deployment is configured in Task 015.

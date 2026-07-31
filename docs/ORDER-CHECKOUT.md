# Order and Checkout

## Guest checkout

Guests may order with email, display name, RSN/game ID, optional Discord username, and service-specific details. After checkout, provide an order number, secure tracking link, email confirmation, and optional account creation.

Task 013 implements the foundation with manual payment review only. It stores guest contact consent, order totals, order items, order status/payment timelines, resource allocations, checkout attempt/idempotency rows, secure tracking-token hashes and notification outbox rows. It does not collect card data, provider credentials, account passwords, bank PINs, recovery data or raw tracking tokens, and it does not send email.

## Cart

- Support multiple compatible services.
- Keep independent pricing snapshots. Future cart items should persist Task 008 `PriceSnapshotV1` data when global pricing is enabled.
- Validate stock and price on the server.
- Recalculate before order creation.
- Show add-ons and delivery fees clearly.

Task 013 adds `Cart` and `CartItem`. The raw cart token is held only in the `osrs_guest_cart` HttpOnly cookie; MySQL stores only `Cart.tokenHash`. Cart sources are server-resolved from skilling, bossing, premium, product, account listing, gold customer-buy and accepted custom-build quote estimates. Account listings, gold buys and accepted custom-build quotes are exclusive cart types; standard services and product estimates may share a cart when currency and compatibility rules match.

Task 008 does not create cart, checkout, quote, order or payment records. It prepares immutable pricing snapshots for future flows, but the server must still recalculate before order creation and mark old snapshots for repricing when the service configuration or published pricing revision has changed.

Task 009 gold estimates also remain preview-only. `GoldEstimateSnapshotV1` is JSON-safe and excludes RSN, customer contact data, internal notes, ledger data and authentication details. Future cart and checkout flows must recalculate gold buy/sell amounts from the current server-side published gold revision, stock or buying-capacity state, and applicable global-pricing rules; Task 009 estimates never reserve or deduct inventory.

Task 010 account marketplace estimates remain preview-only. `AccountListingSnapshotV1` is JSON-safe and excludes login identifiers, passwords, email addresses, recovery data, authenticator data, bank PINs, internal notes, hold actors and customer contact data. Future cart and checkout flows must reload the account listing, published listing revision, global-pricing revision and availability state before any order or reservation can exist.

Task 011 custom account-build requests are quote-only. `CustomBuildEstimateSnapshotV1` excludes display name, email, Discord username, RSN, customer notes, attachments, raw tracking tokens, internal notes and admin identities. Staff can create immutable quote revisions and send a secure guest tracking view; customer acceptance or decline records a quote decision only. Accepted quotes do not create carts, checkout sessions, orders, order items, payments, work assignments, customer accounts or credential handover.

Task 012 product marketplace estimates remain preview-only. `ProductEstimateSnapshotV1` excludes internal product references, internal SKUs, ledger rows, reservation actors, reservation reasons, audit metadata, customer data and credentials. Task 013 reloads the product, latest published product revision, variant stock, active reservations and applicable global-pricing revision before order creation. Public estimates still never reserve stock; checkout creates and later consumes or releases reservations server-side.

## Resource reservations

Task 013 creates finite resource holds only inside checkout/order transactions:

- product marketplace variants create active `ProductInventoryReservation` rows and consume them by writing one idempotent stock-out ledger row when staff marks payment paid
- account listings move from `AVAILABLE` to `HELD` with `AccountListingHold` and return to the previous availability on cancellation or move to `SOLD` when paid
- gold customer-buy orders create `GoldInventoryReservation` rows and consume them with one stock-decrease ledger row when paid

Reservation state is exposed to admins and customers as lifecycle state, not as credentials or private operational notes.

## Suggested order statuses

- Awaiting Payment
- Payment Under Review
- Paid
- Awaiting Assignment
- Assigned
- In Progress
- Waiting for Customer
- Completed
- Cancelled
- Refunded
- Disputed

Every status change records the previous status, new status, actor, timestamp, public note, internal note, and reason.

Task 013 admin actions are guarded separately: `orders.status.manage` for fulfillment status, `orders.payment.review` for manual payment review and paid confirmation, `orders.cancel` for unpaid cancellation and hold release, and `checkout.configure` for checkout settings/payment method configuration.

## Quotes

Task 011 supports quote requests, admin revisions, included items, price, estimated delivery, expiry, customer acceptance or decline, and version history for custom account builds. Quote-to-order conversion remains deferred and must recalculate from current server-side state before any future order is created.

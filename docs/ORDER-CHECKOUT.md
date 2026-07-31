# Order and Checkout

## Guest checkout

Guests may order with email, display name, RSN/game ID, optional Discord username, and service-specific details. After checkout, provide an order number, secure tracking link, email confirmation, and optional account creation.

## Cart

- Support multiple compatible services.
- Keep independent pricing snapshots. Future cart items should persist Task 008 `PriceSnapshotV1` data when global pricing is enabled.
- Validate stock and price on the server.
- Recalculate before order creation.
- Show add-ons and delivery fees clearly.

Task 008 does not create cart, checkout, quote, order or payment records. It prepares immutable pricing snapshots for future flows, but the server must still recalculate before order creation and mark old snapshots for repricing when the service configuration or published pricing revision has changed.

Task 009 gold estimates also remain preview-only. `GoldEstimateSnapshotV1` is JSON-safe and excludes RSN, customer contact data, internal notes, ledger data and authentication details. Future cart and checkout flows must recalculate gold buy/sell amounts from the current server-side published gold revision, stock or buying-capacity state, and applicable global-pricing rules; Task 009 estimates never reserve or deduct inventory.

Task 010 account marketplace estimates remain preview-only. `AccountListingSnapshotV1` is JSON-safe and excludes login identifiers, passwords, email addresses, recovery data, authenticator data, bank PINs, internal notes, hold actors and customer contact data. Future cart and checkout flows must reload the account listing, published listing revision, global-pricing revision and availability state before any order or reservation can exist.

Task 011 custom account-build requests are quote-only. `CustomBuildEstimateSnapshotV1` excludes display name, email, Discord username, RSN, customer notes, attachments, raw tracking tokens, internal notes and admin identities. Staff can create immutable quote revisions and send a secure guest tracking view; customer acceptance or decline records a quote decision only. Accepted quotes do not create carts, checkout sessions, orders, order items, payments, work assignments, customer accounts or credential handover.

Task 012 product marketplace estimates remain preview-only. `ProductEstimateSnapshotV1` excludes internal product references, internal SKUs, ledger rows, reservation actors, reservation reasons, audit metadata, customer data and credentials. Future cart and checkout flows must reload the product, latest published product revision, variant stock, active reservations and applicable global-pricing revision before any order can exist. Public estimates never reserve stock; any future reservation must be created server-side by an authorized checkout flow using the internal reservation service.

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

## Quotes

Task 011 supports quote requests, admin revisions, included items, price, estimated delivery, expiry, customer acceptance or decline, and version history for custom account builds. Quote-to-order conversion remains deferred and must recalculate from current server-side state before any future order is created.

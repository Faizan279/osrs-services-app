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

Support quote requests, admin revisions, included items, price, estimated delivery, expiry, customer acceptance, conversion to order, and version history.

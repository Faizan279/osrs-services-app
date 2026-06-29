# Payment Architecture

Prepare checkout interfaces for PayPal, Apple Pay, Google Pay, cards, Payoneer, cryptocurrency, and OSRS GP. All external provider methods are disabled by default until the client completes provider approval and configuration.

Build a provider-adapter contract, admin enable or disable controls, server-side verification, reliable webhook processing, and clear payment-state handling.

Do not store raw card details. Keep environment-specific configuration outside source control.

Apple Pay and Google Pay should be treated as wallet options supplied through the chosen processor when supported.

OSRS GP uses a manual review workflow with an editable exchange rate, trade instructions, confirmation, staff assignment, and audit history.

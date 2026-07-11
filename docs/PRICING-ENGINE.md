# Pricing Engine

## Principles

- The server is the source of truth.
- Every price, percentage, and availability rule is editable in admin.
- Published pricing rules need version history before they can support orders.
- Every future order item must store a full price snapshot.
- Client-side totals are previews only.
- Old orders never change when current prices change.

## Task 005 skilling estimate preview

Task 005 adds a skilling-specific preview engine only. It calculates an `Estimated total` from service-scoped skilling rules and training methods, then tells the customer that final price is confirmed before checkout.

Inputs handled by the skilling preview:

- level mode or XP mode using the OSRS XP table
- base cents per 1 million XP
- minimum method price
- optional fixed method fee
- account-mode basis-point adjustments
- optional supplies fee
- optional Discord Stream percentage
- configured delivery percentage and fixed fee

The public route never trusts client-submitted prices and does not expose internal rule IDs or arbitrary formulas. Seeded skilling rates are representative defaults only and are marked `Needs client review`, so the public `skilling_calculator_enabled` feature flag is seeded off until client approval.

Task 005 intentionally does not add checkout/order price snapshots, global discount stacking, taxes, payment-provider logic or the full pricing administration workflow for every engine.

## Initial prices

- Existing WooCommerce prices are migration input.
- Firstseller prices may be used as dated seed references where the current catalogue lacks a value.
- All seed prices require client review before launch.

## Default game-mode adjustments

- Normal: +0%
- Iron: +10%
- HCIM: +20%
- UIM: +30%

Allow per-service overrides.

## Add-ons

### Discord Stream

Optional private Discord stream. Default +2%, editable and enabled only for applicable services.

### Secure 100+ Combat Service

Optional. Default +10%, editable and enabled only for applicable services.

### Delivery

- Standard: enabled, default +0%
- Priority: created but disabled until configured
- Express: created but disabled until configured

Each delivery option stores its label, description, fee rule, estimated time, and availability.

## Calculation order

1. Base price
2. Variant or method calculation
3. Account-mode adjustment
4. Service-specific options
5. Secure 100+ Combat fee
6. Discord Stream fee
7. Delivery fee
8. Discounts according to stacking rules
9. Taxes if later applicable
10. Final total

## Admin requirements

Support fixed or percentage rules, effective dates, drafts, publishing, preview, version history, restore, category applicability, minimum and maximum values, and discount stacking controls.

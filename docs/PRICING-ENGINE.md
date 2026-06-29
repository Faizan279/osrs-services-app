# Pricing Engine

## Principles
- The server is the source of truth.
- Every price, percentage, and availability rule is editable in admin.
- Published pricing rules have version history.
- Every order item stores a full price snapshot.
- Client-side totals are previews only.
- Old orders never change when current prices change.

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

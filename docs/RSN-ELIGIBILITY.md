# RSN Eligibility Checker

## Goal

Allow a guest or customer to enter an RSN and compare public account statistics with a service's requirements.

## Flow

1. Enter RSN.
2. Fetch public OSRS statistics.
3. Cache the response briefly.
4. Compare public numeric requirements.
5. Show Met, Not met, Customer confirmation required, or Support verification required.
6. Recommend prerequisite services where appropriate.

## Automatically verifiable examples

- Public skill levels
- Total level and XP
- Public boss or activity values where available

## Not reliably verifiable from RSN alone

- Completed quests
- Diary completion
- Inventory or bank contents
- Exact gear
- Untradeables
- Membership
- Account ownership
- Some unlocks

Each requirement stores its type, label, required value, comparison operator, verification method, customer guidance, optional recommended service, and admin notes.

Never request a RuneScape password for eligibility lookup.

# Design System Direction

## Brand personality

- Premium gaming marketplace
- Confident, secure, fast, and modern
- Deep black and forest-green interface with controlled lime energy
- Muted gold details for premium, crafted moments
- OSRS-inspired without looking unofficially copied from the game or competitors

## Refined color tokens

These tokens were refined during the Task 001 visual revision:

- `--background`: #030705
- `--surface-1`: #08100B
- `--surface-2`: #0D1710
- `--surface-3`: #142119
- `--surface-raised`: #17261C
- `--border`: #25352B
- `--border-strong`: #36513F
- `--primary`: #A6D719
- `--primary-hover`: #B9E83C
- `--primary-muted`: #1C3518
- `--gold`: #C7A45A
- `--gold-muted`: #322919
- `--text-primary`: #F5F7F3
- `--text-secondary`: #B5BDB6
- `--text-muted`: #78837B
- `--success`: #55D484
- `--warning`: #D5AB52
- `--danger`: #E66B68
- `--info`: #6AA9D8

## Visual rules

- Lime green is reserved for primary actions, selected states, focus, and small highlights.
- Muted gold is reserved for ornament, premium cues, and secondary emphasis.
- Display typography is used sparingly for major headings; controls and operational content use the sans-serif hierarchy.
- Use generous spacing and clear hierarchy.
- Avoid excessive glow effects.
- Use layered dark surfaces, subtle borders, shadows, and restrained gradients.
- Use original illustrations or properly licensed assets.
- Preserve readable contrast.
- Provide clear selected, hover, focus, disabled, error, and loading states.

## Core component inventory

- Header and mega menu
- Mobile navigation drawer
- Announcement bar
- Search
- Buttons and icon buttons
- Product/service cards
- Account cards
- Requirement modal
- Filter chips and tabs
- Quantity selector
- Pricing summary
- Add-on selector
- Delivery selector
- Form inputs
- Data table
- Status badges
- Empty/error/loading states
- Toasts and notification centre
- Live-chat launcher and panel
- Admin navigation
- Dashboard cards
- Confirmation dialog

## Responsive targets

- Mobile: 360–430 px
- Tablet: 768–1024 px
- Desktop: 1280–1600 px
- Large desktop: 1920 px

The interface must remain usable at 320 px minimum width.

## Task 002 public patterns

- The public shell uses a slim announcement bar, sticky translucent header, desktop service menu, focus-managed mobile drawer, and a full multi-column footer.
- Public page sections use a maximum content width of `80rem`, generous vertical spacing, and alternating near-black or forest surfaces to create rhythm without bright-green saturation.
- Major page headings use the display serif at restrained sizes. Navigation, controls, labels, prices, and operational copy remain in the sans-serif family.
- Lime remains reserved for primary calls to action, active indicators, small icons, and selected states. Gold appears only in kickers, ornaments, and secondary premium cues.
- Category cards may span different column widths to establish hierarchy; repeated service previews use centralized typed content and consistent factual labels.
- Atmospheric artwork must be built from original CSS geometry, gradients, borders, and licensed icons. Do not use copied game or competitor artwork.
- Placeholder reviews must be visibly identified as demo content in both the interface and source data until client-approved feedback is supplied.
- Interactive public components preserve visible focus, Escape behavior, correct expanded state, mobile scroll locking, minimum practical touch targets, and reduced-motion handling.

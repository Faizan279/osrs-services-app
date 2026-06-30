# Risks and Controls

## Seven-week scope

Risk: the launch scope is large.
Control: small vertical tasks, daily verification, reusable engines, and no one-shot implementation prompts.

## Reference similarity

Risk: the interface could look too similar to a reference site.
Control: original design tokens, layout, copy, components, and artwork, followed by visual review.

## OSRS requirement accuracy

Risk: service requirements may be incomplete or become outdated.
Control: editable requirements, source/date metadata, multiple verification methods, and review before publishing.

## Hosting limitations

Risk: managed hosting may restrict custom server behaviour, real-time connections, or background processing.
Control: MySQL compatibility, a single-instance initial architecture, staging tests, and a VPS fallback.

## Payment availability

Risk: provider approval may not be complete at launch.
Control: disabled methods and provider-ready adapters without misleading availability claims.

## Migration quality

Risk: the source export lacks some content and plugin data.
Control: preserve the raw export, normalize through a migration process, and complete manual review.

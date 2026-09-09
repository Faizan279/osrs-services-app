-- Add a dedicated immutable cart/order kind for admin-managed catalogue
-- offerings. This is an additive enum extension; no rows are removed or reset.
ALTER TABLE `CartItem`
  MODIFY `kind` ENUM(
    'SKILLING_ESTIMATE',
    'BOSSING_ESTIMATE',
    'PREMIUM_ESTIMATE',
    'CATALOGUE_OFFERING_ESTIMATE',
    'PRODUCT_ESTIMATE',
    'ACCOUNT_LISTING_ESTIMATE',
    'GOLD_BUY_ESTIMATE',
    'ACCEPTED_CUSTOM_BUILD_QUOTE'
  ) NOT NULL;

ALTER TABLE `OrderItem`
  MODIFY `kind` ENUM(
    'SKILLING_ESTIMATE',
    'BOSSING_ESTIMATE',
    'PREMIUM_ESTIMATE',
    'CATALOGUE_OFFERING_ESTIMATE',
    'PRODUCT_ESTIMATE',
    'ACCOUNT_LISTING_ESTIMATE',
    'GOLD_BUY_ESTIMATE',
    'ACCEPTED_CUSTOM_BUILD_QUOTE'
  ) NOT NULL;

-- Catalogue offerings now power direct ordering, so their public ETA can be
-- maintained through the existing staged Admin editor alongside price.
ALTER TABLE `CatalogueOffering`
  ADD COLUMN `estimatedDeliveryText` VARCHAR(240) NULL AFTER `pricingUnit`;

-- Optional published bulk tiers live with each rate draft/revision. Empty or
-- NULL means no discount; no commercial percentage is seeded by this change.
ALTER TABLE `GoldRate`
  ADD COLUMN `volumeDiscounts` JSON NULL AFTER `automaticReviewMaximumGp`;

-- The section limit is a merchandising configuration update required to show
-- the new fifth primary category. Existing authored cards are preserved.
UPDATE `HomepageSection`
SET `itemLimit` = GREATEST(`itemLimit`, 5),
    `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `sectionKey` = 'main-categories';

INSERT IGNORE INTO `HomepageItem` (
  `id`, `placement`, `sourceType`, `titleOverride`, `descriptionOverride`,
  `imagePath`, `imageAltText`, `ctaText`, `ctaUrl`, `priceMode`,
  `categoryLabel`, `displayOrder`, `updatedAt`
) VALUES (
  'hp-cat-misc-gathering', 'MAIN_CATEGORY', 'MANUAL_PROMO', 'Misc Gathering',
  'Configure resource and gathering services by quantity.',
  '/artwork/osrs-reference-board.jpeg', 'Misc gathering fantasy artwork',
  'View Gathering', '/misc-gathering', 'HIDE', 'Services', 50,
  CURRENT_TIMESTAMP(3)
);

-- Seeded homepage cards now target the useful configurators directly. These
-- stable rows were created by the application migration, not user-owned IDs.
UPDATE `HomepageItem`
SET `ctaUrl` = CASE `id`
    WHEN 'hp-cat-gold' THEN '/gold'
    WHEN 'hp-cat-power' THEN '/skills'
    WHEN 'hp-cat-pvm' THEN '/bossing'
    WHEN 'hp-svc-inferno' THEN '/infernal'
    WHEN 'hp-svc-bossing' THEN '/bossing'
    WHEN 'hp-svc-raids' THEN '/bossing'
    WHEN 'hp-svc-skills' THEN '/skills'
    WHEN 'hp-svc-quests' THEN '/quests'
    WHEN 'hp-svc-diaries' THEN '/diaries'
    WHEN 'hp-feat-inferno' THEN '/infernal'
    WHEN 'hp-feat-gauntlet' THEN '/bossing'
    WHEN 'hp-feat-zulrah' THEN '/bossing'
    WHEN 'hp-feat-raids' THEN '/bossing'
    ELSE `ctaUrl`
  END,
  `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` IN (
  'hp-cat-gold', 'hp-cat-power', 'hp-cat-pvm', 'hp-svc-inferno',
  'hp-svc-bossing', 'hp-svc-raids', 'hp-svc-skills', 'hp-svc-quests',
  'hp-svc-diaries', 'hp-feat-inferno', 'hp-feat-gauntlet',
  'hp-feat-zulrah', 'hp-feat-raids'
);

UPDATE `HomepageItem`
SET `titleOverride` = 'Gold',
    `descriptionOverride` = 'Choose a configured amount and see the published rate immediately.',
    `ctaText` = 'Buy Gold',
    `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'hp-cat-gold';

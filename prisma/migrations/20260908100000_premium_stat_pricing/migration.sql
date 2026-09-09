-- Optional, Admin-published stat bands. No commercial adjustments are enabled by this migration.
ALTER TABLE `PremiumServiceConfig` ADD COLUMN `statPricingRules` JSON NULL;

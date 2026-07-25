-- TASK 008: additive global pricing foundation.

CREATE TABLE `PricingRuleSet` (
  `id` VARCHAR(30) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `description` VARCHAR(500) NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `snapshotSchemaVersion` INTEGER NOT NULL DEFAULT 1,
  `draftVersion` INTEGER NOT NULL DEFAULT 1,
  `publishedAt` DATETIME(3) NULL,
  `publishedById` VARCHAR(30) NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `internalNotes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `PricingRuleSet_status_updatedAt_idx` (`status`, `updatedAt`),
  INDEX `PricingRuleSet_publishedById_idx` (`publishedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PricingRule` (
  `id` VARCHAR(30) NOT NULL,
  `ruleSetId` VARCHAR(30) NOT NULL,
  `publicLabel` VARCHAR(160) NOT NULL,
  `internalDescription` TEXT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `ruleType` ENUM('FIXED_ADDITION', 'PERCENTAGE_ADDITION', 'MINIMUM_TOTAL', 'MAXIMUM_TOTAL') NOT NULL,
  `amountCents` INTEGER NULL,
  `valueBps` INTEGER NULL,
  `priority` INTEGER NOT NULL DEFAULT 0,
  `exclusiveGroupKey` VARCHAR(120) NULL,
  `effectiveStart` DATETIME(3) NULL,
  `effectiveEnd` DATETIME(3) NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `version` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `PricingRule_ruleSetId_enabled_priority_idx` (`ruleSetId`, `enabled`, `priority`),
  INDEX `PricingRule_ruleType_idx` (`ruleType`),
  INDEX `PricingRule_exclusiveGroupKey_idx` (`exclusiveGroupKey`),
  INDEX `PricingRule_effectiveStart_effectiveEnd_idx` (`effectiveStart`, `effectiveEnd`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PricingRuleApplicability` (
  `id` VARCHAR(30) NOT NULL,
  `ruleId` VARCHAR(30) NOT NULL,
  `scope` ENUM('GLOBAL', 'ENGINE_TYPE', 'CATEGORY', 'SERVICE') NOT NULL,
  `engineType` ENUM('CATALOGUE_CARD', 'SKILLING_CALCULATOR', 'BOSSING_ENGINE', 'PREMIUM_SERVICE_CONFIGURATOR', 'GOLD_ENGINE', 'ACCOUNT_MARKETPLACE', 'CUSTOM_ACCOUNT_BUILD', 'PRODUCT_MARKETPLACE') NULL,
  `categoryId` VARCHAR(30) NULL,
  `serviceId` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `PricingRuleApplicability_ruleId_idx` (`ruleId`),
  INDEX `PricingRuleApplicability_scope_engineType_idx` (`scope`, `engineType`),
  INDEX `PricingRuleApplicability_categoryId_idx` (`categoryId`),
  INDEX `PricingRuleApplicability_serviceId_idx` (`serviceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PricingRevision` (
  `id` VARCHAR(30) NOT NULL,
  `ruleSetId` VARCHAR(30) NOT NULL,
  `revisionNumber` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `PricingRevision_ruleSetId_revisionNumber_key` (`ruleSetId`, `revisionNumber`),
  INDEX `PricingRevision_publishedAt_idx` (`publishedAt`),
  INDEX `PricingRevision_publishedById_idx` (`publishedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PricingRuleSet`
  ADD CONSTRAINT `PricingRuleSet_publishedById_fkey`
  FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PricingRule`
  ADD CONSTRAINT `PricingRule_ruleSetId_fkey`
  FOREIGN KEY (`ruleSetId`) REFERENCES `PricingRuleSet`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PricingRuleApplicability`
  ADD CONSTRAINT `PricingRuleApplicability_ruleId_fkey`
  FOREIGN KEY (`ruleId`) REFERENCES `PricingRule`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PricingRuleApplicability`
  ADD CONSTRAINT `PricingRuleApplicability_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `CatalogueCategory`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PricingRuleApplicability`
  ADD CONSTRAINT `PricingRuleApplicability_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PricingRevision`
  ADD CONSTRAINT `PricingRevision_ruleSetId_fkey`
  FOREIGN KEY (`ruleSetId`) REFERENCES `PricingRuleSet`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PricingRevision`
  ADD CONSTRAINT `PricingRevision_publishedById_fkey`
  FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- TASK 004: additive catalogue offerings and public eligibility infrastructure.
ALTER TABLE `CatalogueRequirement`
  ADD COLUMN `customerGuidance` TEXT NULL,
  ADD COLUMN `metricKey` VARCHAR(120) NULL,
  ADD COLUMN `comparisonOperator` ENUM('GREATER_THAN_OR_EQUAL', 'GREATER_THAN', 'EQUAL', 'LESS_THAN_OR_EQUAL', 'LESS_THAN') NULL,
  ADD COLUMN `requiredValue` INTEGER NULL,
  ADD COLUMN `recommendedServiceId` VARCHAR(30) NULL;

CREATE TABLE `CatalogueOffering` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `seededKey` VARCHAR(140) NULL,
  `slug` VARCHAR(180) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `shortSummary` VARCHAR(500) NOT NULL,
  `description` TEXT NULL,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `isFeatured` BOOLEAN NOT NULL DEFAULT false,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `groupLabel` VARCHAR(120) NULL,
  `tierLabel` VARCHAR(120) NULL,
  `quantityEnabled` BOOLEAN NOT NULL DEFAULT false,
  `quantityUnit` VARCHAR(80) NULL,
  `minimumQuantity` INTEGER NULL,
  `maximumQuantity` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CatalogueOffering_seededKey_key` (`seededKey`),
  UNIQUE INDEX `CatalogueOffering_serviceId_slug_key` (`serviceId`, `slug`),
  INDEX `CatalogueOffering_serviceId_isActive_displayOrder_idx` (`serviceId`, `isActive`, `displayOrder`),
  INDEX `CatalogueOffering_serviceId_isFeatured_idx` (`serviceId`, `isFeatured`),
  INDEX `CatalogueOffering_name_idx` (`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CatalogueOfferingFacet` (
  `id` VARCHAR(30) NOT NULL,
  `offeringId` VARCHAR(30) NOT NULL,
  `facetKey` VARCHAR(80) NOT NULL,
  `facetValue` VARCHAR(120) NOT NULL,
  `label` VARCHAR(160) NOT NULL,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `CatalogueOfferingFacet_offeringId_facetKey_facetValue_key` (`offeringId`, `facetKey`, `facetValue`),
  INDEX `CatalogueOfferingFacet_facetKey_facetValue_idx` (`facetKey`, `facetValue`),
  INDEX `CatalogueOfferingFacet_offeringId_displayOrder_idx` (`offeringId`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CatalogueOfferingGameMode` (
  `offeringId` VARCHAR(30) NOT NULL,
  `gameMode` ENUM('NORMAL', 'IRONMAN', 'HARDCORE_IRONMAN', 'ULTIMATE_IRONMAN') NOT NULL,
  INDEX `CatalogueOfferingGameMode_gameMode_idx` (`gameMode`),
  PRIMARY KEY (`offeringId`, `gameMode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CatalogueOfferingRequirement` (
  `id` VARCHAR(30) NOT NULL,
  `offeringId` VARCHAR(30) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `type` ENUM('SKILL', 'QUEST', 'ITEM', 'ACTIVITY', 'ACCOUNT', 'OTHER') NOT NULL,
  `isRequired` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `verificationMode` ENUM('AUTOMATIC', 'CUSTOMER_CONFIRMED', 'SUPPORT_VERIFIED') NOT NULL,
  `customerGuidance` TEXT NULL,
  `metricKey` VARCHAR(120) NULL,
  `comparisonOperator` ENUM('GREATER_THAN_OR_EQUAL', 'GREATER_THAN', 'EQUAL', 'LESS_THAN_OR_EQUAL', 'LESS_THAN') NULL,
  `requiredValue` INTEGER NULL,
  `recommendedServiceId` VARCHAR(30) NULL,
  `seededKey` VARCHAR(160) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CatalogueOfferingRequirement_seededKey_key` (`seededKey`),
  INDEX `CatalogueOfferingRequirement_offeringId_displayOrder_idx` (`offeringId`, `displayOrder`),
  INDEX `CatalogueOfferingRequirement_recommendedServiceId_idx` (`recommendedServiceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RsnLookupCache` (
  `id` VARCHAR(30) NOT NULL,
  `lookupKey` CHAR(64) NOT NULL,
  `provider` VARCHAR(80) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `payload` JSON NULL,
  `fetchedAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `RsnLookupCache_lookupKey_provider_key` (`lookupKey`, `provider`),
  INDEX `RsnLookupCache_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PublicRateLimitBucket` (
  `id` VARCHAR(30) NOT NULL,
  `identityKey` CHAR(64) NOT NULL,
  `actionKey` VARCHAR(80) NOT NULL,
  `windowStart` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PublicRateLimitBucket_identityKey_actionKey_windowStart_key` (`identityKey`, `actionKey`, `windowStart`),
  INDEX `PublicRateLimitBucket_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CatalogueRequirement`
  ADD CONSTRAINT `CatalogueRequirement_recommendedServiceId_fkey`
  FOREIGN KEY (`recommendedServiceId`) REFERENCES `CatalogueService`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `CatalogueOffering`
  ADD CONSTRAINT `CatalogueOffering_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CatalogueOfferingFacet`
  ADD CONSTRAINT `CatalogueOfferingFacet_offeringId_fkey`
  FOREIGN KEY (`offeringId`) REFERENCES `CatalogueOffering`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CatalogueOfferingGameMode`
  ADD CONSTRAINT `CatalogueOfferingGameMode_offeringId_fkey`
  FOREIGN KEY (`offeringId`) REFERENCES `CatalogueOffering`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CatalogueOfferingRequirement`
  ADD CONSTRAINT `CatalogueOfferingRequirement_offeringId_fkey`
  FOREIGN KEY (`offeringId`) REFERENCES `CatalogueOffering`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CatalogueOfferingRequirement_recommendedServiceId_fkey`
  FOREIGN KEY (`recommendedServiceId`) REFERENCES `CatalogueService`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

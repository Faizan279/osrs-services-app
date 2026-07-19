-- TASK 007: additive premium service configurator configuration.

CREATE TABLE `PremiumServiceConfig` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `normalModeMultiplierBps` INTEGER NOT NULL DEFAULT 0,
  `ironmanMultiplierBps` INTEGER NOT NULL DEFAULT 1000,
  `hardcoreIronmanMultiplierBps` INTEGER NOT NULL DEFAULT 2000,
  `ultimateIronmanMultiplierBps` INTEGER NOT NULL DEFAULT 3000,
  `discordStreamEnabled` BOOLEAN NOT NULL DEFAULT true,
  `discordStreamPercentBps` INTEGER NOT NULL DEFAULT 200,
  `rsnEligibilityEnabled` BOOLEAN NOT NULL DEFAULT true,
  `standardDeliveryEnabled` BOOLEAN NOT NULL DEFAULT true,
  `standardDeliveryLabel` VARCHAR(80) NOT NULL DEFAULT 'Standard',
  `standardDeliveryDescription` VARCHAR(240) NULL,
  `standardDeliveryEstimate` VARCHAR(120) NULL,
  `standardDeliveryMultiplierBps` INTEGER NOT NULL DEFAULT 0,
  `standardDeliveryFixedFeeCents` INTEGER NOT NULL DEFAULT 0,
  `priorityDeliveryEnabled` BOOLEAN NOT NULL DEFAULT false,
  `priorityDeliveryLabel` VARCHAR(80) NOT NULL DEFAULT 'Priority',
  `priorityDeliveryDescription` VARCHAR(240) NULL,
  `priorityDeliveryEstimate` VARCHAR(120) NULL,
  `priorityDeliveryMultiplierBps` INTEGER NOT NULL DEFAULT 1500,
  `priorityDeliveryFixedFeeCents` INTEGER NOT NULL DEFAULT 0,
  `expressDeliveryEnabled` BOOLEAN NOT NULL DEFAULT false,
  `expressDeliveryLabel` VARCHAR(80) NOT NULL DEFAULT 'Express',
  `expressDeliveryDescription` VARCHAR(240) NULL,
  `expressDeliveryEstimate` VARCHAR(120) NULL,
  `expressDeliveryMultiplierBps` INTEGER NOT NULL DEFAULT 3000,
  `expressDeliveryFixedFeeCents` INTEGER NOT NULL DEFAULT 0,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PremiumServiceConfig_serviceId_key` (`serviceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PremiumPackage` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `configId` VARCHAR(30) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `shortDescription` VARCHAR(500) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `basePriceCents` INTEGER NOT NULL DEFAULT 0,
  `minimumPriceCents` INTEGER NOT NULL DEFAULT 0,
  `setupFeeCents` INTEGER NOT NULL DEFAULT 0,
  `estimatedHours` INTEGER NULL,
  `difficultyTierLabel` VARCHAR(120) NULL,
  `requirementsSummary` VARCHAR(500) NULL,
  `gearNotes` TEXT NULL,
  `unlockNotes` TEXT NULL,
  `customerGearRequired` BOOLEAN NOT NULL DEFAULT false,
  `customerGearLabel` VARCHAR(160) NULL,
  `gearUnconfirmedAdjustmentCents` INTEGER NOT NULL DEFAULT 0,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(180) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PremiumPackage_seededKey_key` (`seededKey`),
  UNIQUE INDEX `PremiumPackage_configId_slug_key` (`configId`, `slug`),
  INDEX `PremiumPackage_serviceId_enabled_displayOrder_idx` (`serviceId`, `enabled`, `displayOrder`),
  INDEX `PremiumPackage_configId_enabled_displayOrder_idx` (`configId`, `enabled`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PremiumOption` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `configId` VARCHAR(30) NOT NULL,
  `packageId` VARCHAR(30) NULL,
  `slug` VARCHAR(180) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `optionType` ENUM('ADDON', 'SUPPLIES', 'GEAR_SUPPORT', 'UNLOCK_SUPPORT') NOT NULL DEFAULT 'ADDON',
  `pricingMode` ENUM('FIXED_FEE', 'PERCENT_OF_BASE', 'PER_UNIT') NOT NULL DEFAULT 'FIXED_FEE',
  `fixedPriceCents` INTEGER NOT NULL DEFAULT 0,
  `percentBps` INTEGER NOT NULL DEFAULT 0,
  `perUnitPriceCents` INTEGER NOT NULL DEFAULT 0,
  `minimumQuantity` INTEGER NOT NULL DEFAULT 1,
  `maximumQuantity` INTEGER NOT NULL DEFAULT 1,
  `defaultQuantity` INTEGER NOT NULL DEFAULT 1,
  `customerInputRequired` BOOLEAN NOT NULL DEFAULT false,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(200) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PremiumOption_seededKey_key` (`seededKey`),
  UNIQUE INDEX `PremiumOption_configId_slug_key` (`configId`, `slug`),
  INDEX `PremiumOption_serviceId_enabled_displayOrder_idx` (`serviceId`, `enabled`, `displayOrder`),
  INDEX `PremiumOption_packageId_enabled_displayOrder_idx` (`packageId`, `enabled`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PremiumRequirementGroup` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `configId` VARCHAR(30) NOT NULL,
  `packageId` VARCHAR(30) NULL,
  `title` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(200) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PremiumRequirementGroup_seededKey_key` (`seededKey`),
  INDEX `PremiumRequirementGroup_serviceId_displayOrder_idx` (`serviceId`, `displayOrder`),
  INDEX `PremiumRequirementGroup_configId_displayOrder_idx` (`configId`, `displayOrder`),
  INDEX `PremiumRequirementGroup_packageId_displayOrder_idx` (`packageId`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PremiumRequirement` (
  `id` VARCHAR(30) NOT NULL,
  `groupId` VARCHAR(30) NOT NULL,
  `label` VARCHAR(160) NOT NULL,
  `description` TEXT NOT NULL,
  `isRequired` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `verificationMode` ENUM('AUTOMATIC', 'CUSTOMER_CONFIRMED', 'SUPPORT_VERIFIED') NOT NULL DEFAULT 'CUSTOMER_CONFIRMED',
  `metricKey` VARCHAR(120) NULL,
  `requiredValue` INTEGER NULL,
  `customerGuidance` TEXT NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(220) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PremiumRequirement_seededKey_key` (`seededKey`),
  INDEX `PremiumRequirement_groupId_displayOrder_idx` (`groupId`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PremiumFaq` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `configId` VARCHAR(30) NOT NULL,
  `packageId` VARCHAR(30) NULL,
  `question` VARCHAR(240) NOT NULL,
  `answer` TEXT NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(200) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PremiumFaq_seededKey_key` (`seededKey`),
  INDEX `PremiumFaq_serviceId_enabled_displayOrder_idx` (`serviceId`, `enabled`, `displayOrder`),
  INDEX `PremiumFaq_configId_enabled_displayOrder_idx` (`configId`, `enabled`, `displayOrder`),
  INDEX `PremiumFaq_packageId_enabled_displayOrder_idx` (`packageId`, `enabled`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PremiumServiceConfig`
  ADD CONSTRAINT `PremiumServiceConfig_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PremiumPackage`
  ADD CONSTRAINT `PremiumPackage_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PremiumPackage_configId_fkey`
  FOREIGN KEY (`configId`) REFERENCES `PremiumServiceConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PremiumOption`
  ADD CONSTRAINT `PremiumOption_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PremiumOption_configId_fkey`
  FOREIGN KEY (`configId`) REFERENCES `PremiumServiceConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PremiumOption_packageId_fkey`
  FOREIGN KEY (`packageId`) REFERENCES `PremiumPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PremiumRequirementGroup`
  ADD CONSTRAINT `PremiumRequirementGroup_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PremiumRequirementGroup_configId_fkey`
  FOREIGN KEY (`configId`) REFERENCES `PremiumServiceConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PremiumRequirementGroup_packageId_fkey`
  FOREIGN KEY (`packageId`) REFERENCES `PremiumPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PremiumRequirement`
  ADD CONSTRAINT `PremiumRequirement_groupId_fkey`
  FOREIGN KEY (`groupId`) REFERENCES `PremiumRequirementGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PremiumFaq`
  ADD CONSTRAINT `PremiumFaq_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PremiumFaq_configId_fkey`
  FOREIGN KEY (`configId`) REFERENCES `PremiumServiceConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PremiumFaq_packageId_fkey`
  FOREIGN KEY (`packageId`) REFERENCES `PremiumPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

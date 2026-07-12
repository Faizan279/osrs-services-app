-- TASK 006: additive bossing / PvM calculator configuration.

CREATE TABLE `BossingCalculatorRule` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `normalModeMultiplierBps` INTEGER NOT NULL DEFAULT 0,
  `ironmanMultiplierBps` INTEGER NOT NULL DEFAULT 1000,
  `hardcoreIronmanMultiplierBps` INTEGER NOT NULL DEFAULT 2000,
  `ultimateIronmanMultiplierBps` INTEGER NOT NULL DEFAULT 3000,
  `discordStreamEnabled` BOOLEAN NOT NULL DEFAULT true,
  `discordStreamPercentBps` INTEGER NOT NULL DEFAULT 200,
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
  UNIQUE INDEX `BossingCalculatorRule_serviceId_key` (`serviceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BossingBossConfig` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `bossKey` VARCHAR(120) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `groupLabel` VARCHAR(120) NULL,
  `iconKey` VARCHAR(80) NULL,
  `description` TEXT NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(160) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `BossingBossConfig_seededKey_key` (`seededKey`),
  UNIQUE INDEX `BossingBossConfig_serviceId_bossKey_key` (`serviceId`, `bossKey`),
  INDEX `BossingBossConfig_serviceId_enabled_displayOrder_idx` (`serviceId`, `enabled`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BossingMethod` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `bossId` VARCHAR(30) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `shortDescription` VARCHAR(500) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `priceMode` ENUM('PER_KILL', 'FIXED_PACKAGE') NOT NULL DEFAULT 'PER_KILL',
  `minimumKillCount` INTEGER NOT NULL DEFAULT 1,
  `maximumKillCount` INTEGER NULL,
  `basePriceCentsPerKill` INTEGER NOT NULL DEFAULT 0,
  `fixedPackagePriceCents` INTEGER NOT NULL DEFAULT 0,
  `minimumPriceCents` INTEGER NOT NULL DEFAULT 0,
  `setupFeeCents` INTEGER NOT NULL DEFAULT 0,
  `difficultyTierLabel` VARCHAR(120) NULL,
  `expectedRequirementsSummary` VARCHAR(500) NULL,
  `gearNotes` TEXT NULL,
  `supplyNotes` TEXT NULL,
  `suppliesEnabled` BOOLEAN NOT NULL DEFAULT false,
  `suppliesLabel` VARCHAR(120) NULL,
  `suppliesFeeCents` INTEGER NOT NULL DEFAULT 0,
  `customerGearRequired` BOOLEAN NOT NULL DEFAULT false,
  `customerGearLabel` VARCHAR(160) NULL,
  `gearAdjustmentCents` INTEGER NOT NULL DEFAULT 0,
  `estimatedKillsPerHour` INTEGER NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(180) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `BossingMethod_seededKey_key` (`seededKey`),
  UNIQUE INDEX `BossingMethod_bossId_slug_key` (`bossId`, `slug`),
  INDEX `BossingMethod_serviceId_enabled_displayOrder_idx` (`serviceId`, `enabled`, `displayOrder`),
  INDEX `BossingMethod_bossId_enabled_displayOrder_idx` (`bossId`, `enabled`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BossingStatRequirement` (
  `id` VARCHAR(30) NOT NULL,
  `methodId` VARCHAR(30) NOT NULL,
  `metricKey` VARCHAR(120) NOT NULL,
  `label` VARCHAR(160) NOT NULL,
  `requiredLevel` INTEGER NOT NULL,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `verificationMode` ENUM('AUTOMATIC', 'CUSTOMER_CONFIRMED', 'SUPPORT_VERIFIED') NOT NULL DEFAULT 'AUTOMATIC',
  `customerGuidance` TEXT NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(200) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `BossingStatRequirement_seededKey_key` (`seededKey`),
  INDEX `BossingStatRequirement_methodId_displayOrder_idx` (`methodId`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BossingGearRequirement` (
  `id` VARCHAR(30) NOT NULL,
  `methodId` VARCHAR(30) NOT NULL,
  `label` VARCHAR(160) NOT NULL,
  `description` TEXT NOT NULL,
  `isRequired` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `verificationMode` ENUM('AUTOMATIC', 'CUSTOMER_CONFIRMED', 'SUPPORT_VERIFIED') NOT NULL DEFAULT 'CUSTOMER_CONFIRMED',
  `customerGuidance` TEXT NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(200) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `BossingGearRequirement_seededKey_key` (`seededKey`),
  INDEX `BossingGearRequirement_methodId_displayOrder_idx` (`methodId`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BossingCalculatorRule`
  ADD CONSTRAINT `BossingCalculatorRule_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BossingBossConfig`
  ADD CONSTRAINT `BossingBossConfig_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BossingMethod`
  ADD CONSTRAINT `BossingMethod_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BossingMethod_bossId_fkey`
  FOREIGN KEY (`bossId`) REFERENCES `BossingBossConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BossingStatRequirement`
  ADD CONSTRAINT `BossingStatRequirement_methodId_fkey`
  FOREIGN KEY (`methodId`) REFERENCES `BossingMethod`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BossingGearRequirement`
  ADD CONSTRAINT `BossingGearRequirement_methodId_fkey`
  FOREIGN KEY (`methodId`) REFERENCES `BossingMethod`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

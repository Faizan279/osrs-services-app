-- TASK 005: additive skilling calculator configuration.

CREATE TABLE `SkillingSkillConfig` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `skillKey` ENUM('ATTACK', 'STRENGTH', 'DEFENCE', 'RANGED', 'PRAYER', 'MAGIC', 'RUNECRAFT', 'CONSTRUCTION', 'HITPOINTS', 'AGILITY', 'HERBLORE', 'THIEVING', 'CRAFTING', 'FLETCHING', 'SLAYER', 'HUNTER', 'MINING', 'SMITHING', 'FISHING', 'COOKING', 'FIREMAKING', 'WOODCUTTING', 'FARMING') NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `iconKey` VARCHAR(80) NULL,
  `seededKey` VARCHAR(140) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `SkillingSkillConfig_seededKey_key` (`seededKey`),
  UNIQUE INDEX `SkillingSkillConfig_serviceId_skillKey_key` (`serviceId`, `skillKey`),
  INDEX `SkillingSkillConfig_serviceId_enabled_displayOrder_idx` (`serviceId`, `enabled`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SkillingTrainingMethod` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `skillConfigId` VARCHAR(30) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `shortDescription` VARCHAR(500) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `minimumLevel` INTEGER NOT NULL DEFAULT 1,
  `maximumLevel` INTEGER NOT NULL DEFAULT 99,
  `xpPerHour` INTEGER NULL,
  `basePriceCentsPerMillionXp` INTEGER NOT NULL,
  `minimumPriceCents` INTEGER NOT NULL DEFAULT 0,
  `fixedFeeCents` INTEGER NOT NULL DEFAULT 0,
  `suppliesEnabled` BOOLEAN NOT NULL DEFAULT false,
  `suppliesLabel` VARCHAR(120) NULL,
  `suppliesFeeCents` INTEGER NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `seededKey` VARCHAR(160) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `SkillingTrainingMethod_seededKey_key` (`seededKey`),
  UNIQUE INDEX `SkillingTrainingMethod_skillConfigId_slug_key` (`skillConfigId`, `slug`),
  INDEX `SkillingTrainingMethod_serviceId_enabled_displayOrder_idx` (`serviceId`, `enabled`, `displayOrder`),
  INDEX `SkillingTrainingMethod_skillConfigId_enabled_displayOrder_idx` (`skillConfigId`, `enabled`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SkillingCalculatorRule` (
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
  UNIQUE INDEX `SkillingCalculatorRule_serviceId_key` (`serviceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SkillingSkillConfig`
  ADD CONSTRAINT `SkillingSkillConfig_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SkillingTrainingMethod`
  ADD CONSTRAINT `SkillingTrainingMethod_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SkillingTrainingMethod_skillConfigId_fkey`
  FOREIGN KEY (`skillConfigId`) REFERENCES `SkillingSkillConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SkillingCalculatorRule`
  ADD CONSTRAINT `SkillingCalculatorRule_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

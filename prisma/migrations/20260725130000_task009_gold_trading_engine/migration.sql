-- TASK 009: additive gold trading, rates and inventory engine.

CREATE TABLE `GoldMarket` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `publicName` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `description` TEXT NOT NULL,
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `availabilityState` ENUM('AVAILABLE', 'LIMITED_AVAILABILITY', 'MANUAL_REVIEW_REQUIRED', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'PAUSED',
  `publicTradeInstructions` TEXT NOT NULL,
  `internalInstructions` TEXT NULL,
  `rsnRequired` BOOLEAN NOT NULL DEFAULT true,
  `secureServiceEnabled` BOOLEAN NOT NULL DEFAULT false,
  `secureServicePricingMode` ENUM('DISABLED', 'FIXED_MINOR_UNITS', 'BASIS_POINTS') NOT NULL DEFAULT 'DISABLED',
  `secureServiceFixedMinorUnits` INTEGER NOT NULL DEFAULT 0,
  `secureServiceBps` INTEGER NOT NULL DEFAULT 0,
  `secureServiceCustomerBuys` BOOLEAN NOT NULL DEFAULT true,
  `secureServiceCustomerSells` BOOLEAN NOT NULL DEFAULT false,
  `quoteValidityMinutes` INTEGER NOT NULL DEFAULT 15,
  `stockQuantityGp` BIGINT NOT NULL DEFAULT 0,
  `buyingCapacityGp` BIGINT NOT NULL DEFAULT 0,
  `stockVersion` INTEGER NOT NULL DEFAULT 1,
  `draftVersion` INTEGER NOT NULL DEFAULT 1,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `GoldMarket_stableKey_key` (`stableKey`),
  UNIQUE INDEX `GoldMarket_serviceId_key` (`serviceId`),
  UNIQUE INDEX `GoldMarket_slug_key` (`slug`),
  INDEX `GoldMarket_serviceId_idx` (`serviceId`),
  INDEX `GoldMarket_availabilityState_idx` (`availabilityState`),
  INDEX `GoldMarket_currencyCode_idx` (`currencyCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GoldRateSet` (
  `id` VARCHAR(30) NOT NULL,
  `marketId` VARCHAR(30) NOT NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `version` INTEGER NOT NULL DEFAULT 1,
  `publishedAt` DATETIME(3) NULL,
  `publishedById` VARCHAR(30) NULL,
  `internalNotes` TEXT NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `GoldRateSet_marketId_status_updatedAt_idx` (`marketId`, `status`, `updatedAt`),
  INDEX `GoldRateSet_publishedById_idx` (`publishedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GoldRate` (
  `id` VARCHAR(30) NOT NULL,
  `rateSetId` VARCHAR(30) NOT NULL,
  `direction` ENUM('CUSTOMER_BUYS_GOLD', 'CUSTOMER_SELLS_GOLD') NOT NULL,
  `rateMinorUnitsPerMillion` INTEGER NOT NULL,
  `minimumQuantityGp` BIGINT NOT NULL,
  `maximumQuantityGp` BIGINT NOT NULL,
  `automaticReviewMaximumGp` BIGINT NOT NULL,
  `effectiveStart` DATETIME(3) NOT NULL,
  `effectiveEnd` DATETIME(3) NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `GoldRate_rateSetId_direction_key` (`rateSetId`, `direction`),
  INDEX `GoldRate_direction_enabled_effectiveStart_effectiveEnd_idx` (`direction`, `enabled`, `effectiveStart`, `effectiveEnd`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GoldRateRevision` (
  `id` VARCHAR(30) NOT NULL,
  `marketId` VARCHAR(30) NOT NULL,
  `rateSetId` VARCHAR(30) NULL,
  `revisionNumber` INTEGER NOT NULL,
  `snapshotSchemaVersion` INTEGER NOT NULL DEFAULT 1,
  `snapshot` JSON NOT NULL,
  `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `GoldRateRevision_marketId_revisionNumber_key` (`marketId`, `revisionNumber`),
  INDEX `GoldRateRevision_marketId_publishedAt_idx` (`marketId`, `publishedAt`),
  INDEX `GoldRateRevision_publishedById_idx` (`publishedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GoldQuantityPreset` (
  `id` VARCHAR(30) NOT NULL,
  `marketId` VARCHAR(30) NOT NULL,
  `direction` ENUM('CUSTOMER_BUYS_GOLD', 'CUSTOMER_SELLS_GOLD') NOT NULL,
  `publicLabel` VARCHAR(80) NOT NULL,
  `quantityGp` BIGINT NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `seededKey` VARCHAR(160) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `GoldQuantityPreset_seededKey_key` (`seededKey`),
  INDEX `GoldQuantityPreset_marketId_direction_enabled_sortOrder_idx` (`marketId`, `direction`, `enabled`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GoldInventoryLedgerEntry` (
  `id` VARCHAR(30) NOT NULL,
  `marketId` VARCHAR(30) NOT NULL,
  `entryType` ENUM('STOCK_INCREASE', 'STOCK_DECREASE', 'BUY_CAPACITY_INCREASE', 'BUY_CAPACITY_DECREASE', 'CORRECTION') NOT NULL,
  `quantityGp` BIGINT NOT NULL,
  `resultingStockQuantityGp` BIGINT NOT NULL,
  `resultingBuyingCapacityGp` BIGINT NOT NULL,
  `reason` VARCHAR(240) NOT NULL,
  `internalNote` TEXT NULL,
  `actorId` VARCHAR(30) NULL,
  `referenceKey` VARCHAR(160) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `GoldInventoryLedgerEntry_referenceKey_key` (`referenceKey`),
  INDEX `GoldInventoryLedgerEntry_marketId_createdAt_idx` (`marketId`, `createdAt`),
  INDEX `GoldInventoryLedgerEntry_entryType_createdAt_idx` (`entryType`, `createdAt`),
  INDEX `GoldInventoryLedgerEntry_actorId_createdAt_idx` (`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GoldMarket`
  ADD CONSTRAINT `GoldMarket_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GoldRateSet`
  ADD CONSTRAINT `GoldRateSet_marketId_fkey`
  FOREIGN KEY (`marketId`) REFERENCES `GoldMarket`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GoldRateSet`
  ADD CONSTRAINT `GoldRateSet_publishedById_fkey`
  FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GoldRate`
  ADD CONSTRAINT `GoldRate_rateSetId_fkey`
  FOREIGN KEY (`rateSetId`) REFERENCES `GoldRateSet`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GoldRateRevision`
  ADD CONSTRAINT `GoldRateRevision_marketId_fkey`
  FOREIGN KEY (`marketId`) REFERENCES `GoldMarket`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GoldRateRevision`
  ADD CONSTRAINT `GoldRateRevision_publishedById_fkey`
  FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GoldQuantityPreset`
  ADD CONSTRAINT `GoldQuantityPreset_marketId_fkey`
  FOREIGN KEY (`marketId`) REFERENCES `GoldMarket`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GoldInventoryLedgerEntry`
  ADD CONSTRAINT `GoldInventoryLedgerEntry_marketId_fkey`
  FOREIGN KEY (`marketId`) REFERENCES `GoldMarket`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `GoldInventoryLedgerEntry`
  ADD CONSTRAINT `GoldInventoryLedgerEntry_actorId_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

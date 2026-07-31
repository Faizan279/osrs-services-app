-- TASK 012: additive product marketplace and inventory reservation engine.

CREATE TABLE `ProductMarketplace` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `publicName` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `description` TEXT NOT NULL,
  `publicMarketplaceInstructions` TEXT NOT NULL,
  `internalNotes` TEXT NULL,
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `availabilityState` ENUM('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'MANUAL_REVIEW_REQUIRED', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'PAUSED',
  `defaultSort` VARCHAR(40) NOT NULL DEFAULT 'featured',
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductMarketplace_stableKey_key` (`stableKey`),
  UNIQUE INDEX `ProductMarketplace_serviceId_key` (`serviceId`),
  UNIQUE INDEX `ProductMarketplace_slug_key` (`slug`),
  INDEX `ProductMarketplace_serviceId_idx` (`serviceId`),
  INDEX `ProductMarketplace_availability_idx` (`availabilityState`),
  INDEX `ProductMarketplace_currency_idx` (`currencyCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductCategory` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `marketplaceId` VARCHAR(30) NOT NULL,
  `publicName` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `publicDescription` TEXT NULL,
  `productType` ENUM('ITEM', 'BOND', 'OUTFIT') NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductCategory_stableKey_key` (`stableKey`),
  UNIQUE INDEX `ProductCategory_slug_key` (`slug`),
  INDEX `ProductCategory_marketplace_idx` (`marketplaceId`, `enabled`, `sortOrder`),
  INDEX `ProductCategory_type_idx` (`productType`, `enabled`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Product` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `marketplaceId` VARCHAR(30) NOT NULL,
  `categoryId` VARCHAR(30) NOT NULL,
  `publicTitle` VARCHAR(180) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `shortDescription` VARCHAR(500) NOT NULL,
  `fullDescription` TEXT NOT NULL,
  `internalReferenceCode` VARCHAR(120) NOT NULL,
  `productType` ENUM('ITEM', 'BOND', 'OUTFIT') NOT NULL,
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `isFeatured` BOOLEAN NOT NULL DEFAULT false,
  `publicBadgeText` VARCHAR(120) NULL,
  `publicationStatus` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `availabilityState` ENUM('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'MANUAL_REVIEW_REQUIRED', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'PAUSED',
  `defaultImagePath` VARCHAR(500) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `publishedAt` DATETIME(3) NULL,
  `archivedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Product_stableKey_key` (`stableKey`),
  UNIQUE INDEX `Product_internalReferenceCode_key` (`internalReferenceCode`),
  UNIQUE INDEX `Product_marketplace_slug_key` (`marketplaceId`, `slug`),
  INDEX `Product_marketplace_public_idx` (`marketplaceId`, `publicationStatus`, `availabilityState`, `sortOrder`),
  INDEX `Product_category_public_idx` (`categoryId`, `publicationStatus`, `sortOrder`),
  INDEX `Product_type_public_idx` (`productType`, `publicationStatus`, `sortOrder`),
  INDEX `Product_featured_idx` (`isFeatured`, `sortOrder`),
  INDEX `Product_publishedAt_idx` (`publishedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductVariant` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `productId` VARCHAR(30) NOT NULL,
  `publicName` VARCHAR(160) NOT NULL,
  `publicSku` VARCHAR(120) NULL,
  `internalSku` VARCHAR(120) NOT NULL,
  `unitLabel` VARCHAR(80) NOT NULL DEFAULT 'unit',
  `priceMode` ENUM('FIXED_UNIT', 'QUANTITY_TIER', 'FIXED_PACKAGE', 'MANUAL_REVIEW') NOT NULL DEFAULT 'FIXED_UNIT',
  `baseUnitPriceCents` INTEGER NOT NULL DEFAULT 0,
  `minimumQuantity` BIGINT NOT NULL DEFAULT 1,
  `maximumQuantity` BIGINT NOT NULL DEFAULT 1,
  `quantityIncrement` BIGINT NOT NULL DEFAULT 1,
  `stockMode` ENUM('TRACKED', 'UNLIMITED', 'MANUAL_REVIEW') NOT NULL DEFAULT 'TRACKED',
  `availabilityState` ENUM('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'MANUAL_REVIEW_REQUIRED', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'PAUSED',
  `status` ENUM('AVAILABLE', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
  `onHandQuantity` BIGINT NOT NULL DEFAULT 0,
  `lowStockThreshold` BIGINT NOT NULL DEFAULT 0,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductVariant_stableKey_key` (`stableKey`),
  UNIQUE INDEX `ProductVariant_internalSku_key` (`internalSku`),
  INDEX `ProductVariant_product_enabled_idx` (`productId`, `enabled`, `sortOrder`),
  INDEX `ProductVariant_product_status_idx` (`productId`, `status`, `availabilityState`),
  INDEX `ProductVariant_priceMode_idx` (`priceMode`),
  INDEX `ProductVariant_stockMode_idx` (`stockMode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductPriceTier` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `variantId` VARCHAR(30) NOT NULL,
  `minimumQuantity` BIGINT NOT NULL,
  `maximumQuantity` BIGINT NULL,
  `unitPriceCents` INTEGER NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductPriceTier_stableKey_key` (`stableKey`),
  INDEX `ProductPriceTier_variant_enabled_idx` (`variantId`, `enabled`, `minimumQuantity`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductTag` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `marketplaceId` VARCHAR(30) NOT NULL,
  `publicLabel` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductTag_stableKey_key` (`stableKey`),
  UNIQUE INDEX `ProductTag_marketplace_slug_key` (`marketplaceId`, `slug`),
  INDEX `ProductTag_marketplace_enabled_idx` (`marketplaceId`, `enabled`, `slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductTagAssignment` (
  `productId` VARCHAR(30) NOT NULL,
  `tagId` VARCHAR(30) NOT NULL,
  INDEX `ProductTagAssignment_tagId_idx` (`tagId`),
  PRIMARY KEY (`productId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductImage` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `productId` VARCHAR(30) NOT NULL,
  `imageType` ENUM('COVER', 'GALLERY', 'PACKAGE') NOT NULL DEFAULT 'GALLERY',
  `assetPath` VARCHAR(500) NOT NULL,
  `altText` VARCHAR(240) NOT NULL,
  `caption` VARCHAR(240) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isPublic` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductImage_stableKey_key` (`stableKey`),
  INDEX `ProductImage_product_public_idx` (`productId`, `imageType`, `isPublic`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductRevision` (
  `id` VARCHAR(30) NOT NULL,
  `productId` VARCHAR(30) NOT NULL,
  `revisionNumber` INTEGER NOT NULL,
  `snapshotSchemaVersion` INTEGER NOT NULL DEFAULT 1,
  `snapshot` JSON NOT NULL,
  `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ProductRevision_product_revision_key` (`productId`, `revisionNumber`),
  INDEX `ProductRevision_product_published_idx` (`productId`, `publishedAt`),
  INDEX `ProductRevision_publishedBy_idx` (`publishedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductInventoryReservation` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `variantId` VARCHAR(30) NOT NULL,
  `quantity` BIGINT NOT NULL,
  `status` ENUM('ACTIVE', 'RELEASED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `expiresAt` DATETIME(3) NOT NULL,
  `releasedAt` DATETIME(3) NULL,
  `safeInternalPurpose` VARCHAR(240) NOT NULL,
  `actorId` VARCHAR(30) NULL,
  `idempotencyKey` VARCHAR(160) NULL,
  `futureExternalRef` VARCHAR(160) NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ProductReservation_stableKey_key` (`stableKey`),
  UNIQUE INDEX `ProductReservation_idempotency_key` (`idempotencyKey`),
  INDEX `ProductReservation_variant_status_idx` (`variantId`, `status`, `expiresAt`),
  INDEX `ProductReservation_actor_idx` (`actorId`, `createdAt`),
  INDEX `ProductReservation_future_ref_idx` (`futureExternalRef`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductInventoryLedgerEntry` (
  `id` VARCHAR(30) NOT NULL,
  `variantId` VARCHAR(30) NOT NULL,
  `entryType` ENUM('STOCK_IN', 'STOCK_OUT', 'CORRECTION_IN', 'CORRECTION_OUT', 'INITIAL_BALANCE') NOT NULL,
  `quantity` BIGINT NOT NULL,
  `resultingOnHandQuantity` BIGINT NOT NULL,
  `reason` VARCHAR(240) NOT NULL,
  `internalNote` TEXT NULL,
  `actorId` VARCHAR(30) NULL,
  `referenceKey` VARCHAR(160) NULL,
  `reservationId` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ProductLedger_reference_key` (`referenceKey`),
  INDEX `ProductLedger_variant_created_idx` (`variantId`, `createdAt`),
  INDEX `ProductLedger_entry_created_idx` (`entryType`, `createdAt`),
  INDEX `ProductLedger_actor_created_idx` (`actorId`, `createdAt`),
  INDEX `ProductLedger_reservation_idx` (`reservationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductReservationEvent` (
  `id` VARCHAR(30) NOT NULL,
  `reservationId` VARCHAR(30) NOT NULL,
  `eventType` ENUM('ACTIVE', 'RELEASED', 'EXPIRED', 'CANCELLED') NOT NULL,
  `safeMetadata` JSON NULL,
  `actorId` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ProductReservationEvent_reservation_idx` (`reservationId`, `createdAt`),
  INDEX `ProductReservationEvent_event_idx` (`eventType`, `createdAt`),
  INDEX `ProductReservationEvent_actor_idx` (`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductMarketplace`
  ADD CONSTRAINT `ProductMarketplace_service_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductCategory`
  ADD CONSTRAINT `ProductCategory_marketplace_fkey`
  FOREIGN KEY (`marketplaceId`) REFERENCES `ProductMarketplace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Product`
  ADD CONSTRAINT `Product_marketplace_fkey`
  FOREIGN KEY (`marketplaceId`) REFERENCES `ProductMarketplace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `Product_category_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductVariant`
  ADD CONSTRAINT `ProductVariant_product_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProductPriceTier`
  ADD CONSTRAINT `ProductPriceTier_variant_fkey`
  FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProductTag`
  ADD CONSTRAINT `ProductTag_marketplace_fkey`
  FOREIGN KEY (`marketplaceId`) REFERENCES `ProductMarketplace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductTagAssignment`
  ADD CONSTRAINT `ProductTagAssignment_product_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductTagAssignment_tag_fkey`
  FOREIGN KEY (`tagId`) REFERENCES `ProductTag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductImage`
  ADD CONSTRAINT `ProductImage_product_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProductRevision`
  ADD CONSTRAINT `ProductRevision_product_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductRevision_publishedBy_fkey`
  FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ProductInventoryReservation`
  ADD CONSTRAINT `ProductReservation_variant_fkey`
  FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductReservation_actor_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ProductInventoryLedgerEntry`
  ADD CONSTRAINT `ProductLedger_variant_fkey`
  FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductLedger_actor_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductLedger_reservation_fkey`
  FOREIGN KEY (`reservationId`) REFERENCES `ProductInventoryReservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ProductReservationEvent`
  ADD CONSTRAINT `ProductReservationEvent_reservation_fkey`
  FOREIGN KEY (`reservationId`) REFERENCES `ProductInventoryReservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductReservationEvent_actor_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

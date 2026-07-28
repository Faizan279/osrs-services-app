-- TASK 010: additive account marketplace engine.

CREATE TABLE `AccountMarketplace` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `publicName` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `description` TEXT NOT NULL,
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `availabilityState` ENUM('AVAILABLE', 'HELD', 'SOLD', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'PAUSED',
  `publicMarketplaceInstructions` TEXT NOT NULL,
  `internalNotes` TEXT NULL,
  `defaultSort` VARCHAR(40) NOT NULL DEFAULT 'featured',
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `draftVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountMarketplace_stableKey_key` (`stableKey`),
  UNIQUE INDEX `AccountMarketplace_serviceId_key` (`serviceId`),
  UNIQUE INDEX `AccountMarketplace_slug_key` (`slug`),
  INDEX `AccountMarketplace_serviceId_idx` (`serviceId`),
  INDEX `AccountMarketplace_availability_idx` (`availabilityState`),
  INDEX `AccountMarketplace_currency_idx` (`currencyCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountListing` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `marketplaceId` VARCHAR(30) NOT NULL,
  `publicTitle` VARCHAR(180) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `shortDescription` VARCHAR(500) NOT NULL,
  `fullDescription` TEXT NOT NULL,
  `internalReferenceCode` VARCHAR(120) NOT NULL,
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `basePriceCents` INTEGER NOT NULL,
  `gameMode` ENUM('NORMAL', 'IRONMAN', 'HARDCORE_IRONMAN', 'ULTIMATE_IRONMAN') NOT NULL DEFAULT 'NORMAL',
  `combatLevel` INTEGER NULL,
  `totalLevel` INTEGER NULL,
  `questPoints` INTEGER NULL,
  `accountAgeLabel` VARCHAR(120) NULL,
  `membershipStateLabel` VARCHAR(120) NULL,
  `availability` ENUM('AVAILABLE', 'HELD', 'SOLD', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'PAUSED',
  `publicationStatus` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `approvalStatus` ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
  `isFeatured` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `publicBadgeText` VARCHAR(120) NULL,
  `rejectionReason` TEXT NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `publishedAt` DATETIME(3) NULL,
  `archivedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountListing_stableKey_key` (`stableKey`),
  UNIQUE INDEX `AccountListing_internalReferenceCode_key` (`internalReferenceCode`),
  UNIQUE INDEX `AccountListing_marketplaceId_slug_key` (`marketplaceId`, `slug`),
  INDEX `AccountListing_public_idx` (`marketplaceId`, `publicationStatus`, `approvalStatus`, `availability`, `sortOrder`),
  INDEX `AccountListing_featured_idx` (`marketplaceId`, `isFeatured`, `sortOrder`),
  INDEX `AccountListing_price_idx` (`basePriceCents`),
  INDEX `AccountListing_combat_idx` (`combatLevel`),
  INDEX `AccountListing_total_idx` (`totalLevel`),
  INDEX `AccountListing_gameMode_idx` (`gameMode`),
  INDEX `AccountListing_publishedAt_idx` (`publishedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountListingStat` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `listingId` VARCHAR(30) NOT NULL,
  `statKey` VARCHAR(80) NOT NULL,
  `publicLabel` VARCHAR(120) NOT NULL,
  `value` INTEGER NOT NULL,
  `maximumValue` INTEGER NULL,
  `statType` ENUM('SKILL', 'COMBAT', 'QUEST', 'SUMMARY', 'OTHER') NOT NULL DEFAULT 'SKILL',
  `statGroup` VARCHAR(120) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isPublic` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountListingStat_stableKey_key` (`stableKey`),
  UNIQUE INDEX `AccountListingStat_listingId_statKey_key` (`listingId`, `statKey`),
  INDEX `AccountListingStat_public_idx` (`listingId`, `isPublic`, `sortOrder`),
  INDEX `AccountListingStat_filter_idx` (`statKey`, `value`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountListingUnlock` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `listingId` VARCHAR(30) NOT NULL,
  `unlockKey` VARCHAR(100) NOT NULL,
  `publicLabel` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `unlockType` ENUM('QUEST', 'DIARY', 'MINIGAME', 'BOSS_ACCESS', 'RAID', 'PRAYER', 'SPELLBOOK', 'TRANSPORTATION', 'UNTRADEABLE', 'ACCOUNT_PROGRESSION', 'OTHER') NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isPublic` BOOLEAN NOT NULL DEFAULT true,
  `filterable` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountListingUnlock_stableKey_key` (`stableKey`),
  UNIQUE INDEX `AccountListingUnlock_listingId_unlockKey_key` (`listingId`, `unlockKey`),
  INDEX `AccountListingUnlock_public_idx` (`listingId`, `isPublic`, `sortOrder`),
  INDEX `AccountListingUnlock_filter_idx` (`unlockKey`, `filterable`),
  INDEX `AccountListingUnlock_type_idx` (`unlockType`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountListingFeature` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `listingId` VARCHAR(30) NOT NULL,
  `featureKey` VARCHAR(100) NOT NULL,
  `publicLabel` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isPublic` BOOLEAN NOT NULL DEFAULT true,
  `filterable` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountListingFeature_stableKey_key` (`stableKey`),
  UNIQUE INDEX `AccountListingFeature_listingId_featureKey_key` (`listingId`, `featureKey`),
  INDEX `AccountListingFeature_public_idx` (`listingId`, `isPublic`, `sortOrder`),
  INDEX `AccountListingFeature_filter_idx` (`featureKey`, `filterable`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountListingImage` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `listingId` VARCHAR(30) NOT NULL,
  `imageType` ENUM('COVER', 'GALLERY', 'STAT_OVERVIEW', 'UNLOCK_OVERVIEW') NOT NULL DEFAULT 'GALLERY',
  `assetPath` VARCHAR(500) NOT NULL,
  `altText` VARCHAR(240) NOT NULL,
  `caption` VARCHAR(240) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isPublic` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountListingImage_stableKey_key` (`stableKey`),
  INDEX `AccountListingImage_public_idx` (`listingId`, `imageType`, `isPublic`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountListingRevision` (
  `id` VARCHAR(30) NOT NULL,
  `listingId` VARCHAR(30) NOT NULL,
  `revisionNumber` INTEGER NOT NULL,
  `snapshotSchemaVersion` INTEGER NOT NULL DEFAULT 1,
  `snapshot` JSON NOT NULL,
  `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `AccountListingRevision_listingId_revisionNumber_key` (`listingId`, `revisionNumber`),
  INDEX `AccountListingRevision_listing_published_idx` (`listingId`, `publishedAt`),
  INDEX `AccountListingRevision_publishedBy_idx` (`publishedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountListingHold` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `listingId` VARCHAR(30) NOT NULL,
  `status` ENUM('ACTIVE', 'RELEASED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `previousAvailability` ENUM('AVAILABLE', 'HELD', 'SOLD', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
  `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `reason` VARCHAR(240) NOT NULL,
  `createdById` VARCHAR(30) NULL,
  `releasedAt` DATETIME(3) NULL,
  `releasedById` VARCHAR(30) NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountListingHold_stableKey_key` (`stableKey`),
  INDEX `AccountListingHold_status_idx` (`listingId`, `status`, `expiresAt`),
  INDEX `AccountListingHold_createdBy_idx` (`createdById`, `createdAt`),
  INDEX `AccountListingHold_releasedBy_idx` (`releasedById`, `releasedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountListingHandoverChecklist` (
  `id` VARCHAR(30) NOT NULL,
  `listingId` VARCHAR(30) NOT NULL,
  `listingSecurityReviewed` BOOLEAN NOT NULL DEFAULT false,
  `emailTransferRequired` BOOLEAN NOT NULL DEFAULT true,
  `recoveryReviewRequired` BOOLEAN NOT NULL DEFAULT true,
  `authenticatorResetRequired` BOOLEAN NOT NULL DEFAULT true,
  `bankPinResetRequired` BOOLEAN NOT NULL DEFAULT true,
  `previousSessionsReviewRequired` BOOLEAN NOT NULL DEFAULT true,
  `handoverInstructionsPrepared` BOOLEAN NOT NULL DEFAULT false,
  `ownershipEvidenceReviewed` BOOLEAN NOT NULL DEFAULT false,
  `readyForFutureHandover` BOOLEAN NOT NULL DEFAULT false,
  `finalAdminApprovalRequired` BOOLEAN NOT NULL DEFAULT true,
  `readiness` ENUM('INTERNAL_REVIEW_REQUIRED', 'READY_FOR_FUTURE_HANDOVER', 'NEEDS_MANUAL_REVIEW') NOT NULL DEFAULT 'INTERNAL_REVIEW_REQUIRED',
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountHandover_listingId_key` (`listingId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AccountMarketplace`
  ADD CONSTRAINT `AccountMarketplace_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AccountListing`
  ADD CONSTRAINT `AccountListing_marketplaceId_fkey`
  FOREIGN KEY (`marketplaceId`) REFERENCES `AccountMarketplace`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AccountListingStat`
  ADD CONSTRAINT `AccountListingStat_listingId_fkey`
  FOREIGN KEY (`listingId`) REFERENCES `AccountListing`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AccountListingUnlock`
  ADD CONSTRAINT `AccountListingUnlock_listingId_fkey`
  FOREIGN KEY (`listingId`) REFERENCES `AccountListing`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AccountListingFeature`
  ADD CONSTRAINT `AccountListingFeature_listingId_fkey`
  FOREIGN KEY (`listingId`) REFERENCES `AccountListing`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AccountListingImage`
  ADD CONSTRAINT `AccountListingImage_listingId_fkey`
  FOREIGN KEY (`listingId`) REFERENCES `AccountListing`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AccountListingRevision`
  ADD CONSTRAINT `AccountListingRevision_listingId_fkey`
  FOREIGN KEY (`listingId`) REFERENCES `AccountListing`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AccountListingRevision`
  ADD CONSTRAINT `AccountListingRevision_publishedById_fkey`
  FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AccountListingHold`
  ADD CONSTRAINT `AccountListingHold_listingId_fkey`
  FOREIGN KEY (`listingId`) REFERENCES `AccountListing`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AccountListingHold`
  ADD CONSTRAINT `AccountListingHold_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AccountListingHold`
  ADD CONSTRAINT `AccountListingHold_releasedById_fkey`
  FOREIGN KEY (`releasedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AccountListingHandoverChecklist`
  ADD CONSTRAINT `AccountHandover_listingId_fkey`
  FOREIGN KEY (`listingId`) REFERENCES `AccountListing`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

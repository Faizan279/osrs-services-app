-- CreateTable
CREATE TABLE `CatalogueCategory` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `shortDescription` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `iconKey` VARCHAR(80) NULL,
    `imagePath` VARCHAR(500) NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `seoTitle` VARCHAR(191) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `seededKey` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CatalogueCategory_slug_key`(`slug`),
    UNIQUE INDEX `CatalogueCategory_seededKey_key`(`seededKey`),
    INDEX `CatalogueCategory_isActive_displayOrder_idx`(`isActive`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogueService` (
    `id` VARCHAR(30) NOT NULL,
    `categoryId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `canonicalSlug` VARCHAR(191) NOT NULL,
    `shortSummary` VARCHAR(500) NOT NULL,
    `content` TEXT NOT NULL,
    `serviceType` ENUM('SERVICE', 'PRODUCT', 'MARKETPLACE') NOT NULL DEFAULT 'SERVICE',
    `engineType` ENUM('CATALOGUE_CARD', 'SKILLING_CALCULATOR', 'BOSSING_ENGINE', 'PREMIUM_SERVICE_CONFIGURATOR', 'GOLD_ENGINE', 'ACCOUNT_MARKETPLACE', 'CUSTOM_ACCOUNT_BUILD', 'PRODUCT_MARKETPLACE') NOT NULL,
    `publicationStatus` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `availabilityState` ENUM('AVAILABLE', 'PAUSED', 'QUOTE_ONLY', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `isQuoteOnly` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `internalNotes` TEXT NULL,
    `publicPreparationNotes` TEXT NULL,
    `primaryMediaPath` VARCHAR(500) NULL,
    `seoTitle` VARCHAR(191) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `publishAt` DATETIME(3) NULL,
    `unpublishAt` DATETIME(3) NULL,
    `createdById` VARCHAR(30) NULL,
    `updatedById` VARCHAR(30) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `legacySource` JSON NULL,
    `seededKey` VARCHAR(100) NULL,
    `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CatalogueService_canonicalSlug_key`(`canonicalSlug`),
    UNIQUE INDEX `CatalogueService_seededKey_key`(`seededKey`),
    INDEX `CatalogueService_publicationStatus_publishAt_unpublishAt_idx`(`publicationStatus`, `publishAt`, `unpublishAt`),
    INDEX `CatalogueService_categoryId_publicationStatus_displayOrder_idx`(`categoryId`, `publicationStatus`, `displayOrder`),
    INDEX `CatalogueService_availabilityState_idx`(`availabilityState`),
    INDEX `CatalogueService_engineType_idx`(`engineType`),
    INDEX `CatalogueService_isFeatured_idx`(`isFeatured`),
    UNIQUE INDEX `CatalogueService_categoryId_slug_key`(`categoryId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogueServiceGameMode` (
    `serviceId` VARCHAR(30) NOT NULL,
    `gameMode` ENUM('NORMAL', 'IRONMAN', 'HARDCORE_IRONMAN', 'ULTIMATE_IRONMAN') NOT NULL,

    INDEX `CatalogueServiceGameMode_gameMode_idx`(`gameMode`),
    PRIMARY KEY (`serviceId`, `gameMode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogueRequirement` (
    `id` VARCHAR(30) NOT NULL,
    `serviceId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `type` ENUM('SKILL', 'QUEST', 'ITEM', 'ACTIVITY', 'ACCOUNT', 'OTHER') NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `verificationMode` ENUM('AUTOMATIC', 'CUSTOMER_CONFIRMED', 'SUPPORT_VERIFIED') NOT NULL,
    `seededKey` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CatalogueRequirement_seededKey_key`(`seededKey`),
    INDEX `CatalogueRequirement_serviceId_displayOrder_idx`(`serviceId`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogueMediaReference` (
    `id` VARCHAR(30) NOT NULL,
    `categoryId` VARCHAR(30) NULL,
    `serviceId` VARCHAR(30) NULL,
    `assetPath` VARCHAR(500) NOT NULL,
    `altText` VARCHAR(300) NOT NULL,
    `caption` VARCHAR(500) NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CatalogueMediaReference_categoryId_displayOrder_idx`(`categoryId`, `displayOrder`),
    INDEX `CatalogueMediaReference_serviceId_displayOrder_idx`(`serviceId`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogueRevision` (
    `id` VARCHAR(30) NOT NULL,
    `serviceId` VARCHAR(30) NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `event` ENUM('PUBLISHED', 'REPUBLISHED', 'ARCHIVED') NOT NULL,
    `publicationStatus` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL,
    `summary` VARCHAR(500) NOT NULL,
    `snapshot` JSON NOT NULL,
    `actorId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CatalogueRevision_serviceId_createdAt_idx`(`serviceId`, `createdAt`),
    INDEX `CatalogueRevision_actorId_createdAt_idx`(`actorId`, `createdAt`),
    UNIQUE INDEX `CatalogueRevision_serviceId_revisionNumber_key`(`serviceId`, `revisionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CatalogueService` ADD CONSTRAINT `CatalogueService_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `CatalogueCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogueService` ADD CONSTRAINT `CatalogueService_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogueService` ADD CONSTRAINT `CatalogueService_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogueServiceGameMode` ADD CONSTRAINT `CatalogueServiceGameMode_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogueRequirement` ADD CONSTRAINT `CatalogueRequirement_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogueMediaReference` ADD CONSTRAINT `CatalogueMediaReference_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `CatalogueCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogueMediaReference` ADD CONSTRAINT `CatalogueMediaReference_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogueRevision` ADD CONSTRAINT `CatalogueRevision_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogueRevision` ADD CONSTRAINT `CatalogueRevision_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

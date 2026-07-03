-- Persist one server-side unpublished aggregate for each live catalogue service.
-- Existing service, child, revision, audit and foundation rows are unchanged.
CREATE TABLE `CatalogueServiceStage` (
  `id` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `snapshot` JSON NOT NULL,
  `baseVersion` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updatedById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CatalogueServiceStage_serviceId_key`(`serviceId`),
  INDEX `CatalogueServiceStage_updatedById_updatedAt_idx`(`updatedById`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CatalogueServiceStage`
  ADD CONSTRAINT `CatalogueServiceStage_serviceId_fkey`
    FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CatalogueServiceStage_updatedById_fkey`
    FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

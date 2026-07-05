-- Preserve quote-based presentation through CatalogueService.isQuoteOnly while
-- normalizing the independent operational availability state.
UPDATE `CatalogueService`
SET `availabilityState` = 'AVAILABLE'
WHERE `availabilityState` = 'QUOTE_ONLY';

ALTER TABLE `CatalogueService`
  MODIFY `availabilityState` ENUM('AVAILABLE', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE';

-- Published revision history is immutable and blocks permanent service removal.
ALTER TABLE `CatalogueRevision`
  DROP FOREIGN KEY `CatalogueRevision_serviceId_fkey`;

ALTER TABLE `CatalogueRevision`
  ADD CONSTRAINT `CatalogueRevision_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- MySQL does not allow CHECK columns to participate in cascading foreign keys.
-- Restrictive ownership also prevents media from being silently discarded.
ALTER TABLE `CatalogueMediaReference`
  DROP FOREIGN KEY `CatalogueMediaReference_categoryId_fkey`,
  DROP FOREIGN KEY `CatalogueMediaReference_serviceId_fkey`;

ALTER TABLE `CatalogueMediaReference`
  ADD CONSTRAINT `CatalogueMediaReference_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `CatalogueCategory`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `CatalogueMediaReference_serviceId_fkey`
    FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- A media reference must have exactly one owner.
ALTER TABLE `CatalogueMediaReference`
  ADD CONSTRAINT `CatalogueMediaReference_exactly_one_owner_chk`
  CHECK (
    (`categoryId` IS NOT NULL AND `serviceId` IS NULL)
    OR (`categoryId` IS NULL AND `serviceId` IS NOT NULL)
  );

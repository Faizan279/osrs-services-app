-- TASK 011: additive custom account build and quote request engine.

CREATE TABLE `CustomBuildService` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `serviceId` VARCHAR(30) NOT NULL,
  `publicName` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `publicDescription` TEXT NOT NULL,
  `publicInstructions` TEXT NOT NULL,
  `privateInternalInstructions` TEXT NULL,
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `availabilityState` ENUM('AVAILABLE', 'PAUSED', 'UNAVAILABLE') NOT NULL DEFAULT 'PAUSED',
  `minimumAutomaticEstimateCents` INTEGER NOT NULL DEFAULT 0,
  `maximumAutomaticEstimateCents` INTEGER NULL,
  `quoteValidityDaysDefault` INTEGER NOT NULL DEFAULT 7,
  `attachmentPolicy` TEXT NOT NULL,
  `maxAttachments` INTEGER NOT NULL DEFAULT 5,
  `maxAttachmentBytes` INTEGER NOT NULL DEFAULT 5242880,
  `maxTotalAttachmentBytes` INTEGER NOT NULL DEFAULT 20971520,
  `customerNoteMaxLength` INTEGER NOT NULL DEFAULT 2000,
  `consentPolicyVersion` VARCHAR(80) NOT NULL DEFAULT 'custom-build-request-v1',
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomBuildService_stableKey_key` (`stableKey`),
  UNIQUE INDEX `CustomBuildService_serviceId_key` (`serviceId`),
  UNIQUE INDEX `CustomBuildService_slug_key` (`slug`),
  INDEX `CustomBuildService_serviceId_idx` (`serviceId`),
  INDEX `CustomBuildService_availability_idx` (`availabilityState`),
  INDEX `CustomBuildService_currency_idx` (`currencyCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildRuleSet` (
  `id` VARCHAR(30) NOT NULL,
  `customBuildServiceId` VARCHAR(30) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `description` VARCHAR(500) NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `snapshotSchemaVersion` INTEGER NOT NULL DEFAULT 1,
  `publishedAt` DATETIME(3) NULL,
  `publishedById` VARCHAR(30) NULL,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `internalNotes` TEXT NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CustomBuildRuleSet_service_status_idx` (`customBuildServiceId`, `status`, `updatedAt`),
  INDEX `CustomBuildRuleSet_publishedBy_idx` (`publishedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildSkillRule` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `ruleSetId` VARCHAR(30) NOT NULL,
  `skillKey` ENUM('ATTACK', 'STRENGTH', 'DEFENCE', 'RANGED', 'PRAYER', 'MAGIC', 'RUNECRAFT', 'CONSTRUCTION', 'HITPOINTS', 'AGILITY', 'HERBLORE', 'THIEVING', 'CRAFTING', 'FLETCHING', 'SLAYER', 'HUNTER', 'MINING', 'SMITHING', 'FISHING', 'COOKING', 'FIREMAKING', 'WOODCUTTING', 'FARMING') NOT NULL,
  `pricingMode` ENUM('PER_XP', 'PER_LEVEL_BAND', 'FIXED_TARGET_PACKAGE', 'FIXED_ADDITION', 'MANUAL_REVIEW_ONLY') NOT NULL DEFAULT 'PER_XP',
  `gameMode` ENUM('NORMAL', 'IRONMAN', 'HARDCORE_IRONMAN', 'ULTIMATE_IRONMAN') NULL,
  `minimumLevel` INTEGER NULL,
  `maximumLevel` INTEGER NULL,
  `minimumXp` BIGINT NULL,
  `maximumXp` BIGINT NULL,
  `centsPerMillionXp` INTEGER NULL,
  `levelBandStart` INTEGER NULL,
  `levelBandEnd` INTEGER NULL,
  `fixedPriceCents` INTEGER NULL,
  `minimumPriceCents` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `manualReviewOnly` BOOLEAN NOT NULL DEFAULT false,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomBuildSkillRule_stableKey_key` (`stableKey`),
  UNIQUE INDEX `CustomBuildSkillRule_scope_key` (`ruleSetId`, `skillKey`, `gameMode`, `minimumLevel`, `maximumLevel`),
  INDEX `CustomBuildSkillRule_enabled_idx` (`ruleSetId`, `enabled`, `skillKey`),
  INDEX `CustomBuildSkillRule_skill_mode_idx` (`skillKey`, `gameMode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildObjective` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `customBuildServiceId` VARCHAR(30) NOT NULL,
  `objectiveType` ENUM('QUEST', 'ACHIEVEMENT_DIARY', 'UNLOCK', 'MINIGAME', 'BOSS_ACCESS', 'PRAYER', 'SPELLBOOK', 'TRANSPORT', 'UNTRADEABLE', 'OTHER') NOT NULL,
  `objectiveKey` VARCHAR(120) NOT NULL,
  `publicName` VARCHAR(180) NOT NULL,
  `publicDescription` TEXT NOT NULL,
  `objectiveGroup` VARCHAR(120) NULL,
  `difficultyTier` VARCHAR(80) NULL,
  `gameMode` ENUM('NORMAL', 'IRONMAN', 'HARDCORE_IRONMAN', 'ULTIMATE_IRONMAN') NULL,
  `prerequisiteText` TEXT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomBuildObjective_stableKey_key` (`stableKey`),
  UNIQUE INDEX `CustomBuildObjective_service_key_key` (`customBuildServiceId`, `objectiveKey`),
  INDEX `CustomBuildObjective_public_idx` (`customBuildServiceId`, `enabled`, `sortOrder`),
  INDEX `CustomBuildObjective_type_idx` (`objectiveType`),
  INDEX `CustomBuildObjective_gameMode_idx` (`gameMode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildObjectiveRule` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `ruleSetId` VARCHAR(30) NOT NULL,
  `objectiveId` VARCHAR(30) NOT NULL,
  `pricingMode` ENUM('PER_XP', 'PER_LEVEL_BAND', 'FIXED_TARGET_PACKAGE', 'FIXED_ADDITION', 'MANUAL_REVIEW_ONLY') NOT NULL DEFAULT 'FIXED_ADDITION',
  `fixedPriceCents` INTEGER NULL,
  `percentBps` INTEGER NULL,
  `gameMode` ENUM('NORMAL', 'IRONMAN', 'HARDCORE_IRONMAN', 'ULTIMATE_IRONMAN') NULL,
  `manualReviewOnly` BOOLEAN NOT NULL DEFAULT false,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomBuildObjectiveRule_stableKey_key` (`stableKey`),
  UNIQUE INDEX `CustomBuildObjectiveRule_scope_key` (`ruleSetId`, `objectiveId`, `gameMode`),
  INDEX `CustomBuildObjectiveRule_enabled_idx` (`ruleSetId`, `enabled`),
  INDEX `CustomBuildObjectiveRule_objective_idx` (`objectiveId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildRevision` (
  `id` VARCHAR(30) NOT NULL,
  `customBuildServiceId` VARCHAR(30) NOT NULL,
  `ruleSetId` VARCHAR(30) NULL,
  `revisionNumber` INTEGER NOT NULL,
  `snapshotSchemaVersion` INTEGER NOT NULL DEFAULT 1,
  `snapshot` JSON NOT NULL,
  `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CustomBuildRevision_service_revision_key` (`customBuildServiceId`, `revisionNumber`),
  INDEX `CustomBuildRevision_service_published_idx` (`customBuildServiceId`, `publishedAt`),
  INDEX `CustomBuildRevision_publishedBy_idx` (`publishedById`),
  INDEX `CustomBuildRevision_ruleSet_idx` (`ruleSetId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildRequest` (
  `id` VARCHAR(30) NOT NULL,
  `publicRequestNumber` VARCHAR(40) NOT NULL,
  `customBuildServiceId` VARCHAR(30) NOT NULL,
  `publishedRevisionId` VARCHAR(30) NULL,
  `status` ENUM('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CUSTOMER_INFORMATION', 'ESTIMATE_PROVIDED', 'QUOTE_DRAFT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_DECLINED', 'QUOTE_EXPIRED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
  `estimateState` ENUM('AUTOMATIC', 'PARTIAL', 'MANUAL_REVIEW_REQUIRED', 'UNAVAILABLE') NULL,
  `estimateSnapshot` JSON NULL,
  `gameMode` ENUM('NORMAL', 'IRONMAN', 'HARDCORE_IRONMAN', 'ULTIMATE_IRONMAN') NOT NULL,
  `displayName` VARCHAR(120) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `discordUsername` VARCHAR(80) NULL,
  `rsn` VARCHAR(12) NULL,
  `customerNotes` TEXT NULL,
  `contactConsentAt` DATETIME(3) NOT NULL,
  `contactConsentPolicyVersion` VARCHAR(80) NOT NULL,
  `trackingTokenHash` CHAR(64) NOT NULL,
  `idempotencyKeyHash` CHAR(64) NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  UNIQUE INDEX `CustomBuildRequest_publicNumber_key` (`publicRequestNumber`),
  UNIQUE INDEX `CustomBuildRequest_trackingHash_key` (`trackingTokenHash`),
  UNIQUE INDEX `CustomBuildRequest_idempotencyHash_key` (`idempotencyKeyHash`),
  INDEX `CustomBuildRequest_status_idx` (`customBuildServiceId`, `status`, `submittedAt`),
  INDEX `CustomBuildRequest_revision_idx` (`publishedRevisionId`),
  INDEX `CustomBuildRequest_email_idx` (`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildRequestSkill` (
  `id` VARCHAR(30) NOT NULL,
  `requestId` VARCHAR(30) NOT NULL,
  `skillKey` ENUM('ATTACK', 'STRENGTH', 'DEFENCE', 'RANGED', 'PRAYER', 'MAGIC', 'RUNECRAFT', 'CONSTRUCTION', 'HITPOINTS', 'AGILITY', 'HERBLORE', 'THIEVING', 'CRAFTING', 'FLETCHING', 'SLAYER', 'HUNTER', 'MINING', 'SMITHING', 'FISHING', 'COOKING', 'FIREMAKING', 'WOODCUTTING', 'FARMING') NOT NULL,
  `valueMode` ENUM('LEVEL', 'XP', 'UNKNOWN_CURRENT', 'FRESH_ACCOUNT') NOT NULL,
  `currentLevel` INTEGER NULL,
  `targetLevel` INTEGER NULL,
  `currentXp` BIGINT NULL,
  `targetXp` BIGINT NULL,
  `freshStart` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `CustomBuildRequestSkill_request_skill_key` (`requestId`, `skillKey`),
  INDEX `CustomBuildRequestSkill_sort_idx` (`requestId`, `sortOrder`),
  INDEX `CustomBuildRequestSkill_skill_idx` (`skillKey`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildRequestObjective` (
  `id` VARCHAR(30) NOT NULL,
  `requestId` VARCHAR(30) NOT NULL,
  `objectiveId` VARCHAR(30) NULL,
  `objectiveStableKey` VARCHAR(160) NOT NULL,
  `objectiveType` ENUM('QUEST', 'ACHIEVEMENT_DIARY', 'UNLOCK', 'MINIGAME', 'BOSS_ACCESS', 'PRAYER', 'SPELLBOOK', 'TRANSPORT', 'UNTRADEABLE', 'OTHER') NOT NULL,
  `publicName` VARCHAR(180) NOT NULL,
  `customerAlreadyCompleted` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `CustomBuildRequestObjective_request_key` (`requestId`, `objectiveStableKey`),
  INDEX `CustomBuildRequestObjective_sort_idx` (`requestId`, `sortOrder`),
  INDEX `CustomBuildRequestObjective_objective_idx` (`objectiveId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildRequestStatusEvent` (
  `id` VARCHAR(30) NOT NULL,
  `requestId` VARCHAR(30) NOT NULL,
  `previousStatus` ENUM('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CUSTOMER_INFORMATION', 'ESTIMATE_PROVIDED', 'QUOTE_DRAFT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_DECLINED', 'QUOTE_EXPIRED', 'CLOSED', 'CANCELLED') NULL,
  `newStatus` ENUM('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CUSTOMER_INFORMATION', 'ESTIMATE_PROVIDED', 'QUOTE_DRAFT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'QUOTE_DECLINED', 'QUOTE_EXPIRED', 'CLOSED', 'CANCELLED') NOT NULL,
  `publicMessage` VARCHAR(500) NULL,
  `internalReason` TEXT NULL,
  `actorId` VARCHAR(30) NULL,
  `safeMetadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CustomBuildStatusEvent_request_idx` (`requestId`, `createdAt`),
  INDEX `CustomBuildStatusEvent_status_idx` (`newStatus`, `createdAt`),
  INDEX `CustomBuildStatusEvent_actor_idx` (`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildAttachment` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `requestId` VARCHAR(30) NOT NULL,
  `originalFilename` VARCHAR(180) NOT NULL,
  `storageFilename` VARCHAR(191) NOT NULL,
  `storageRoot` VARCHAR(500) NOT NULL,
  `detectedMime` VARCHAR(120) NOT NULL,
  `extension` VARCHAR(12) NOT NULL,
  `sizeBytes` INTEGER NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `status` ENUM('QUARANTINED', 'APPROVED', 'REJECTED', 'REMOVED') NOT NULL DEFAULT 'QUARANTINED',
  `scanStatus` ENUM('NOT_SCANNED', 'PENDING', 'PASSED', 'FAILED', 'REJECTED') NOT NULL DEFAULT 'NOT_SCANNED',
  `reviewNote` VARCHAR(500) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `reviewedById` VARCHAR(30) NULL,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  UNIQUE INDEX `CustomBuildAttachment_stableKey_key` (`stableKey`),
  INDEX `CustomBuildAttachment_request_status_idx` (`requestId`, `status`, `uploadedAt`),
  INDEX `CustomBuildAttachment_sha256_idx` (`sha256`),
  INDEX `CustomBuildAttachment_reviewedBy_idx` (`reviewedById`, `reviewedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildQuote` (
  `id` VARCHAR(30) NOT NULL,
  `publicQuoteNumber` VARCHAR(40) NOT NULL,
  `requestId` VARCHAR(30) NOT NULL,
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'VOID') NOT NULL DEFAULT 'DRAFT',
  `currentRevisionNumber` INTEGER NOT NULL DEFAULT 0,
  `issuedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `customerMessage` TEXT NULL,
  `privateInternalNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  UNIQUE INDEX `CustomBuildQuote_publicNumber_key` (`publicQuoteNumber`),
  UNIQUE INDEX `CustomBuildQuote_requestId_key` (`requestId`),
  INDEX `CustomBuildQuote_status_expiry_idx` (`status`, `expiresAt`),
  INDEX `CustomBuildQuote_issuedAt_idx` (`issuedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildQuoteRevision` (
  `id` VARCHAR(30) NOT NULL,
  `quoteId` VARCHAR(30) NOT NULL,
  `revisionNumber` INTEGER NOT NULL,
  `snapshotSchemaVersion` INTEGER NOT NULL DEFAULT 1,
  `snapshot` JSON NOT NULL,
  `subtotalCents` INTEGER NOT NULL,
  `adjustmentsCents` INTEGER NOT NULL DEFAULT 0,
  `finalTotalCents` INTEGER NOT NULL,
  `estimatedDeliveryText` VARCHAR(240) NOT NULL,
  `includedWorkSummary` TEXT NOT NULL,
  `exclusions` TEXT NULL,
  `customerSafeTerms` TEXT NOT NULL,
  `createdById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sentAt` DATETIME(3) NULL,
  UNIQUE INDEX `CustomBuildQuoteRevision_quote_revision_key` (`quoteId`, `revisionNumber`),
  INDEX `CustomBuildQuoteRevision_quote_sent_idx` (`quoteId`, `sentAt`),
  INDEX `CustomBuildQuoteRevision_createdBy_idx` (`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildQuoteLine` (
  `id` VARCHAR(30) NOT NULL,
  `revisionId` VARCHAR(30) NOT NULL,
  `lineType` VARCHAR(40) NOT NULL DEFAULT 'SERVICE',
  `publicDescription` VARCHAR(240) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unitAmountCents` INTEGER NOT NULL,
  `lineTotalCents` INTEGER NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  INDEX `CustomBuildQuoteLine_revision_sort_idx` (`revisionId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomBuildQuoteDecision` (
  `id` VARCHAR(30) NOT NULL,
  `quoteId` VARCHAR(30) NOT NULL,
  `revisionId` VARCHAR(30) NOT NULL,
  `decision` ENUM('ACCEPTED', 'DECLINED') NOT NULL,
  `customerMessage` VARCHAR(500) NULL,
  `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `concurrencyKey` VARCHAR(120) NULL,
  UNIQUE INDEX `CustomBuildQuoteDecision_concurrency_key` (`concurrencyKey`),
  INDEX `CustomBuildQuoteDecision_quote_idx` (`quoteId`, `decidedAt`),
  INDEX `CustomBuildQuoteDecision_revision_idx` (`revisionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CustomBuildService`
  ADD CONSTRAINT `CustomBuildService_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `CatalogueService`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRuleSet`
  ADD CONSTRAINT `CustomBuildRuleSet_service_fkey`
  FOREIGN KEY (`customBuildServiceId`) REFERENCES `CustomBuildService`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRuleSet`
  ADD CONSTRAINT `CustomBuildRuleSet_publishedBy_fkey`
  FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomBuildSkillRule`
  ADD CONSTRAINT `CustomBuildSkillRule_ruleSet_fkey`
  FOREIGN KEY (`ruleSetId`) REFERENCES `CustomBuildRuleSet`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildObjective`
  ADD CONSTRAINT `CustomBuildObjective_service_fkey`
  FOREIGN KEY (`customBuildServiceId`) REFERENCES `CustomBuildService`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildObjectiveRule`
  ADD CONSTRAINT `CustomBuildObjectiveRule_ruleSet_fkey`
  FOREIGN KEY (`ruleSetId`) REFERENCES `CustomBuildRuleSet`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildObjectiveRule`
  ADD CONSTRAINT `CustomBuildObjectiveRule_objective_fkey`
  FOREIGN KEY (`objectiveId`) REFERENCES `CustomBuildObjective`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRevision`
  ADD CONSTRAINT `CustomBuildRevision_service_fkey`
  FOREIGN KEY (`customBuildServiceId`) REFERENCES `CustomBuildService`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRevision`
  ADD CONSTRAINT `CustomBuildRevision_ruleSet_fkey`
  FOREIGN KEY (`ruleSetId`) REFERENCES `CustomBuildRuleSet`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRevision`
  ADD CONSTRAINT `CustomBuildRevision_publishedBy_fkey`
  FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRequest`
  ADD CONSTRAINT `CustomBuildRequest_service_fkey`
  FOREIGN KEY (`customBuildServiceId`) REFERENCES `CustomBuildService`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRequest`
  ADD CONSTRAINT `CustomBuildRequest_revision_fkey`
  FOREIGN KEY (`publishedRevisionId`) REFERENCES `CustomBuildRevision`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRequestSkill`
  ADD CONSTRAINT `CustomBuildRequestSkill_request_fkey`
  FOREIGN KEY (`requestId`) REFERENCES `CustomBuildRequest`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRequestObjective`
  ADD CONSTRAINT `CustomBuildRequestObjective_request_fkey`
  FOREIGN KEY (`requestId`) REFERENCES `CustomBuildRequest`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRequestObjective`
  ADD CONSTRAINT `CustomBuildRequestObjective_objective_fkey`
  FOREIGN KEY (`objectiveId`) REFERENCES `CustomBuildObjective`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRequestStatusEvent`
  ADD CONSTRAINT `CustomBuildStatusEvent_request_fkey`
  FOREIGN KEY (`requestId`) REFERENCES `CustomBuildRequest`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildRequestStatusEvent`
  ADD CONSTRAINT `CustomBuildStatusEvent_actor_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomBuildAttachment`
  ADD CONSTRAINT `CustomBuildAttachment_request_fkey`
  FOREIGN KEY (`requestId`) REFERENCES `CustomBuildRequest`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CustomBuildAttachment`
  ADD CONSTRAINT `CustomBuildAttachment_reviewedBy_fkey`
  FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomBuildQuote`
  ADD CONSTRAINT `CustomBuildQuote_request_fkey`
  FOREIGN KEY (`requestId`) REFERENCES `CustomBuildRequest`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CustomBuildQuoteRevision`
  ADD CONSTRAINT `CustomBuildQuoteRevision_quote_fkey`
  FOREIGN KEY (`quoteId`) REFERENCES `CustomBuildQuote`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildQuoteRevision`
  ADD CONSTRAINT `CustomBuildQuoteRevision_createdBy_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomBuildQuoteLine`
  ADD CONSTRAINT `CustomBuildQuoteLine_revision_fkey`
  FOREIGN KEY (`revisionId`) REFERENCES `CustomBuildQuoteRevision`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomBuildQuoteDecision`
  ADD CONSTRAINT `CustomBuildQuoteDecision_quote_fkey`
  FOREIGN KEY (`quoteId`) REFERENCES `CustomBuildQuote`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CustomBuildQuoteDecision`
  ADD CONSTRAINT `CustomBuildQuoteDecision_revision_fkey`
  FOREIGN KEY (`revisionId`) REFERENCES `CustomBuildQuoteRevision`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

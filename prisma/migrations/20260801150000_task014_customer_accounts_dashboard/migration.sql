-- TASK 014: additive customer accounts and dashboard foundation.

ALTER TABLE `User`
  ADD COLUMN `accountType` ENUM('STAFF', 'CUSTOMER') NOT NULL DEFAULT 'STAFF';

ALTER TABLE `Session`
  ADD COLUMN `audience` ENUM('STAFF', 'CUSTOMER') NOT NULL DEFAULT 'STAFF',
  ADD COLUMN `revokedAt` DATETIME(3) NULL;

CREATE INDEX `User_accountType_idx` ON `User`(`accountType`);
CREATE INDEX `User_status_accountType_idx` ON `User`(`status`, `accountType`);
CREATE INDEX `Session_audience_user_idx` ON `Session`(`audience`, `userId`);
CREATE INDEX `Session_audience_expires_idx` ON `Session`(`audience`, `expires`);
CREATE INDEX `Session_revokedAt_idx` ON `Session`(`revokedAt`);

CREATE TABLE `CustomerProfile` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `displayName` VARCHAR(120) NOT NULL,
  `discordUsername` VARCHAR(80) NULL,
  `defaultRsn` VARCHAR(12) NULL,
  `timezone` VARCHAR(80) NULL,
  `locale` VARCHAR(16) NULL,
  `emailVerificationStatus` ENUM('UNVERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'DELIVERY_UNAVAILABLE') NOT NULL DEFAULT 'UNVERIFIED',
  `emailVerifiedAt` DATETIME(3) NULL,
  `registrationSource` VARCHAR(80) NOT NULL DEFAULT 'PUBLIC_REGISTRATION',
  `needsReview` BOOLEAN NOT NULL DEFAULT true,
  `termsVersion` VARCHAR(80) NOT NULL DEFAULT 'needs-client-review',
  `privacyPolicyVersion` VARCHAR(80) NOT NULL DEFAULT 'needs-client-review',
  `termsAcceptedAt` DATETIME(3) NULL,
  `privacyAcceptedAt` DATETIME(3) NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomerProfile_userId_key` (`userId`),
  INDEX `CustomerProfile_emailVerificationStatus_idx` (`emailVerificationStatus`),
  INDEX `CustomerProfile_createdAt_idx` (`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerAccountSettings` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `registrationEnabled` BOOLEAN NOT NULL DEFAULT false,
  `dashboardEnabled` BOOLEAN NOT NULL DEFAULT false,
  `emailVerificationRequired` BOOLEAN NOT NULL DEFAULT false,
  `passwordRecoveryEnabled` BOOLEAN NOT NULL DEFAULT false,
  `customerSessionDurationHours` INTEGER NOT NULL DEFAULT 168,
  `maximumActiveCustomerSessions` INTEGER NOT NULL DEFAULT 5,
  `publicRegistrationInstructions` TEXT NOT NULL,
  `publicRecoveryInstructions` TEXT NOT NULL,
  `notificationProviderConfigured` BOOLEAN NOT NULL DEFAULT false,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomerAccountSettings_stableKey_key` (`stableKey`),
  INDEX `CustomerAccountSettings_review_idx` (`needsClientReview`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerAuthToken` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `purpose` ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET') NOT NULL,
  `status` ENUM('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `lastAttemptAt` DATETIME(3) NULL,
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `maxAttempts` INTEGER NOT NULL DEFAULT 5,
  `notificationId` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomerAuthToken_tokenHash_key` (`tokenHash`),
  INDEX `CustomerAuthToken_user_purpose_status_idx` (`userId`, `purpose`, `status`),
  INDEX `CustomerAuthToken_expires_idx` (`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerOrderLink` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NOT NULL,
  `source` ENUM('AUTHENTICATED_CHECKOUT', 'POST_CHECKOUT_ACCOUNT_CREATION', 'SECURE_GUEST_CLAIM', 'ADMIN_ASSISTED') NOT NULL,
  `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdById` VARCHAR(30) NULL,
  `safeCreatedByContext` VARCHAR(120) NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomerOrderLink_orderId_key` (`orderId`),
  UNIQUE INDEX `CustomerOrderLink_user_order_key` (`userId`, `orderId`),
  INDEX `CustomerOrderLink_user_linked_idx` (`userId`, `linkedAt`),
  INDEX `CustomerOrderLink_source_linked_idx` (`source`, `linkedAt`),
  INDEX `CustomerOrderLink_createdBy_idx` (`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerOrderClaimEvent` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NOT NULL,
  `orderLinkId` VARCHAR(30) NULL,
  `source` ENUM('AUTHENTICATED_CHECKOUT', 'POST_CHECKOUT_ACCOUNT_CREATION', 'SECURE_GUEST_CLAIM', 'ADMIN_ASSISTED') NOT NULL DEFAULT 'SECURE_GUEST_CLAIM',
  `result` VARCHAR(80) NOT NULL,
  `safeMetadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CustomerOrderClaim_user_created_idx` (`userId`, `createdAt`),
  INDEX `CustomerOrderClaim_order_created_idx` (`orderId`, `createdAt`),
  INDEX `CustomerOrderClaim_source_created_idx` (`source`, `createdAt`),
  INDEX `CustomerOrderClaim_link_idx` (`orderLinkId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerNotification` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NULL,
  `type` ENUM('ACCOUNT', 'SECURITY', 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_PAYMENT_CHANGED', 'EMAIL_VERIFICATION', 'PASSWORD_RECOVERY') NOT NULL,
  `status` ENUM('UNREAD', 'READ', 'ARCHIVED') NOT NULL DEFAULT 'UNREAD',
  `title` VARCHAR(160) NOT NULL,
  `body` VARCHAR(500) NOT NULL,
  `dedupeKey` VARCHAR(160) NULL,
  `safeMetadata` JSON NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomerNotification_user_dedupe_key` (`userId`, `dedupeKey`),
  INDEX `CustomerNotification_user_status_created_idx` (`userId`, `status`, `createdAt`),
  INDEX `CustomerNotification_order_created_idx` (`orderId`, `createdAt`),
  INDEX `CustomerNotification_type_created_idx` (`type`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerNotificationPreference` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `type` ENUM('ACCOUNT', 'SECURITY', 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_PAYMENT_CHANGED', 'EMAIL_VERIFICATION', 'PASSWORD_RECOVERY') NOT NULL,
  `inAppEnabled` BOOLEAN NOT NULL DEFAULT true,
  `emailEnabled` BOOLEAN NOT NULL DEFAULT false,
  `marketingConsent` BOOLEAN NOT NULL DEFAULT false,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomerNotificationPreference_user_type_key` (`userId`, `type`),
  INDEX `CustomerNotificationPreference_user_idx` (`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerSecurityEvent` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `eventType` ENUM('REGISTRATION', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'EMAIL_VERIFICATION_REQUESTED', 'EMAIL_VERIFIED', 'SESSION_REVOKED', 'ORDER_CLAIMED', 'PROFILE_UPDATED', 'ACCOUNT_DISABLED', 'ACCOUNT_ENABLED') NOT NULL,
  `ipHash` CHAR(64) NULL,
  `userAgentHash` CHAR(64) NULL,
  `safeMetadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CustomerSecurityEvent_user_created_idx` (`userId`, `createdAt`),
  INDEX `CustomerSecurityEvent_type_created_idx` (`eventType`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerAccountEvent` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `eventType` ENUM('CREATED', 'PROFILE_UPDATED', 'SETTINGS_UPDATED', 'ORDER_LINKED', 'ORDER_CLAIMED', 'NOTIFICATION_UPDATED', 'DISABLED', 'ENABLED') NOT NULL,
  `actorId` VARCHAR(30) NULL,
  `safeMetadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CustomerAccountEvent_user_created_idx` (`userId`, `createdAt`),
  INDEX `CustomerAccountEvent_actor_created_idx` (`actorId`, `createdAt`),
  INDEX `CustomerAccountEvent_type_created_idx` (`eventType`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CustomerProfile`
  ADD CONSTRAINT `CustomerProfile_user_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomerAuthToken`
  ADD CONSTRAINT `CustomerAuthToken_user_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomerOrderLink`
  ADD CONSTRAINT `CustomerOrderLink_user_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `CustomerOrderLink_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `CustomerOrderLink_createdBy_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomerOrderClaimEvent`
  ADD CONSTRAINT `CustomerOrderClaim_user_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `CustomerOrderClaim_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `CustomerOrderClaim_link_fkey`
  FOREIGN KEY (`orderLinkId`) REFERENCES `CustomerOrderLink`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomerNotification`
  ADD CONSTRAINT `CustomerNotification_user_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CustomerNotification_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomerNotificationPreference`
  ADD CONSTRAINT `CustomerNotificationPreference_user_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomerSecurityEvent`
  ADD CONSTRAINT `CustomerSecurityEvent_user_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CustomerAccountEvent`
  ADD CONSTRAINT `CustomerAccountEvent_user_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CustomerAccountEvent_actor_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

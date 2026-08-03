-- TASK 015: additive custom live chat and support dashboard foundation.

ALTER TABLE `CustomerNotification`
  MODIFY `type` ENUM('ACCOUNT', 'SECURITY', 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_PAYMENT_CHANGED', 'CHAT_MESSAGE', 'EMAIL_VERIFICATION', 'PASSWORD_RECOVERY') NOT NULL;

ALTER TABLE `CustomerNotificationPreference`
  MODIFY `type` ENUM('ACCOUNT', 'SECURITY', 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_PAYMENT_CHANGED', 'CHAT_MESSAGE', 'EMAIL_VERIFICATION', 'PASSWORD_RECOVERY') NOT NULL;

CREATE TABLE `ChatSettings` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `availabilityMode` ENUM('OFFLINE', 'ONLINE', 'MAINTENANCE') NOT NULL DEFAULT 'OFFLINE',
  `publicLauncherEnabled` BOOLEAN NOT NULL DEFAULT false,
  `offlineIntakeEnabled` BOOLEAN NOT NULL DEFAULT false,
  `publicOnlineMessage` VARCHAR(500) NOT NULL,
  `publicOfflineMessage` VARCHAR(500) NOT NULL,
  `publicMaintenanceMessage` VARCHAR(500) NOT NULL,
  `maximumMessageLength` INTEGER NOT NULL DEFAULT 2000,
  `maximumOpenConversationsPerGuest` INTEGER NOT NULL DEFAULT 2,
  `maximumOpenConversationsPerCustomer` INTEGER NOT NULL DEFAULT 5,
  `guestSessionDurationMinutes` INTEGER NOT NULL DEFAULT 10080,
  `inactivityCloseMinutes` INTEGER NOT NULL DEFAULT 10080,
  `resolvedToArchiveMinutes` INTEGER NOT NULL DEFAULT 43200,
  `retentionPolicyDays` INTEGER NOT NULL DEFAULT 365,
  `pollingFallbackIntervalSeconds` INTEGER NOT NULL DEFAULT 12,
  `typingIndicatorExpirySeconds` INTEGER NOT NULL DEFAULT 8,
  `realtimeExpected` BOOLEAN NOT NULL DEFAULT false,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ChatSettings_stableKey_key` (`stableKey`),
  INDEX `ChatSettings_availability_idx` (`availabilityMode`),
  INDEX `ChatSettings_review_idx` (`needsClientReview`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatGuestSession` (
  `id` VARCHAR(30) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `displayName` VARCHAR(120) NULL,
  `supportCategory` VARCHAR(80) NULL,
  `status` ENUM('ACTIVE', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ChatGuestSession_tokenHash_key` (`tokenHash`),
  INDEX `ChatGuestSession_status_expires_idx` (`status`, `expiresAt`),
  INDEX `ChatGuestSession_lastSeen_idx` (`lastSeenAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatConversation` (
  `id` VARCHAR(30) NOT NULL,
  `reference` VARCHAR(40) NOT NULL,
  `guestSessionId` VARCHAR(30) NULL,
  `customerUserId` VARCHAR(30) NULL,
  `status` ENUM('QUEUED', 'ASSIGNED', 'WAITING_FOR_SUPPORT', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'ARCHIVED', 'SPAM') NOT NULL DEFAULT 'QUEUED',
  `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
  `assignedStaffId` VARCHAR(30) NULL,
  `lastPublicMessageAt` DATETIME(3) NULL,
  `lastStaffReplyAt` DATETIME(3) NULL,
  `lastCustomerReplyAt` DATETIME(3) NULL,
  `resolvedAt` DATETIME(3) NULL,
  `closedAt` DATETIME(3) NULL,
  `archivedAt` DATETIME(3) NULL,
  `spamAt` DATETIME(3) NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ChatConversation_reference_key` (`reference`),
  INDEX `ChatConversation_guest_status_created_idx` (`guestSessionId`, `status`, `createdAt`),
  INDEX `ChatConversation_customer_status_created_idx` (`customerUserId`, `status`, `createdAt`),
  INDEX `ChatConversation_assigned_status_updated_idx` (`assignedStaffId`, `status`, `updatedAt`),
  INDEX `ChatConversation_status_priority_updated_idx` (`status`, `priority`, `updatedAt`),
  INDEX `ChatConversation_archived_idx` (`archivedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatMessage` (
  `id` VARCHAR(30) NOT NULL,
  `conversationId` VARCHAR(30) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `participantType` ENUM('GUEST', 'CUSTOMER', 'STAFF', 'SYSTEM') NOT NULL,
  `messageType` ENUM('PUBLIC', 'STAFF_REPLY', 'SYSTEM', 'SAFETY_REDACTION') NOT NULL DEFAULT 'PUBLIC',
  `customerUserId` VARCHAR(30) NULL,
  `guestSessionId` VARCHAR(30) NULL,
  `staffUserId` VARCHAR(30) NULL,
  `systemKey` VARCHAR(80) NULL,
  `body` TEXT NOT NULL,
  `idempotencyKeyHash` CHAR(64) NULL,
  `redactedAt` DATETIME(3) NULL,
  `redactionReason` ENUM('CREDENTIAL_SECRET', 'EXTREME_PII', 'PROHIBITED_CONTENT', 'CLIENT_REQUEST', 'STAFF_SAFETY_REVIEW') NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ChatMessage_conversation_sequence_key` (`conversationId`, `sequence`),
  UNIQUE INDEX `ChatMessage_conversation_idempotency_key` (`conversationId`, `idempotencyKeyHash`),
  INDEX `ChatMessage_conversation_created_idx` (`conversationId`, `createdAt`),
  INDEX `ChatMessage_participant_created_idx` (`participantType`, `createdAt`),
  INDEX `ChatMessage_staff_created_idx` (`staffUserId`, `createdAt`),
  INDEX `ChatMessage_customer_created_idx` (`customerUserId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatReadCursor` (
  `id` VARCHAR(30) NOT NULL,
  `conversationId` VARCHAR(30) NOT NULL,
  `participantType` ENUM('GUEST', 'CUSTOMER', 'STAFF', 'SYSTEM') NOT NULL,
  `userId` VARCHAR(30) NULL,
  `guestSessionId` VARCHAR(30) NULL,
  `lastReadSequence` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ChatReadCursor_conversation_user_key` (`conversationId`, `participantType`, `userId`),
  UNIQUE INDEX `ChatReadCursor_conversation_guest_key` (`conversationId`, `participantType`, `guestSessionId`),
  INDEX `ChatReadCursor_conversation_sequence_idx` (`conversationId`, `lastReadSequence`),
  INDEX `ChatReadCursor_user_updated_idx` (`userId`, `updatedAt`),
  INDEX `ChatReadCursor_guest_updated_idx` (`guestSessionId`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatConversationEvent` (
  `id` VARCHAR(30) NOT NULL,
  `conversationId` VARCHAR(30) NOT NULL,
  `eventType` ENUM('CREATED', 'ASSIGNED', 'REASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'ORDER_LINKED', 'RESOLVED', 'REOPENED', 'CLOSED', 'ARCHIVED', 'MARKED_SPAM', 'SAFETY_REDACTION', 'MESSAGE_CREATED', 'READ_CURSOR_UPDATED') NOT NULL,
  `previousStatus` ENUM('QUEUED', 'ASSIGNED', 'WAITING_FOR_SUPPORT', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'ARCHIVED', 'SPAM') NULL,
  `newStatus` ENUM('QUEUED', 'ASSIGNED', 'WAITING_FOR_SUPPORT', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'ARCHIVED', 'SPAM') NULL,
  `previousAssignedStaffId` VARCHAR(30) NULL,
  `newAssignedStaffId` VARCHAR(30) NULL,
  `actorType` ENUM('GUEST', 'CUSTOMER', 'STAFF', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
  `actorUserId` VARCHAR(30) NULL,
  `reasonCode` VARCHAR(80) NULL,
  `publicNote` VARCHAR(500) NULL,
  `safeMetadata` JSON NULL,
  `sequence` INTEGER NOT NULL,
  `idempotencyKeyHash` CHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ChatConversationEvent_sequence_key` (`conversationId`, `sequence`),
  UNIQUE INDEX `ChatConversationEvent_idempotency_key` (`conversationId`, `idempotencyKeyHash`),
  INDEX `ChatConversationEvent_type_created_idx` (`eventType`, `createdAt`),
  INDEX `ChatConversationEvent_actor_created_idx` (`actorUserId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatAssignmentEvent` (
  `id` VARCHAR(30) NOT NULL,
  `conversationId` VARCHAR(30) NOT NULL,
  `previousAssignedStaffId` VARCHAR(30) NULL,
  `newAssignedStaffId` VARCHAR(30) NULL,
  `actorId` VARCHAR(30) NULL,
  `reasonCode` VARCHAR(80) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ChatAssignmentEvent_sequence_key` (`conversationId`, `sequence`),
  INDEX `ChatAssignmentEvent_assignee_created_idx` (`newAssignedStaffId`, `createdAt`),
  INDEX `ChatAssignmentEvent_actor_created_idx` (`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatInternalNote` (
  `id` VARCHAR(30) NOT NULL,
  `conversationId` VARCHAR(30) NOT NULL,
  `staffUserId` VARCHAR(30) NOT NULL,
  `body` TEXT NOT NULL,
  `idempotencyKeyHash` CHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ChatInternalNote_idempotency_key` (`conversationId`, `idempotencyKeyHash`),
  INDEX `ChatInternalNote_conversation_created_idx` (`conversationId`, `createdAt`),
  INDEX `ChatInternalNote_staff_created_idx` (`staffUserId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatQuickReply` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `body` VARCHAR(1000) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdById` VARCHAR(30) NULL,
  `updatedById` VARCHAR(30) NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ChatQuickReply_stableKey_key` (`stableKey`),
  INDEX `ChatQuickReply_enabled_sort_idx` (`enabled`, `sortOrder`),
  INDEX `ChatQuickReply_review_idx` (`needsClientReview`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatConversationOrderLink` (
  `id` VARCHAR(30) NOT NULL,
  `conversationId` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NOT NULL,
  `source` ENUM('CUSTOMER_OWNED_ORDER', 'GUEST_TRACKING_TOKEN', 'STAFF_ASSISTED') NOT NULL,
  `linkedByParticipantType` ENUM('GUEST', 'CUSTOMER', 'STAFF', 'SYSTEM') NOT NULL,
  `linkedByUserId` VARCHAR(30) NULL,
  `idempotencyKeyHash` CHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ChatConversationOrderLink_conversation_order_key` (`conversationId`, `orderId`),
  UNIQUE INDEX `ChatConversationOrderLink_idempotency_key` (`conversationId`, `idempotencyKeyHash`),
  INDEX `ChatConversationOrderLink_order_created_idx` (`orderId`, `createdAt`),
  INDEX `ChatConversationOrderLink_actor_created_idx` (`linkedByUserId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChatRetentionEvent` (
  `id` VARCHAR(30) NOT NULL,
  `conversationId` VARCHAR(30) NOT NULL,
  `reason` ENUM('RESOLVED_RETENTION', 'MANUAL_STAFF_ARCHIVE', 'SPAM_RETENTION') NOT NULL,
  `actorId` VARCHAR(30) NULL,
  `safeMetadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ChatRetentionEvent_conversation_created_idx` (`conversationId`, `createdAt`),
  INDEX `ChatRetentionEvent_reason_created_idx` (`reason`, `createdAt`),
  INDEX `ChatRetentionEvent_actor_created_idx` (`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ChatConversation`
  ADD CONSTRAINT `ChatConversation_guest_fkey`
  FOREIGN KEY (`guestSessionId`) REFERENCES `ChatGuestSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ChatConversation_customer_fkey`
  FOREIGN KEY (`customerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ChatConversation_assigned_fkey`
  FOREIGN KEY (`assignedStaffId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ChatMessage`
  ADD CONSTRAINT `ChatMessage_conversation_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChatReadCursor`
  ADD CONSTRAINT `ChatReadCursor_conversation_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChatConversationEvent`
  ADD CONSTRAINT `ChatConversationEvent_conversation_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChatAssignmentEvent`
  ADD CONSTRAINT `ChatAssignmentEvent_conversation_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChatInternalNote`
  ADD CONSTRAINT `ChatInternalNote_conversation_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ChatConversationOrderLink`
  ADD CONSTRAINT `ChatConversationOrderLink_conversation_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ChatConversationOrderLink_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ChatRetentionEvent`
  ADD CONSTRAINT `ChatRetentionEvent_conversation_fkey`
  FOREIGN KEY (`conversationId`) REFERENCES `ChatConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

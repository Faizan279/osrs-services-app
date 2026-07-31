-- TASK 013: additive cart, guest checkout and order foundation.

ALTER TABLE `ProductInventoryReservation`
  MODIFY `status` ENUM('ACTIVE', 'RELEASED', 'EXPIRED', 'CANCELLED', 'CONSUMED') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE `ProductReservationEvent`
  MODIFY `eventType` ENUM('ACTIVE', 'RELEASED', 'EXPIRED', 'CANCELLED', 'CONSUMED') NOT NULL;

ALTER TABLE `AccountListingHold`
  MODIFY `status` ENUM('ACTIVE', 'RELEASED', 'EXPIRED', 'CANCELLED', 'CONSUMED') NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE `CheckoutSettings` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'USD',
  `maximumCartItems` INTEGER NOT NULL DEFAULT 12,
  `cartExpiryMinutes` INTEGER NOT NULL DEFAULT 4320,
  `checkoutReservationMinutes` INTEGER NOT NULL DEFAULT 45,
  `orderNumberPrefix` VARCHAR(12) NOT NULL DEFAULT 'OSRS',
  `termsVersion` VARCHAR(80) NOT NULL DEFAULT 'needs-client-review',
  `privacyPolicyVersion` VARCHAR(80) NOT NULL DEFAULT 'needs-client-review',
  `publicCheckoutInstructions` TEXT NOT NULL,
  `publicPaymentReviewInstructions` TEXT NOT NULL,
  `guestCheckoutEnabled` BOOLEAN NOT NULL DEFAULT false,
  `notificationProviderConfigured` BOOLEAN NOT NULL DEFAULT false,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CheckoutSettings_stableKey_key` (`stableKey`),
  INDEX `CheckoutSettings_currency_idx` (`currencyCode`),
  INDEX `CheckoutSettings_review_idx` (`needsClientReview`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CheckoutPaymentMethod` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(120) NOT NULL,
  `settingsId` VARCHAR(30) NOT NULL,
  `methodType` ENUM('MANUAL_REVIEW') NOT NULL DEFAULT 'MANUAL_REVIEW',
  `publicName` VARCHAR(120) NOT NULL,
  `publicDescription` VARCHAR(500) NOT NULL,
  `publicInstructions` TEXT NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `needsClientReview` BOOLEAN NOT NULL DEFAULT true,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CheckoutPaymentMethod_stableKey_key` (`stableKey`),
  INDEX `CheckoutPaymentMethod_settings_idx` (`settingsId`, `enabled`, `sortOrder`),
  INDEX `CheckoutPaymentMethod_type_idx` (`methodType`, `enabled`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Cart` (
  `id` VARCHAR(30) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `status` ENUM('ACTIVE', 'CHECKOUT_IN_PROGRESS', 'CONVERTED', 'EXPIRED', 'ABANDONED') NOT NULL DEFAULT 'ACTIVE',
  `compatibilityGroup` ENUM('STANDARD_SERVICE', 'ACCOUNT_LISTING', 'GOLD_BUY', 'ACCEPTED_CUSTOM_QUOTE') NULL,
  `currencyCode` CHAR(3) NULL,
  `subtotalCents` INTEGER NOT NULL DEFAULT 0,
  `adjustmentTotalCents` INTEGER NOT NULL DEFAULT 0,
  `finalTotalCents` INTEGER NOT NULL DEFAULT 0,
  `itemCount` INTEGER NOT NULL DEFAULT 0,
  `expiresAt` DATETIME(3) NOT NULL,
  `convertedAt` DATETIME(3) NULL,
  `abandonedAt` DATETIME(3) NULL,
  `lastRevalidatedAt` DATETIME(3) NULL,
  `priceAcceptedAt` DATETIME(3) NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Cart_tokenHash_key` (`tokenHash`),
  INDEX `Cart_status_expires_idx` (`status`, `expiresAt`),
  INDEX `Cart_compatibility_idx` (`compatibilityGroup`),
  INDEX `Cart_currency_idx` (`currencyCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CartItem` (
  `id` VARCHAR(30) NOT NULL,
  `cartId` VARCHAR(30) NOT NULL,
  `kind` ENUM('SKILLING_ESTIMATE', 'BOSSING_ESTIMATE', 'PREMIUM_ESTIMATE', 'PRODUCT_ESTIMATE', 'ACCOUNT_LISTING_ESTIMATE', 'GOLD_BUY_ESTIMATE', 'ACCEPTED_CUSTOM_BUILD_QUOTE') NOT NULL,
  `compatibilityGroup` ENUM('STANDARD_SERVICE', 'ACCOUNT_LISTING', 'GOLD_BUY', 'ACCEPTED_CUSTOM_QUOTE') NOT NULL,
  `sourceReference` VARCHAR(191) NOT NULL,
  `publicSourceSlug` VARCHAR(191) NULL,
  `quantity` BIGINT NOT NULL DEFAULT 1,
  `currencyCode` CHAR(3) NOT NULL,
  `customerSelections` JSON NULL,
  `snapshotSchemaVersion` INTEGER NOT NULL DEFAULT 1,
  `customerSafeSnapshot` JSON NOT NULL,
  `sourcePublishedRevisionId` VARCHAR(80) NULL,
  `sourcePublishedRevisionNumber` INTEGER NULL,
  `globalPricingRevisionId` VARCHAR(80) NULL,
  `globalPricingRevisionNumber` INTEGER NULL,
  `subtotalCents` INTEGER NOT NULL DEFAULT 0,
  `adjustmentTotalCents` INTEGER NOT NULL DEFAULT 0,
  `finalTotalCents` INTEGER NOT NULL DEFAULT 0,
  `validationState` ENUM('VALID', 'REPRICE_REQUIRED', 'UNAVAILABLE', 'OUT_OF_STOCK', 'RESERVATION_REQUIRED', 'MANUAL_REVIEW_REQUIRED', 'INCOMPATIBLE') NOT NULL DEFAULT 'VALID',
  `repricingRequired` BOOLEAN NOT NULL DEFAULT false,
  `stockRecheckRequired` BOOLEAN NOT NULL DEFAULT false,
  `availabilityRecheckRequired` BOOLEAN NOT NULL DEFAULT false,
  `idempotencyKeyHash` CHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  UNIQUE INDEX `CartItem_cart_idempotency_key` (`cartId`, `idempotencyKeyHash`),
  INDEX `CartItem_cart_created_idx` (`cartId`, `createdAt`),
  INDEX `CartItem_kind_idx` (`kind`),
  INDEX `CartItem_compatibility_idx` (`compatibilityGroup`),
  INDEX `CartItem_validation_idx` (`validationState`),
  INDEX `CartItem_source_idx` (`sourceReference`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GuestOrderContact` (
  `id` VARCHAR(30) NOT NULL,
  `displayName` VARCHAR(120) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `discordUsername` VARCHAR(80) NULL,
  `rsn` VARCHAR(12) NULL,
  `consentAt` DATETIME(3) NOT NULL,
  `termsVersion` VARCHAR(80) NOT NULL,
  `privacyPolicyVersion` VARCHAR(80) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `GuestOrderContact_email_idx` (`email`),
  INDEX `GuestOrderContact_created_idx` (`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Order` (
  `id` VARCHAR(30) NOT NULL,
  `orderNumber` VARCHAR(40) NOT NULL,
  `cartId` VARCHAR(30) NULL,
  `guestContactId` VARCHAR(30) NOT NULL,
  `paymentMethodId` VARCHAR(30) NULL,
  `trackingTokenHash` CHAR(64) NOT NULL,
  `checkoutIdempotencyKeyHash` CHAR(64) NULL,
  `status` ENUM('AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAID', 'AWAITING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'REQUIRES_REVIEW') NOT NULL DEFAULT 'AWAITING_PAYMENT',
  `paymentStatus` ENUM('NOT_STARTED', 'AWAITING_INSTRUCTIONS', 'AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAID', 'CANCELLED', 'REFUNDED', 'DISPUTED') NOT NULL DEFAULT 'AWAITING_INSTRUCTIONS',
  `paymentMethodType` ENUM('MANUAL_REVIEW') NOT NULL DEFAULT 'MANUAL_REVIEW',
  `currencyCode` CHAR(3) NOT NULL,
  `subtotalCents` INTEGER NOT NULL DEFAULT 0,
  `adjustmentTotalCents` INTEGER NOT NULL DEFAULT 0,
  `finalTotalCents` INTEGER NOT NULL DEFAULT 0,
  `termsVersion` VARCHAR(80) NOT NULL,
  `privacyPolicyVersion` VARCHAR(80) NOT NULL,
  `paidAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  UNIQUE INDEX `Order_orderNumber_key` (`orderNumber`),
  UNIQUE INDEX `Order_trackingTokenHash_key` (`trackingTokenHash`),
  UNIQUE INDEX `Order_checkoutIdempotency_key` (`checkoutIdempotencyKeyHash`),
  INDEX `Order_cart_idx` (`cartId`),
  INDEX `Order_guestContact_created_idx` (`guestContactId`, `createdAt`),
  INDEX `Order_paymentMethod_idx` (`paymentMethodId`),
  INDEX `Order_status_created_idx` (`status`, `createdAt`),
  INDEX `Order_payment_status_created_idx` (`paymentStatus`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CheckoutAttempt` (
  `id` VARCHAR(30) NOT NULL,
  `cartId` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NULL,
  `idempotencyKeyHash` CHAR(64) NOT NULL,
  `requestHash` CHAR(64) NULL,
  `status` ENUM('STARTED', 'SUCCEEDED', 'FAILED', 'REPRICE_REQUIRED', 'REJECTED') NOT NULL DEFAULT 'STARTED',
  `failureCode` VARCHAR(80) NULL,
  `safeFailureSummary` VARCHAR(240) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CheckoutAttempt_cart_key_key` (`cartId`, `idempotencyKeyHash`),
  INDEX `CheckoutAttempt_status_created_idx` (`status`, `createdAt`),
  INDEX `CheckoutAttempt_order_idx` (`orderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CheckoutIdempotencyRecord` (
  `id` VARCHAR(30) NOT NULL,
  `cartId` VARCHAR(30) NULL,
  `scopeKey` VARCHAR(120) NOT NULL,
  `keyHash` CHAR(64) NOT NULL,
  `requestHash` CHAR(64) NULL,
  `status` ENUM('STARTED', 'SUCCEEDED', 'FAILED', 'REPRICE_REQUIRED', 'REJECTED') NOT NULL DEFAULT 'STARTED',
  `response` JSON NULL,
  `orderId` VARCHAR(30) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CheckoutIdempotency_scope_key` (`scopeKey`, `keyHash`),
  INDEX `CheckoutIdempotency_cart_created_idx` (`cartId`, `createdAt`),
  INDEX `CheckoutIdempotency_order_idx` (`orderId`),
  INDEX `CheckoutIdempotency_expires_idx` (`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrderItem` (
  `id` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NOT NULL,
  `cartItemId` VARCHAR(30) NULL,
  `kind` ENUM('SKILLING_ESTIMATE', 'BOSSING_ESTIMATE', 'PREMIUM_ESTIMATE', 'PRODUCT_ESTIMATE', 'ACCOUNT_LISTING_ESTIMATE', 'GOLD_BUY_ESTIMATE', 'ACCEPTED_CUSTOM_BUILD_QUOTE') NOT NULL,
  `status` ENUM('ACTIVE', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
  `publicTitle` VARCHAR(180) NOT NULL,
  `publicConfigurationSummary` TEXT NOT NULL,
  `quantity` BIGINT NOT NULL DEFAULT 1,
  `currencyCode` CHAR(3) NOT NULL,
  `priceLines` JSON NOT NULL,
  `subtotalCents` INTEGER NOT NULL DEFAULT 0,
  `adjustmentTotalCents` INTEGER NOT NULL DEFAULT 0,
  `finalTotalCents` INTEGER NOT NULL DEFAULT 0,
  `sourceReference` VARCHAR(191) NOT NULL,
  `publicSourceSlug` VARCHAR(191) NULL,
  `sourcePublishedRevisionId` VARCHAR(80) NULL,
  `sourcePublishedRevisionNumber` INTEGER NULL,
  `sourceSnapshotSchemaVersion` INTEGER NOT NULL DEFAULT 1,
  `customerSafeSnapshot` JSON NOT NULL,
  `resourceReservationState` ENUM('NONE', 'ACTIVE', 'RELEASED', 'EXPIRED', 'CONSUMED', 'FAILED') NOT NULL DEFAULT 'NONE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `OrderItem_order_idx` (`orderId`),
  INDEX `OrderItem_cartItem_idx` (`cartItemId`),
  INDEX `OrderItem_kind_idx` (`kind`),
  INDEX `OrderItem_resource_state_idx` (`resourceReservationState`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrderStatusEvent` (
  `id` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NOT NULL,
  `eventType` ENUM('CREATED', 'STATUS_CHANGED', 'PAYMENT_STATUS_CHANGED', 'PAYMENT_CONFIRMED', 'CANCELLED', 'RESERVATION_RELEASED', 'RESERVATION_EXPIRED', 'NOTIFICATION_CREATED') NOT NULL,
  `previousStatus` ENUM('AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAID', 'AWAITING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'REQUIRES_REVIEW') NULL,
  `newStatus` ENUM('AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAID', 'AWAITING_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED', 'REQUIRES_REVIEW') NOT NULL,
  `actorId` VARCHAR(30) NULL,
  `publicNote` VARCHAR(500) NULL,
  `privateInternalNote` TEXT NULL,
  `reasonCode` VARCHAR(80) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `safeMetadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `OrderStatusEvent_order_sequence_key` (`orderId`, `sequence`),
  INDEX `OrderStatusEvent_order_created_idx` (`orderId`, `createdAt`),
  INDEX `OrderStatusEvent_type_created_idx` (`eventType`, `createdAt`),
  INDEX `OrderStatusEvent_actor_created_idx` (`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrderPaymentEvent` (
  `id` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NOT NULL,
  `previousPaymentStatus` ENUM('NOT_STARTED', 'AWAITING_INSTRUCTIONS', 'AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAID', 'CANCELLED', 'REFUNDED', 'DISPUTED') NULL,
  `newPaymentStatus` ENUM('NOT_STARTED', 'AWAITING_INSTRUCTIONS', 'AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAID', 'CANCELLED', 'REFUNDED', 'DISPUTED') NOT NULL,
  `paymentMethodType` ENUM('MANUAL_REVIEW') NOT NULL DEFAULT 'MANUAL_REVIEW',
  `actorId` VARCHAR(30) NULL,
  `publicNote` VARCHAR(500) NULL,
  `privateInternalNote` TEXT NULL,
  `reasonCode` VARCHAR(80) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `idempotencyKeyHash` CHAR(64) NULL,
  `safeMetadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `OrderPaymentEvent_order_sequence_key` (`orderId`, `sequence`),
  UNIQUE INDEX `OrderPaymentEvent_order_idempotency_key` (`orderId`, `idempotencyKeyHash`),
  INDEX `OrderPaymentEvent_order_created_idx` (`orderId`, `createdAt`),
  INDEX `OrderPaymentEvent_status_created_idx` (`newPaymentStatus`, `createdAt`),
  INDEX `OrderPaymentEvent_actor_created_idx` (`actorId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GoldInventoryReservation` (
  `id` VARCHAR(30) NOT NULL,
  `stableKey` VARCHAR(160) NOT NULL,
  `marketId` VARCHAR(30) NOT NULL,
  `quantityGp` BIGINT NOT NULL,
  `status` ENUM('ACTIVE', 'RELEASED', 'EXPIRED', 'CONSUMED') NOT NULL DEFAULT 'ACTIVE',
  `expiresAt` DATETIME(3) NOT NULL,
  `releasedAt` DATETIME(3) NULL,
  `consumedAt` DATETIME(3) NULL,
  `safeInternalPurpose` VARCHAR(240) NOT NULL,
  `actorId` VARCHAR(30) NULL,
  `idempotencyKeyHash` CHAR(64) NULL,
  `futureExternalRef` VARCHAR(160) NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `GoldReservation_stableKey_key` (`stableKey`),
  UNIQUE INDEX `GoldReservation_idempotency_key` (`idempotencyKeyHash`),
  INDEX `GoldReservation_market_status_idx` (`marketId`, `status`, `expiresAt`),
  INDEX `GoldReservation_actor_created_idx` (`actorId`, `createdAt`),
  INDEX `GoldReservation_future_ref_idx` (`futureExternalRef`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrderResourceAllocation` (
  `id` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NOT NULL,
  `orderItemId` VARCHAR(30) NOT NULL,
  `itemKind` ENUM('SKILLING_ESTIMATE', 'BOSSING_ESTIMATE', 'PREMIUM_ESTIMATE', 'PRODUCT_ESTIMATE', 'ACCOUNT_LISTING_ESTIMATE', 'GOLD_BUY_ESTIMATE', 'ACCEPTED_CUSTOM_BUILD_QUOTE') NOT NULL,
  `state` ENUM('NONE', 'ACTIVE', 'RELEASED', 'EXPIRED', 'CONSUMED', 'FAILED') NOT NULL DEFAULT 'ACTIVE',
  `productReservationId` VARCHAR(30) NULL,
  `accountHoldId` VARCHAR(30) NULL,
  `goldReservationId` VARCHAR(30) NULL,
  `quantity` BIGINT NULL,
  `expiresAt` DATETIME(3) NULL,
  `releasedAt` DATETIME(3) NULL,
  `consumedAt` DATETIME(3) NULL,
  `safeMetadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `concurrencyVersion` INTEGER NOT NULL DEFAULT 1,
  UNIQUE INDEX `OrderAllocation_productReservation_key` (`productReservationId`),
  UNIQUE INDEX `OrderAllocation_accountHold_key` (`accountHoldId`),
  UNIQUE INDEX `OrderAllocation_goldReservation_key` (`goldReservationId`),
  INDEX `OrderAllocation_order_state_idx` (`orderId`, `state`),
  INDEX `OrderAllocation_item_idx` (`orderItemId`),
  INDEX `OrderAllocation_kind_state_idx` (`itemKind`, `state`),
  INDEX `OrderAllocation_expires_idx` (`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrderNotificationOutbox` (
  `id` VARCHAR(30) NOT NULL,
  `orderId` VARCHAR(30) NOT NULL,
  `notificationType` ENUM('ORDER_CONFIRMATION') NOT NULL,
  `status` ENUM('PENDING', 'SUPPRESSED_NOT_CONFIGURED', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `recipientHash` CHAR(64) NULL,
  `templateVersion` VARCHAR(80) NOT NULL,
  `payload` JSON NOT NULL,
  `deliveryAttemptCount` INTEGER NOT NULL DEFAULT 0,
  `nextAttemptAt` DATETIME(3) NULL,
  `lastAttemptAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `OrderNotification_order_created_idx` (`orderId`, `createdAt`),
  INDEX `OrderNotification_type_status_idx` (`notificationType`, `status`),
  INDEX `OrderNotification_nextAttempt_idx` (`nextAttemptAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CheckoutPaymentMethod`
  ADD CONSTRAINT `CheckoutPaymentMethod_settings_fkey`
  FOREIGN KEY (`settingsId`) REFERENCES `CheckoutSettings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CartItem`
  ADD CONSTRAINT `CartItem_cart_fkey`
  FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Order`
  ADD CONSTRAINT `Order_cart_fkey`
  FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Order_guestContact_fkey`
  FOREIGN KEY (`guestContactId`) REFERENCES `GuestOrderContact`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `Order_paymentMethod_fkey`
  FOREIGN KEY (`paymentMethodId`) REFERENCES `CheckoutPaymentMethod`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CheckoutAttempt`
  ADD CONSTRAINT `CheckoutAttempt_cart_fkey`
  FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `CheckoutAttempt_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CheckoutIdempotencyRecord`
  ADD CONSTRAINT `CheckoutIdempotency_cart_fkey`
  FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `CheckoutIdempotency_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrderItem`
  ADD CONSTRAINT `OrderItem_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderItem_cartItem_fkey`
  FOREIGN KEY (`cartItemId`) REFERENCES `CartItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrderStatusEvent`
  ADD CONSTRAINT `OrderStatusEvent_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderStatusEvent_actor_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrderPaymentEvent`
  ADD CONSTRAINT `OrderPaymentEvent_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderPaymentEvent_actor_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `GoldInventoryReservation`
  ADD CONSTRAINT `GoldReservation_market_fkey`
  FOREIGN KEY (`marketId`) REFERENCES `GoldMarket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `GoldReservation_actor_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrderResourceAllocation`
  ADD CONSTRAINT `OrderAllocation_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderAllocation_item_fkey`
  FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderAllocation_productReservation_fkey`
  FOREIGN KEY (`productReservationId`) REFERENCES `ProductInventoryReservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderAllocation_accountHold_fkey`
  FOREIGN KEY (`accountHoldId`) REFERENCES `AccountListingHold`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `OrderAllocation_goldReservation_fkey`
  FOREIGN KEY (`goldReservationId`) REFERENCES `GoldInventoryReservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OrderNotificationOutbox`
  ADD CONSTRAINT `OrderNotification_order_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

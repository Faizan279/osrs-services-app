CREATE TABLE `User` (
  `id` VARCHAR(30) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `emailVerified` DATETIME(3) NULL,
  `name` VARCHAR(120) NULL,
  `image` VARCHAR(500) NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  INDEX `User_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Role` (
  `id` VARCHAR(30) NOT NULL,
  `key` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) NULL,
  `isSystem` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Role_key_key`(`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Permission` (
  `id` VARCHAR(30) NOT NULL,
  `key` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `Permission_key_key`(`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserRole` (
  `userId` VARCHAR(30) NOT NULL,
  `roleId` VARCHAR(30) NOT NULL,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `assignedBy` VARCHAR(30) NULL,
  INDEX `UserRole_roleId_idx`(`roleId`),
  PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RolePermission` (
  `roleId` VARCHAR(30) NOT NULL,
  `permissionId` VARCHAR(30) NOT NULL,
  `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RolePermission_permissionId_idx`(`permissionId`),
  PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Session` (
  `id` VARCHAR(30) NOT NULL,
  `sessionToken` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `expires` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ipAddress` VARCHAR(64) NULL,
  `userAgent` VARCHAR(500) NULL,
  UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
  INDEX `Session_userId_idx`(`userId`),
  INDEX `Session_expires_idx`(`expires`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FeatureFlag` (
  `id` VARCHAR(30) NOT NULL,
  `key` VARCHAR(120) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `description` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `FeatureFlag_key_key`(`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditLog` (
  `id` VARCHAR(30) NOT NULL,
  `actorId` VARCHAR(30) NULL,
  `action` VARCHAR(120) NOT NULL,
  `targetType` VARCHAR(120) NULL,
  `targetId` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `ipAddress` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
  INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
  INDEX `AuditLog_targetType_targetId_idx`(`targetType`, `targetId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

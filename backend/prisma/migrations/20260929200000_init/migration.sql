-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sender` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `displayName` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `hourlySendLimit` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Sender_email_key`(`email`),
    INDEX `Sender_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `senderId` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `scheduledAt` DATETIME(3) NULL,
    `workerJobId` VARCHAR(255) NULL,
    `idempotencyKey` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Campaign_workerJobId_key`(`workerJobId`),
    UNIQUE INDEX `Campaign_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Campaign_userId_status_scheduledAt_idx`(`userId`, `status`, `scheduledAt`),
    INDEX `Campaign_senderId_status_idx`(`senderId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Email` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `campaignId` CHAR(36) NOT NULL,
    `senderId` CHAR(36) NOT NULL,
    `recipientEmail` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(998) NOT NULL,
    `htmlBody` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `providerMessageId` VARCHAR(255) NULL,
    `workerJobId` VARCHAR(255) NULL,
    `idempotencyKey` VARCHAR(255) NULL,
    `failureReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Email_providerMessageId_key`(`providerMessageId`),
    UNIQUE INDEX `Email_workerJobId_key`(`workerJobId`),
    UNIQUE INDEX `Email_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Email_userId_status_scheduledAt_idx`(`userId`, `status`, `scheduledAt`),
    INDEX `Email_senderId_status_scheduledAt_idx`(`senderId`, `status`, `scheduledAt`),
    UNIQUE INDEX `Email_campaignId_recipientEmail_key`(`campaignId`, `recipientEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SlackConnection` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `workspaceId` VARCHAR(255) NOT NULL,
    `workspaceName` VARCHAR(255) NULL,
    `encryptedAccessToken` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SlackConnection_userId_key`(`userId`),
    UNIQUE INDEX `SlackConnection_workspaceId_key`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Sender` ADD CONSTRAINT `Sender_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `Sender`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Email` ADD CONSTRAINT `Email_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Email` ADD CONSTRAINT `Email_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Email` ADD CONSTRAINT `Email_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `Sender`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SlackConnection` ADD CONSTRAINT `SlackConnection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

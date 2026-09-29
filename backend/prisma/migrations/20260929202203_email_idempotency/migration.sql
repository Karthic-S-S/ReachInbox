-- AlterTable
ALTER TABLE `Email` ADD COLUMN `processingStartedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Email_status_processingStartedAt_idx` ON `Email`(`status`, `processingStartedAt`);

ALTER TABLE `User`
  ADD COLUMN `googleId` VARCHAR(255) NULL,
  ADD COLUMN `avatar` VARCHAR(2048) NULL;

CREATE UNIQUE INDEX `User_googleId_key` ON `User`(`googleId`);

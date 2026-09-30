ALTER TABLE `SlackConnection`
  ADD COLUMN `channelId` VARCHAR(255) NULL;

DROP INDEX `SlackConnection_workspaceId_key` ON `SlackConnection`;
CREATE INDEX `SlackConnection_workspaceId_idx` ON `SlackConnection`(`workspaceId`);

-- Additive, non-destructive MySQL migration for Phase 2 Transactional Order Notifications
-- Statements are intentionally atomic so idempotent bootstrap checks can safely replay any missing statement.

ALTER TABLE `orders` ADD COLUMN `whatsappOptIn` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `orders` ADD COLUMN `whatsappOptInAt` DATETIME(3) NULL;
ALTER TABLE `orders` ADD COLUMN `whatsappNumber` VARCHAR(191) NULL;

ALTER TABLE `notification_deliveries` MODIFY COLUMN `subscriberId` VARCHAR(191) NULL;
ALTER TABLE `notification_deliveries` ADD COLUMN `orderId` VARCHAR(191) NULL;
ALTER TABLE `notification_deliveries` ADD COLUMN `metadataJson` TEXT NULL;

CREATE INDEX `notification_deliveries_orderId_idx` ON `notification_deliveries`(`orderId`);
CREATE INDEX `notification_deliveries_orderId_eventType_channel_idx` ON `notification_deliveries`(`orderId`, `eventType`, `channel`);

-- Add optional campaign-specific coupon selection.
ALTER TABLE `notification_campaigns` ADD COLUMN `couponCode` VARCHAR(191) NULL;

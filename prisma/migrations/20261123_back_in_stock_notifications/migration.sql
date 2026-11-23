-- Phase 3: Tori-Wear Back-in-Stock Subscriptions & Customer Website Notifications
-- Additive, non-destructive MySQL 8 migration (idempotent with init-mysql.ts).

ALTER TABLE `notification_deliveries`
  ADD COLUMN `subscriptionId` VARCHAR(191) NULL;

CREATE INDEX `notification_deliveries_subscriptionId_idx`
  ON `notification_deliveries`(`subscriptionId`);

CREATE INDEX `notification_deliveries_subscriptionId_eventType_channel_idx`
  ON `notification_deliveries`(`subscriptionId`, `eventType`, `channel`);

CREATE TABLE IF NOT EXISTS `back_in_stock_subscriptions` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `productName` VARCHAR(191) NOT NULL,
  `productSlug` VARCHAR(191) NULL,
  `productImage` TEXT NULL,
  `variantId` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NULL,
  `size` VARCHAR(191) NOT NULL,
  `color` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `customerName` VARCHAR(191) NULL,
  `phoneE164` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `whatsappConsent` BOOLEAN NOT NULL DEFAULT false,
  `whatsappConsentAt` DATETIME(3) NULL,
  `websiteEnabled` BOOLEAN NOT NULL DEFAULT true,
  `browserPushEnabled` BOOLEAN NOT NULL DEFAULT false,
  `emailBackupEnabled` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `whatsappStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `websiteStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `browserPushStatus` VARCHAR(191) NOT NULL DEFAULT 'SKIPPED',
  `emailStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `lastRestockBatchId` VARCHAR(191) NULL,
  `lastFailureSummary` TEXT NULL,
  `notifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `back_in_stock_subscriptions_variantId_status_idx`(`variantId`, `status`),
  INDEX `back_in_stock_subscriptions_productId_idx`(`productId`),
  INDEX `back_in_stock_subscriptions_customerId_idx`(`customerId`),
  INDEX `back_in_stock_subscriptions_phoneE164_idx`(`phoneE164`),
  INDEX `back_in_stock_subscriptions_email_idx`(`email`),
  INDEX `back_in_stock_subscriptions_status_idx`(`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_notifications` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `customerEmail` VARCHAR(191) NULL,
  `customerPhone` VARCHAR(191) NULL,
  `subscriptionId` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'BACK_IN_STOCK',
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `productId` VARCHAR(191) NULL,
  `productSlug` VARCHAR(191) NULL,
  `productName` VARCHAR(191) NULL,
  `productImage` TEXT NULL,
  `variantId` VARCHAR(191) NULL,
  `size` VARCHAR(191) NULL,
  `color` VARCHAR(191) NULL,
  `actionUrl` TEXT NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `readAt` DATETIME(3) NULL,
  `browserPushStatus` VARCHAR(191) NOT NULL DEFAULT 'SKIPPED',
  `browserPushedAt` DATETIME(3) NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `customer_notifications_idempotencyKey_key`(`idempotencyKey`),
  INDEX `customer_notifications_customerId_isRead_idx`(`customerId`, `isRead`),
  INDEX `customer_notifications_customerEmail_idx`(`customerEmail`),
  INDEX `customer_notifications_customerPhone_idx`(`customerPhone`),
  INDEX `customer_notifications_subscriptionId_idx`(`subscriptionId`),
  INDEX `customer_notifications_createdAt_idx`(`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

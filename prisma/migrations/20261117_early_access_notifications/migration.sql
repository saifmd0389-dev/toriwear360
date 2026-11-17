-- Additive, non-destructive MySQL migration for Early Access notifications & Coupon eligibility/usage tracking

CREATE TABLE IF NOT EXISTS `early_access_subscribers` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `whatsappNumber` VARCHAR(191) NULL,
    `preferredChannel` ENUM('EMAIL', 'WHATSAPP', 'BOTH') NOT NULL DEFAULT 'EMAIL',
    `emailConsent` BOOLEAN NOT NULL DEFAULT false,
    `emailConsentAt` DATETIME(3) NULL,
    `whatsappConsent` BOOLEAN NOT NULL DEFAULT false,
    `whatsappConsentAt` DATETIME(3) NULL,
    `registrationSource` VARCHAR(191) NOT NULL DEFAULT 'MAINTENANCE_SCREEN',
    `status` ENUM('ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `unsubscribeTokenHash` VARCHAR(191) NULL,
    `unsubscribedAt` DATETIME(3) NULL,
    `unsubscribeReason` TEXT NULL,
    `couponCode` VARCHAR(191) NULL,
    `couponEligible` BOOLEAN NOT NULL DEFAULT false,
    `couponRedeemedAt` DATETIME(3) NULL,
    `lastNotifiedAt` DATETIME(3) NULL,
    `metadataJson` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `early_access_subscribers_email_key`(`email`),
    UNIQUE INDEX `early_access_subscribers_whatsappNumber_key`(`whatsappNumber`),
    UNIQUE INDEX `early_access_subscribers_unsubscribeTokenHash_key`(`unsubscribeTokenHash`),
    INDEX `early_access_subscribers_status_idx`(`status`),
    INDEX `early_access_subscribers_preferredChannel_idx`(`preferredChannel`),
    INDEX `early_access_subscribers_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `campaignType` VARCHAR(191) NOT NULL DEFAULT 'LAUNCH_ANNOUNCEMENT',
    `subject` VARCHAR(191) NULL,
    `emailHtml` LONGTEXT NULL,
    `emailText` TEXT NULL,
    `whatsappTemplateName` VARCHAR(191) NULL,
    `whatsappTemplateLang` VARCHAR(191) NULL,
    `whatsappVariablesJson` TEXT NULL,
    `channels` ENUM('EMAIL', 'WHATSAPP', 'BOTH') NOT NULL DEFAULT 'BOTH',
    `status` ENUM('DRAFT', 'CONFIRMED', 'SENDING', 'COMPLETED', 'PARTIAL_FAILURE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `recipientCount` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `deliveredCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `createdByUserId` VARCHAR(191) NULL,
    `confirmedByUserId` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `notification_campaigns_status_idx`(`status`),
    INDEX `notification_campaigns_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `subscriberId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `eventType` VARCHAR(191) NOT NULL DEFAULT 'LAUNCH_ANNOUNCEMENT',
    `channel` ENUM('EMAIL', 'WHATSAPP') NOT NULL,
    `recipientMask` VARCHAR(191) NOT NULL,
    `providerName` VARCHAR(191) NOT NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `lastAttemptAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `providerResponseJson` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notification_deliveries_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `notification_deliveries_campaignId_subscriberId_channel_key`(`campaignId`, `subscriberId`, `channel`),
    INDEX `notification_deliveries_providerMessageId_idx`(`providerMessageId`),
    INDEX `notification_deliveries_status_idx`(`status`),
    INDEX `notification_deliveries_subscriberId_idx`(`subscriberId`),
    INDEX `notification_deliveries_campaignId_idx`(`campaignId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `notification_deliveries_subscriberId_fkey` FOREIGN KEY (`subscriberId`) REFERENCES `early_access_subscribers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `notification_deliveries_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `notification_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `coupons`
    ADD COLUMN `eligibleCategories` TEXT NULL,
    ADD COLUMN `eligibleProductIds` TEXT NULL,
    ADD COLUMN `excludeShipping` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `excludeTax` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `coupon_usage`
    ADD COLUMN `customerEmail` VARCHAR(191) NULL,
    ADD COLUMN `customerPhone` VARCHAR(191) NULL;

CREATE INDEX `coupon_usage_couponId_customerId_idx` ON `coupon_usage`(`couponId`, `customerId`);
CREATE INDEX `coupon_usage_couponId_customerEmail_idx` ON `coupon_usage`(`couponId`, `customerEmail`);
CREATE INDEX `coupon_usage_couponId_customerPhone_idx` ON `coupon_usage`(`couponId`, `customerPhone`);

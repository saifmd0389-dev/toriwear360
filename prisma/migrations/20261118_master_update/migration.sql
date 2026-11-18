-- Additive, non-destructive MySQL migration for Master Website Update:
-- 1. Dynamic Categories hierarchy, SEO & nav visibility
-- 2. Product multi-category linkage
-- 3. Customer ReturnRequests, ReturnItems & ReturnStatusHistory

ALTER TABLE `categories`
    MODIFY COLUMN `department` ENUM('ALL', 'MEN', 'KIDS', 'UNISEX') NOT NULL DEFAULT 'MEN',
    ADD COLUMN `parentId` VARCHAR(191) NULL,
    ADD COLUMN `seoTitle` VARCHAR(191) NULL,
    ADD COLUMN `seoDescription` TEXT NULL,
    ADD COLUMN `showInNav` BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX `categories_parentId_idx` ON `categories`(`parentId`);

ALTER TABLE `products`
    MODIFY COLUMN `department` ENUM('ALL', 'MEN', 'KIDS', 'UNISEX') NOT NULL DEFAULT 'MEN',
    ADD COLUMN `categoryIdsJson` TEXT NULL;

CREATE TABLE IF NOT EXISTS `return_requests` (
    `id` VARCHAR(191) NOT NULL,
    `returnNumber` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `requestType` VARCHAR(191) NOT NULL DEFAULT 'RETURN',
    `reason` VARCHAR(191) NOT NULL,
    `comments` TEXT NULL,
    `proofFilesJson` TEXT NULL,
    `status` ENUM('RETURN_REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'IN_TRANSIT', 'RETURNED_TO_WAREHOUSE', 'REFUND_PROCESSING', 'REFUNDED', 'CLOSED') NOT NULL DEFAULT 'RETURN_REQUESTED',
    `rejectionReason` TEXT NULL,
    `courierPartner` VARCHAR(191) NULL,
    `awbNumber` VARCHAR(191) NULL,
    `pickupScheduledAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `restockedAt` DATETIME(3) NULL,
    `refundAmount` DOUBLE NOT NULL DEFAULT 0.0,
    `refundMethod` VARCHAR(191) NULL,
    `refundId` VARCHAR(191) NULL,
    `refundStatus` VARCHAR(191) NULL,
    `refundReference` VARCHAR(191) NULL,
    `refundedAt` DATETIME(3) NULL,
    `adminNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `return_requests_returnNumber_key`(`returnNumber`),
    INDEX `return_requests_orderId_idx`(`orderId`),
    INDEX `return_requests_orderNumber_idx`(`orderNumber`),
    INDEX `return_requests_customerId_idx`(`customerId`),
    INDEX `return_requests_status_idx`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `return_requests_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `return_items` (
    `id` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `size` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DOUBLE NOT NULL,
    `refundAmount` DOUBLE NOT NULL,
    `restocked` BOOLEAN NOT NULL DEFAULT false,
    `restockedAt` DATETIME(3) NULL,

    INDEX `return_items_returnRequestId_idx`(`returnRequestId`),
    INDEX `return_items_orderItemId_idx`(`orderItemId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `return_items_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `return_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NOT NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `actorRole` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `return_status_history_returnRequestId_idx`(`returnRequestId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `return_status_history_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

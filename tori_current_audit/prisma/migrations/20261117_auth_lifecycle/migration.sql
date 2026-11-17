-- Additive MySQL migration: persistent, single-use staff invitation tokens.
CREATE TABLE IF NOT EXISTS `staff_invitation_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `used` BOOLEAN NOT NULL DEFAULT false,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `staff_invitation_tokens_token_key` (`token`),
  INDEX `staff_invitation_tokens_email_idx` (`email`),
  INDEX `staff_invitation_tokens_userId_idx` (`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `staff_invitation_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

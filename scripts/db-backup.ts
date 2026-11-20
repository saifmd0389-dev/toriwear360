/**
 * TORIWEAR Database Backup Script
 * 
 * Safely exports all business-critical tables into a versioned, timestamped JSON archive
 * with SHA-256 integrity checksum. Does NOT truncate or lock database.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPrismaClient } from '../server/db/prisma';

async function runBackup() {
  console.log('[BACKUP] Starting TORIWEAR database snapshot...');
  const prisma = getPrismaClient();

  if (!prisma) {
    console.error('[BACKUP] Cannot connect to MySQL instance. Configure DB_HOST/DB_NAME/DB_USER/DB_PASSWORD or DATABASE_URL.');
    process.exit(1);
  }

  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `toriwear_backup_${timestamp}.json`);

  try {
    const [
      users,
      twoFactorSettings,
      partners,
      staff,
      categories,
      collections,
      products,
      variants,
      productImages,
      inventory,
      customers,
      customerAddresses,
      reviews,
      reviewImages,
      orders,
      orderItems,
      orderAddresses,
      orderStatusHistory,
      payments,
      paymentTransactions,
      shipments,
      returnRequests,
      returnItems,
      returnStatusHistory,
      coupons,
      earlyAccessSubscribers,
      notificationCampaigns,
      notificationDeliveries,
      websiteSettings,
      financialAccounts,
      financialTransactions,
      expenses,
      auditLogs,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.twoFactorSetting.findMany(),
      prisma.partner.findMany(),
      prisma.staff.findMany(),
      prisma.category.findMany(),
      prisma.collection.findMany(),
      prisma.product.findMany(),
      prisma.productVariant.findMany(),
      prisma.productImage.findMany(),
      prisma.inventory.findMany(),
      prisma.customer.findMany(),
      prisma.customerAddress.findMany(),
      prisma.review.findMany(),
      prisma.reviewImage.findMany(),
      prisma.order.findMany(),
      prisma.orderItem.findMany(),
      prisma.orderAddress.findMany(),
      prisma.orderStatusHistory.findMany(),
      prisma.payment.findMany(),
      prisma.paymentTransaction.findMany(),
      prisma.shipment.findMany(),
      prisma.returnRequest.findMany(),
      prisma.returnItem.findMany(),
      prisma.returnStatusHistory.findMany(),
      prisma.coupon.findMany(),
      prisma.earlyAccessSubscriber.findMany(),
      prisma.notificationCampaign.findMany(),
      prisma.notificationDelivery.findMany(),
      prisma.websiteSetting.findMany(),
      prisma.financialAccount.findMany(),
      prisma.financialTransaction.findMany(),
      prisma.expense.findMany(),
      prisma.auditLog.findMany({ take: 1000, orderBy: { createdAt: 'desc' } }),
    ]);

    const backupData = {
      version: '2.0',
      database: 'mysql',
      createdAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      stats: {
        users: users.length,
        twoFactorSettings: twoFactorSettings.length,
        partners: partners.length,
        staff: staff.length,
        categories: categories.length,
        collections: collections.length,
        products: products.length,
        variants: variants.length,
        productImages: productImages.length,
        inventory: inventory.length,
        customers: customers.length,
        customerAddresses: customerAddresses.length,
        reviews: reviews.length,
        reviewImages: reviewImages.length,
        orders: orders.length,
        orderItems: orderItems.length,
        orderAddresses: orderAddresses.length,
        orderStatusHistory: orderStatusHistory.length,
        payments: payments.length,
        paymentTransactions: paymentTransactions.length,
        shipments: shipments.length,
        returnRequests: returnRequests.length,
        returnItems: returnItems.length,
        returnStatusHistory: returnStatusHistory.length,
        coupons: coupons.length,
        earlyAccessSubscribers: earlyAccessSubscribers.length,
        notificationCampaigns: notificationCampaigns.length,
        notificationDeliveries: notificationDeliveries.length,
        websiteSettings: websiteSettings.length,
        financialAccounts: financialAccounts.length,
        financialTransactions: financialTransactions.length,
        expenses: expenses.length,
        auditLogs: auditLogs.length,
      },
      data: {
        users,
        twoFactorSettings,
        partners,
        staff,
        categories,
        collections,
        products,
        variants,
        productImages,
        inventory,
        customers,
        customerAddresses,
        reviews,
        reviewImages,
        orders,
        orderItems,
        orderAddresses,
        orderStatusHistory,
        payments,
        paymentTransactions,
        shipments,
        returnRequests,
        returnItems,
        returnStatusHistory,
        coupons,
        earlyAccessSubscribers,
        notificationCampaigns,
        notificationDeliveries,
        websiteSettings,
        financialAccounts,
        financialTransactions,
        expenses,
        auditLogs,
      },
    };

    const serialized = JSON.stringify(backupData, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2);

    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');
    const finalPayload = {
      checksum,
      ...JSON.parse(serialized),
    };

    fs.writeFileSync(backupFilePath, JSON.stringify(finalPayload, null, 2), 'utf8');

    console.log(`[BACKUP] Successfully created MySQL database backup!`);
    console.log(`[BACKUP] File: ${backupFilePath}`);
    console.log(`[BACKUP] SHA-256 Checksum: ${checksum}`);
    console.log(`[BACKUP] Total Records: ${Object.values(backupData.stats).reduce((a, b) => a + b, 0)}`);
  } catch (err) {
    console.error('[BACKUP] Failed to create database snapshot:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runBackup();

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
    console.error('[BACKUP] Cannot connect to PostgreSQL instance. DATABASE_URL is not configured.');
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
      inventory,
      customers,
      orders,
      orderItems,
      payments,
      shipments,
      coupons,
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
      prisma.inventory.findMany(),
      prisma.customer.findMany(),
      prisma.order.findMany(),
      prisma.orderItem.findMany(),
      prisma.payment.findMany(),
      prisma.shipment.findMany(),
      prisma.coupon.findMany(),
      prisma.financialAccount.findMany(),
      prisma.financialTransaction.findMany(),
      prisma.expense.findMany(),
      prisma.auditLog.findMany({ take: 500 }),
    ]);

    const backupData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      stats: {
        users: users.length,
        twoFactorSettings: twoFactorSettings.length,
        partners: partners.length,
        staff: staff.length,
        products: products.length,
        variants: variants.length,
        inventory: inventory.length,
        customers: customers.length,
        orders: orders.length,
        payments: payments.length,
        shipments: shipments.length,
        coupons: coupons.length,
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
        inventory,
        customers,
        orders,
        orderItems,
        payments,
        shipments,
        coupons,
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

    console.log(`[BACKUP] Successfully created database backup!`);
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

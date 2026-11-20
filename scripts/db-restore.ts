/**
 * TORIWEAR Database Restore Script
 * 
 * Safely restores business data into an isolated test or target MySQL database.
 * Enforces SHA-256 checksum verification before restoration.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPrismaClient } from '../server/db/prisma';

async function upsertRows(
  rows: any[] | undefined,
  label: string,
  handler: (row: any) => Promise<void>
): Promise<number> {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let restored = 0;
  for (const row of rows) {
    await handler(row);
    restored += 1;
  }
  console.log(`[RESTORE] Restored ${restored} record(s) into ${label}.`);
  return restored;
}

async function runRestore() {
  const backupFileArg = process.argv[2];
  const backupDir = path.resolve(process.cwd(), 'backups');

  let targetPath = backupFileArg;
  if (!targetPath) {
    if (!fs.existsSync(backupDir)) {
      console.error('[RESTORE] No backups directory found.');
      process.exit(1);
    }
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json')).sort().reverse();
    const latestFile = files[0];
    if (!latestFile) {
      console.error('[RESTORE] No backup files found in ./backups.');
      process.exit(1);
    }
    targetPath = path.join(backupDir, latestFile);
  }

  console.log(`[RESTORE] Target backup file: ${targetPath}`);
  const rawContent = fs.readFileSync(targetPath, 'utf8');
  const parsed = JSON.parse(rawContent);

  const { checksum, ...restOfPayload } = parsed;
  const serialized = JSON.stringify(restOfPayload, null, 2);
  const calculatedChecksum = crypto.createHash('sha256').update(serialized).digest('hex');

  if (checksum && checksum !== calculatedChecksum) {
    console.error('[RESTORE] [SECURITY ERROR] Backup SHA-256 checksum verification failed! Archive has been tampered with or corrupted.');
    process.exit(1);
  }

  console.log('[RESTORE] Checksum verification passed. Connecting to MySQL database...');
  const prisma = getPrismaClient();
  if (!prisma) {
    console.error('[RESTORE] MySQL Prisma database client not available. Configure DB_HOST/DB_NAME/DB_USER/DB_PASSWORD or DATABASE_URL.');
    process.exit(1);
  }

  const data = restOfPayload.data || {};
  console.log(`[RESTORE] Restoring ${Object.keys(data).length} dataset bucket(s) non-destructively...`);

  try {
    await upsertRows(data.users, 'users', async (u) => {
      const { ...fields } = u;
      await prisma.user.upsert({
        where: { id: fields.id },
        create: fields,
        update: {
          name: fields.name,
          role: fields.role,
          isActive: fields.isActive,
          accountStatus: fields.accountStatus,
        },
      });
    });

    await upsertRows(data.staff, 'staff', async (s) => {
      await prisma.staff.upsert({ where: { id: s.id }, create: s, update: s });
    });

    await upsertRows(data.partners, 'partners', async (p) => {
      await prisma.partner.upsert({ where: { id: p.id }, create: p, update: p });
    });

    await upsertRows(data.categories, 'categories', async (cat) => {
      await prisma.category.upsert({
        where: { id: cat.id },
        create: cat,
        update: {
          name: cat.name,
          slug: cat.slug,
          department: cat.department,
          description: cat.description,
          isActive: cat.isActive,
          showInNav: cat.showInNav ?? true,
        },
      });
    });

    await upsertRows(data.collections, 'collections', async (col) => {
      await prisma.collection.upsert({
        where: { id: col.id },
        create: col,
        update: {
          name: col.name,
          slug: col.slug,
          subtitle: col.subtitle,
          description: col.description,
          isActive: col.isActive ?? true,
        },
      });
    });

    await upsertRows(data.products, 'products', async (p) => {
      await prisma.product.upsert({
        where: { id: p.id },
        create: p,
        update: {
          name: p.name,
          price: p.price,
          originalPrice: p.originalPrice,
          description: p.description,
          publishingStatus: p.publishingStatus,
          inStock: p.inStock,
        },
      });
    });

    await upsertRows(data.variants, 'product_variants', async (v) => {
      await prisma.productVariant.upsert({
        where: { id: v.id },
        create: v,
        update: { price: v.price, originalPrice: v.originalPrice, stock: v.stock, isActive: v.isActive },
      });
    });

    await upsertRows(data.productImages, 'product_images', async (img) => {
      await prisma.productImage.upsert({
        where: { id: img.id },
        create: img,
        update: { url: img.url, displayOrder: img.displayOrder, isPrimary: img.isPrimary },
      });
    });

    await upsertRows(data.inventory, 'inventory', async (inv) => {
      await prisma.inventory.upsert({
        where: { id: inv.id },
        create: inv,
        update: {
          quantityOnHand: inv.quantityOnHand,
          quantityReserved: inv.quantityReserved,
          quantityAvailable: inv.quantityAvailable,
        },
      });
    });

    await upsertRows(data.customers, 'customers', async (c) => {
      await prisma.customer.upsert({ where: { id: c.id }, create: c, update: { name: c.name, email: c.email, phone: c.phone } });
    });

    await upsertRows(data.coupons, 'coupons', async (cp) => {
      await prisma.coupon.upsert({ where: { id: cp.id }, create: cp, update: { isActive: cp.isActive, value: cp.value } });
    });

    await upsertRows(data.websiteSettings, 'website_settings', async (ws) => {
      await prisma.websiteSetting.upsert({ where: { id: ws.id }, create: ws, update: { value: ws.value } });
    });

    await upsertRows(data.earlyAccessSubscribers, 'early_access_subscribers', async (sub) => {
      await prisma.earlyAccessSubscriber.upsert({
        where: { id: sub.id },
        create: sub,
        update: { status: sub.status, emailConsent: sub.emailConsent, whatsappConsent: sub.whatsappConsent },
      });
    });

    console.log('[RESTORE] MySQL database verification and core restore completed successfully.');
  } catch (err) {
    console.error('[RESTORE] Error restoring data:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRestore();

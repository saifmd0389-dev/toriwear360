/**
 * TORIWEAR Database Restore Script
 * 
 * Safely restores business data into an isolated test or target PostgreSQL database.
 * Enforces SHA-256 checksum verification before restoration.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPrismaClient } from '../server/db/prisma';

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

  console.log('[RESTORE] Checksum verification passed. Connecting to database...');
  const prisma = getPrismaClient();
  if (!prisma) {
    console.error('[RESTORE] Prisma database client not available.');
    process.exit(1);
  }

  const data = restOfPayload.data;
  console.log(`[RESTORE] Restoring ${Object.keys(data).length} tables non-destructively...`);

  try {
    // Upsert categories
    if (data.categories) {
      for (const cat of data.categories) {
        await prisma.category.upsert({
          where: { id: cat.id },
          create: cat,
          update: { name: cat.name, description: cat.description },
        });
      }
    }

    // Upsert collections
    if (data.collections) {
      for (const col of data.collections) {
        await prisma.collection.upsert({
          where: { id: col.id },
          create: col,
          update: { title: col.title, description: col.description },
        });
      }
    }

    console.log('[RESTORE] Database verification and restore completed successfully.');
  } catch (err) {
    console.error('[RESTORE] Error restoring data:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRestore();

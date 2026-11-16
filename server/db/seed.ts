/**
 * TORIWEAR Controlled Database Seed Script (MySQL / Prisma)
 *
 * Non-destructive:
 * - Checks for existing records before upserting/inserting.
 * - Seeds users, categories, collections, products, variants, images, inventory.
 * - Safely handles missing MySQL configuration in non-production.
 */

import { getPrismaClient } from './prisma';
import { PRODUCTS } from '../../src/data/products';
import { MEN_WORLDS, KIDS_WORLDS } from '../../src/data/constants';
import crypto from 'crypto';
import { encryptSecret, hashRecoveryCode, generateBase32Secret } from '../services/totpService';

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export async function seedCatalogIfEmpty(): Promise<{ seeded: boolean; count: number }> {
  const prisma = getPrismaClient();
  if (!prisma?.product) {
    return { seeded: false, count: 0 };
  }

  try {
    const existingCount = await prisma.product.count();
    if (existingCount > 0) {
      return { seeded: false, count: existingCount };
    }

    // Categories (Worlds)
    for (let i = 0; i < MEN_WORLDS.length; i++) {
      const w = MEN_WORLDS[i];
      if (!w) continue;
      const slug = w.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await prisma.category.upsert({
        where: { slug },
        create: {
          id: `cat-men-${i + 1}`,
          name: w.name,
          slug,
          department: 'MEN',
          description: w.tagline,
          image: w.heroImage,
          bannerImage: w.heroImage,
          displayOrder: i + 1,
          isActive: true,
        },
        update: {},
      });
    }

    for (let i = 0; i < KIDS_WORLDS.length; i++) {
      const w = KIDS_WORLDS[i];
      if (!w) continue;
      const slug = w.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await prisma.category.upsert({
        where: { slug },
        create: {
          id: `cat-kids-${i + 1}`,
          name: w.name,
          slug,
          department: 'KIDS',
          description: w.tagline,
          image: w.heroImage,
          bannerImage: w.heroImage,
          displayOrder: 10 + i + 1,
          isActive: true,
        },
        update: {},
      });
    }

    // Collections
    const collections = [
      { id: 'col-new-drop', name: 'New Drop & Chapter 01', slug: 'new-drop', displayOrder: 1 },
      { id: 'col-bestsellers', name: 'Top Selling & Cult Favorites', slug: 'top-selling', displayOrder: 2 },
      { id: 'col-trending', name: 'Trending Streetwear', slug: 'trending', displayOrder: 3 },
    ];

    for (const col of collections) {
      await prisma.collection.upsert({
        where: { slug: col.slug },
        create: {
          id: col.id,
          name: col.name,
          slug: col.slug,
          isFeatured: true,
          isActive: true,
          displayOrder: col.displayOrder,
        },
        update: {},
      });
    }

    // Products, Variants, Images, and Inventory
    let productCount = 0;
    for (const p of PRODUCTS) {
      const isKids = p.department === 'KIDS';
      const availableSizes = p.sizes && p.sizes.length > 0
        ? p.sizes
        : isKids
          ? ['2–3Y', '4–5Y', '6–7Y', '8–9Y', '10–11Y', '12–13Y']
          : ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

      const availableColors = p.colors && p.colors.length > 0
        ? p.colors
        : [{ name: 'Void Black', hex: '#0f0f14' }];

      const product = await prisma.product.upsert({
        where: { catalogNumber: p.catalogNumber || p.id },
        create: {
          id: p.id,
          catalogNumber: p.catalogNumber || p.id,
          name: p.name,
          slug: p.id.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          department: p.department,
          world: p.world,
          franchise: p.franchise,
          universe: p.universe || p.department,
          fit: p.fit,
          price: p.price,
          originalPrice: p.originalPrice,
          gsm: p.gsm || (isKids ? 180 : 240),
          fabric: p.fabric || '100% Combed Heavyweight Cotton',
          neck: p.neck || 'High-Ribbed Crewneck',
          sleeves: p.sleeves || 'Drop Shoulder Half Sleeves',
          print: p.print || 'High-Density Screen Print',
          description: p.description,
          storyQuote: p.storyQuote,
          drop: p.drop || 'CHAPTER 01 — ORIGINALS',
          rating: p.rating || 5.0,
          reviewsCount: p.reviewsCount || 100,
          isNewDrop: Boolean(p.isNewDrop ?? true),
          isBestseller: Boolean(p.isBestseller),
          isTrending: Boolean(p.isTrending),
          inStock: true,
          publishingStatus: 'PUBLISHED',
        },
        update: {},
      });

      for (const color of availableColors) {
        for (const size of availableSizes) {
          const cleanSize = size.replace(/[^a-zA-Z0-9]/g, '');
          const sku = `SKU-${p.catalogNumber || p.id}-${cleanSize}-${color.name.slice(0, 3).toUpperCase()}`;
          const variantId = `var-${p.id}-${cleanSize}-${color.name.slice(0, 3).toLowerCase()}`;

          await prisma.productVariant.upsert({
            where: { sku },
            create: {
              id: variantId,
              productId: product.id,
              sku,
              size,
              colorName: color.name,
              colorHex: color.hex,
              price: p.price,
              originalPrice: p.originalPrice,
              stock: 25,
              reservedStock: 0,
              isActive: true,
            },
            update: {},
          });

          await prisma.inventory.upsert({
            where: { variantId },
            create: {
              variantId,
              quantityOnHand: 25,
              quantityReserved: 0,
              quantityAvailable: 25,
              safetyStock: 5,
              reorderPoint: 15,
            },
            update: {},
          });
        }
      }

      if (p.images && p.images.length > 0) {
        for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
          const imgUrl = p.images[imgIdx];
          const imgId = `img-${p.id}-${imgIdx + 1}`;
          await prisma.productImage.upsert({
            where: { id: imgId },
            create: {
              id: imgId,
              productId: product.id,
              url: imgUrl,
              altText: `${p.name} - View ${imgIdx + 1}`,
              displayOrder: imgIdx,
              isPrimary: imgIdx === 0,
              angle: imgIdx === 0 ? 'FRONT' : imgIdx === 1 ? 'BACK' : 'DETAIL',
            },
            update: {},
          });
        }
      }

      productCount++;
    }

    console.log(`[SEED] Seeded ${productCount} products into MySQL catalog.`);
    return { seeded: true, count: productCount };
  } catch (err: any) {
    console.warn('[SEED] Catalog bootstrap note:', err?.message || err);
    return { seeded: false, count: 0 };
  }
}

export async function runDatabaseSeed(): Promise<{ success: boolean; message: string; count?: number }> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return {
      success: true,
      message: 'Running in safe in-memory repository fallback mode. Database is primed in memory.',
    };
  }

  const initialAdminPassword = (
    process.env.TORI_INITIAL_ADMIN_PASSWORD ||
    process.env.TORI_BOOTSTRAP_ADMIN_PASSWORD ||
    ''
  ).trim();
  if (!initialAdminPassword || initialAdminPassword.length < 8) {
    return {
      success: false,
      message: 'Set TORI_INITIAL_ADMIN_PASSWORD (or TORI_BOOTSTRAP_ADMIN_PASSWORD) to at least 8 characters before running the database seed.',
    };
  }

  console.log('[SEED] Starting non-destructive MySQL seed...');

  try {
    // 1. Seed Initial Admin & Partner Users
    const usersToSeed = [
      {
        id: 'usr-saif',
        email: 'saif@toriwear.com',
        name: 'Mohammed Saif',
        role: 'SUPER_ADMIN' as const,
        department: 'Founders Office & Brand Direction',
        employeeId: 'TORI-001',
        pass: initialAdminPassword,
        salt: crypto.randomBytes(16).toString('hex'),
        isPartner: true,
        equity: 25.0,
      },
      {
        id: 'usr-simranjeet',
        email: 'simranjeet@toriwear.com',
        name: 'Simranjeet Singh',
        role: 'PARTNER' as const,
        department: 'Production & Quality',
        employeeId: 'TORI-002',
        pass: crypto.randomBytes(32).toString('hex'),
        salt: crypto.randomBytes(16).toString('hex'),
        isPartner: true,
        equity: 25.0,
      },
      {
        id: 'usr-lokesh',
        email: 'lokesh@toriwear.com',
        name: 'Lokesh Kottala',
        role: 'PARTNER' as const,
        department: 'Design & Creative',
        employeeId: 'TORI-003',
        pass: crypto.randomBytes(32).toString('hex'),
        salt: crypto.randomBytes(16).toString('hex'),
        isPartner: true,
        equity: 25.0,
      },
      {
        id: 'usr-nagesh',
        email: 'nagesh@toriwear.com',
        name: 'Nagesh M',
        role: 'PARTNER' as const,
        department: 'Technology & Growth',
        employeeId: 'TORI-004',
        pass: crypto.randomBytes(32).toString('hex'),
        salt: crypto.randomBytes(16).toString('hex'),
        isPartner: true,
        equity: 25.0,
      },
      {
        id: 'usr-ananya',
        email: 'ananya@toriwear.com',
        name: 'Ananya Sharma',
        role: 'STORE_MANAGER' as const,
        department: 'Catalog & Merchandising',
        employeeId: 'TORI-EMP-005',
        pass: crypto.randomBytes(32).toString('hex'),
        salt: crypto.randomBytes(16).toString('hex'),
        isPartner: false,
        equity: 0,
      },
      {
        id: 'usr-vikram',
        email: 'vikram@toriwear.com',
        name: 'Vikram Malhotra',
        role: 'INVENTORY_MANAGER' as const,
        department: 'Inventory & Warehousing',
        employeeId: 'TORI-EMP-006',
        pass: crypto.randomBytes(32).toString('hex'),
        salt: crypto.randomBytes(16).toString('hex'),
        isPartner: false,
        equity: 0,
      },
      {
        id: 'usr-priya',
        email: 'priya@toriwear.com',
        name: 'Priya Sundaram',
        role: 'SUPPORT_STAFF' as const,
        department: 'Customer Delight',
        employeeId: 'TORI-EMP-007',
        pass: crypto.randomBytes(32).toString('hex'),
        salt: crypto.randomBytes(16).toString('hex'),
        isPartner: false,
        equity: 0,
      },
      {
        id: 'usr-rahul',
        email: 'rahul@toriwear.com',
        name: 'Rahul Verma',
        role: 'FULFILLMENT_STAFF' as const,
        department: 'Logistics & Dispatch',
        employeeId: 'TORI-EMP-008',
        pass: crypto.randomBytes(32).toString('hex'),
        salt: crypto.randomBytes(16).toString('hex'),
        isPartner: false,
        equity: 0,
      },
    ];

    for (const u of usersToSeed) {
      const hash = hashPassword(u.pass, u.salt);
      await prisma.user.upsert({
        where: { id: u.id },
        create: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          department: u.department,
          employeeId: u.employeeId,
          passwordHash: hash,
          salt: u.salt,
          isActive: true,
          accountStatus: 'ACTIVE',
        },
        update: {
          role: u.role,
          name: u.name,
          department: u.department,
          ...(u.id === 'usr-saif' && process.env.RESET_ADMIN_PASSWORD === 'true'
            ? { passwordHash: hash, salt: u.salt, failedLoginAttempts: 0, lockoutUntil: null }
            : {}),
        },
      });

      if (u.isPartner) {
        await prisma.partner.upsert({
          where: { userId: u.id },
          create: {
            id: `partner-${u.id}`,
            userId: u.id,
            partnerTier: 'EQUITY_PARTNER',
            equityPercentage: u.equity,
            profitSharePercentage: u.equity,
            votingRights: true,
          },
          update: {
            equityPercentage: u.equity,
            profitSharePercentage: u.equity,
            votingRights: true,
          },
        });
      } else {
        await prisma.staff.upsert({
          where: { userId: u.id },
          create: {
            id: `staff-${u.id}`,
            userId: u.id,
            department: u.department,
            designation: 'Operations Specialist',
            employeeNumber: u.employeeId,
          },
          update: {
            department: u.department,
          },
        });
      }

      // Seed 2FA Settings: Generate unique cryptographically random 160-bit secret and random recovery codes
      // Strictly avoid overwriting existing enrolled 2FA credentials
      const existing2FA = await prisma.twoFactorSetting.findUnique({
        where: { userId: u.id },
      });

      if (!existing2FA) {
        const rawSecret = generateBase32Secret(20); // 160 bits cryptographically secure
        const encSecret = encryptSecret(rawSecret);
        const freshRecoveryCodes = [
          crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
          crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
          crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
          crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
          crypto.randomBytes(3).toString('hex').toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
        ];
        const hashedCodes = freshRecoveryCodes.map(hashRecoveryCode);

        await prisma.twoFactorSetting.create({
          data: {
            id: `tfa-${u.id}`,
            userId: u.id,
            isEnabled: false,
            secret: encSecret,
            backupCodes: JSON.stringify(hashedCodes),
            lastAcceptedStep: null,
            verifiedAt: null,
          },
        });
      }
    }

    // 2. Seed Categories (Worlds)
    for (let i = 0; i < MEN_WORLDS.length; i++) {
      const w = MEN_WORLDS[i];
      if (!w) continue;
      const slug = w.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await prisma.category.upsert({
        where: { slug },
        create: {
          id: `cat-men-${i + 1}`,
          name: w.name,
          slug,
          department: 'MEN',
          description: w.tagline,
          image: w.heroImage,
          bannerImage: w.heroImage,
          displayOrder: i + 1,
          isActive: true,
        },
        update: {},
      });
    }

    for (let i = 0; i < KIDS_WORLDS.length; i++) {
      const w = KIDS_WORLDS[i];
      if (!w) continue;
      const slug = w.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await prisma.category.upsert({
        where: { slug },
        create: {
          id: `cat-kids-${i + 1}`,
          name: w.name,
          slug,
          department: 'KIDS',
          description: w.tagline,
          image: w.heroImage,
          bannerImage: w.heroImage,
          displayOrder: 10 + i + 1,
          isActive: true,
        },
        update: {},
      });
    }

    // 3. Seed Collections
    const collections = [
      { id: 'col-new-drop', name: 'New Drop & Chapter 01', slug: 'new-drop', displayOrder: 1 },
      { id: 'col-bestsellers', name: 'Top Selling & Cult Favorites', slug: 'top-selling', displayOrder: 2 },
      { id: 'col-trending', name: 'Trending Streetwear', slug: 'trending', displayOrder: 3 },
    ];

    for (const col of collections) {
      await prisma.collection.upsert({
        where: { slug: col.slug },
        create: {
          id: col.id,
          name: col.name,
          slug: col.slug,
          isFeatured: true,
          isActive: true,
          displayOrder: col.displayOrder,
        },
        update: {},
      });
    }

    // 4. Seed Products, Variants, Images, and Inventory
    let productCount = 0;
    for (const p of PRODUCTS) {
      const isKids = p.department === 'KIDS';
      const availableSizes = p.sizes && p.sizes.length > 0
        ? p.sizes
        : isKids
          ? ['2–3Y', '4–5Y', '6–7Y', '8–9Y', '10–11Y', '12–13Y']
          : ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

      const availableColors = p.colors && p.colors.length > 0
        ? p.colors
        : [{ name: 'Void Black', hex: '#0f0f14' }];

      const product = await prisma.product.upsert({
        where: { catalogNumber: p.catalogNumber || p.id },
        create: {
          id: p.id,
          catalogNumber: p.catalogNumber || p.id,
          name: p.name,
          slug: p.id.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          department: p.department,
          world: p.world,
          franchise: p.franchise,
          universe: p.universe || p.department,
          fit: p.fit,
          price: p.price,
          originalPrice: p.originalPrice,
          gsm: p.gsm || (isKids ? 180 : 240),
          fabric: p.fabric || '100% Combed Heavyweight Cotton',
          neck: p.neck || 'High-Ribbed Crewneck',
          sleeves: p.sleeves || 'Drop Shoulder Half Sleeves',
          print: p.print || 'High-Density Screen Print',
          description: p.description,
          storyQuote: p.storyQuote,
          drop: p.drop || 'CHAPTER 01 — ORIGINALS',
          rating: p.rating || 5.0,
          reviewsCount: p.reviewsCount || 100,
          isNewDrop: Boolean(p.isNewDrop ?? true),
          isBestseller: Boolean(p.isBestseller),
          isTrending: Boolean(p.isTrending),
          inStock: true,
          publishingStatus: 'PUBLISHED',
        },
        update: {},
      });

      // Variants & Inventory
      for (const color of availableColors) {
        for (const size of availableSizes) {
          const cleanSize = size.replace(/[^a-zA-Z0-9]/g, '');
          const sku = `SKU-${p.catalogNumber || p.id}-${cleanSize}-${color.name.slice(0, 3).toUpperCase()}`;
          const variantId = `var-${p.id}-${cleanSize}-${color.name.slice(0, 3).toLowerCase()}`;

          await prisma.productVariant.upsert({
            where: { sku },
            create: {
              id: variantId,
              productId: product.id,
              sku,
              size,
              colorName: color.name,
              colorHex: color.hex,
              price: p.price,
              originalPrice: p.originalPrice,
              stock: 25,
              reservedStock: 0,
              isActive: true,
            },
            update: {},
          });

          await prisma.inventory.upsert({
            where: { variantId },
            create: {
              variantId,
              quantityOnHand: 25,
              quantityReserved: 0,
              quantityAvailable: 25,
              safetyStock: 5,
              reorderPoint: 15,
            },
            update: {},
          });
        }
      }

      // Images
      if (p.images && p.images.length > 0) {
        for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
          const imgUrl = p.images[imgIdx];
          const imgId = `img-${p.id}-${imgIdx + 1}`;
          await prisma.productImage.upsert({
            where: { id: imgId },
            create: {
              id: imgId,
              productId: product.id,
              url: imgUrl,
              altText: `${p.name} - View ${imgIdx + 1}`,
              displayOrder: imgIdx,
              isPrimary: imgIdx === 0,
              angle: imgIdx === 0 ? 'FRONT' : imgIdx === 1 ? 'BACK' : 'DETAIL',
            },
            update: {},
          });
        }
      }

      productCount++;
    }

    console.log(`[SEED] Successfully seeded ${productCount} products into MySQL.`);
    return {
      success: true,
      message: `Database seeding completed successfully (${productCount} products seeded).`,
      count: productCount,
    };
  } catch (err: any) {
    console.error('[SEED] Error running MySQL seed:', err);
    return {
      success: false,
      message: err.message || 'Error running database seed.',
    };
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runDatabaseSeed().then((res) => {
    console.log('[SEED] Script result:', res);
    process.exit(res.success ? 0 : 1);
  });
}

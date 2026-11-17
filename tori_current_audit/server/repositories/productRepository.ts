import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../db/prisma';
import { PRODUCTS } from '../../src/data/products';
import { MEN_WORLDS, KIDS_WORLDS } from '../../src/data/constants';
import { resolveSecureStorePath } from '../utils/storageHelper';

const PERSIST_FILE = resolveSecureStorePath('custom-products-store.json', 'public/generated-assets/custom-products-store.json');
const TOMBSTONES_FILE = resolveSecureStorePath('deleted-product-ids.json', 'public/generated-assets/deleted-product-ids.json');

export interface ProductVariantRecord {
  id: string;
  productId: string;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  price: number;
  originalPrice: number;
  stock: number;
  reservedStock: number;
  weightGrams?: number;
  barcode?: string;
  isActive: boolean;
}

export interface ProductImageRecord {
  id: string;
  productId: string;
  variantId?: string;
  url: string;
  altText?: string;
  displayOrder: number;
  isPrimary: boolean;
  angle?: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  department: 'MEN' | 'KIDS' | 'UNISEX';
  description?: string;
  image?: string;
  bannerImage?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CollectionRecord {
  id: string;
  name: string;
  slug: string;
  subtitle?: string;
  description?: string;
  bannerImage?: string;
  heroImage?: string;
  isFeatured: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface ProductRecord {
  id: string;
  catalogNumber: string;
  name: string;
  slug: string;
  sku: string;
  department: 'MEN' | 'KIDS' | 'UNISEX';
  world: string;
  franchise: string;
  universe: string;
  character?: string;
  fit: string;
  price: number;
  originalPrice: number;
  costPrice?: number;
  gsm: number;
  fabric: string;
  neck: string;
  sleeves: string;
  print: string;
  description: string;
  storyQuote?: string;
  drop: string;
  rating: number;
  reviewsCount: number;
  badge?: string;
  images: string[];
  imageRecords?: ProductImageRecord[];
  features: string[];
  colors: { name: string; hex: string }[];
  sizes: string[];
  isNewDrop: boolean;
  isTrending: boolean;
  isBestseller: boolean;
  inStock: boolean;
  stock: number;
  licenseType: string;
  status: 'PUBLISHED' | 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
  categoryId?: string;
  subcategoryId?: string;
  collectionSlugs?: string[];
  variants?: ProductVariantRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export class ProductRepository {
  private fallbackProducts = new Map<string, ProductRecord>();
  private fallbackCategories = new Map<string, CategoryRecord>();
  private fallbackCollections = new Map<string, CollectionRecord>();
  private deletedProductIds = new Set<string>();

  constructor() {
    this.loadTombstones();
    this.initializeSeedData();
  }

  private loadTombstones() {
    try {
      if (fs.existsSync(TOMBSTONES_FILE)) {
        const raw = fs.readFileSync(TOMBSTONES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => this.deletedProductIds.add(id));
          console.log(`[REPO] Loaded ${this.deletedProductIds.size} tombstones from ${TOMBSTONES_FILE}`);
        }
      }
    } catch (err) {
      console.warn('[REPO] Failed to load tombstones from disk:', err);
    }
  }

  private persistTombstones() {
    try {
      const dir = path.dirname(TOMBSTONES_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmp = `${TOMBSTONES_FILE}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(Array.from(this.deletedProductIds), null, 2), 'utf-8');
      fs.renameSync(tmp, TOMBSTONES_FILE);
    } catch (err) {
      console.warn('[REPO] Failed to persist tombstones to disk:', err);
    }
  }

  private initializeSeedData() {
    // 1. Seed Categories (Worlds and standard apparel types)
    MEN_WORLDS.forEach((w, idx) => {
      const cat: CategoryRecord = {
        id: `cat-men-${idx + 1}`,
        name: w.name,
        slug: w.id.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        department: 'MEN',
        description: w.tagline,
        image: w.heroImage,
        bannerImage: w.heroImage,
        displayOrder: idx + 1,
        isActive: true,
      };
      this.fallbackCategories.set(cat.id, cat);
    });

    KIDS_WORLDS.forEach((w, idx) => {
      const cat: CategoryRecord = {
        id: `cat-kids-${idx + 1}`,
        name: w.name,
        slug: w.id.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        department: 'KIDS',
        description: w.tagline,
        image: w.heroImage,
        bannerImage: w.heroImage,
        displayOrder: 10 + idx + 1,
        isActive: true,
      };
      this.fallbackCategories.set(cat.id, cat);
    });

    // 2. Seed Collections
    const collections: CollectionRecord[] = [
      {
        id: 'col-new-drop',
        name: 'New Drop & Chapter 01',
        slug: 'new-drop',
        subtitle: 'Latest Original Streetwear Capsules',
        description: 'Fresh graphic drop featuring 240+ GSM heavyweight combed cotton.',
        isFeatured: true,
        isActive: true,
        displayOrder: 1,
      },
      {
        id: 'col-bestsellers',
        name: 'Top Selling & Cult Favorites',
        slug: 'top-selling',
        subtitle: 'Community Validated Grails',
        description: 'The highest-rated anime silhouettes in the TORIWEAR catalog.',
        isFeatured: true,
        isActive: true,
        displayOrder: 2,
      },
      {
        id: 'col-trending',
        name: 'Trending Streetwear',
        slug: 'trending',
        subtitle: 'Rising silhouettes across Tokyo & Mumbai streets',
        description: 'High velocity community picks.',
        isFeatured: true,
        isActive: true,
        displayOrder: 3,
      },
      {
        id: 'col-cyberpunk',
        name: 'Neo Tokyo & Cyberprotocol',
        slug: 'cyberpunk',
        subtitle: 'Rain-slicked neon graphics',
        description: 'Dedicated cyber aesthetic drops.',
        isFeatured: false,
        isActive: true,
        displayOrder: 4,
      },
    ];

    collections.forEach((c) => this.fallbackCollections.set(c.id, c));

    // 3. Authoritative disk store check:
    // If PERSIST_FILE exists, load strictly from disk store.
    // NEVER re-seed or overwrite user changes on restart!
    let loadedFromDisk = false;
    try {
      if (fs.existsSync(PERSIST_FILE)) {
        const raw = fs.readFileSync(PERSIST_FILE, 'utf-8');
        const customList: ProductRecord[] = JSON.parse(raw);
        if (Array.isArray(customList)) {
          customList.forEach((cp) => {
            if (!this.deletedProductIds.has(cp.id) && !this.deletedProductIds.has(cp.catalogNumber)) {
              this.fallbackProducts.set(cp.id, {
                ...cp,
                createdAt: new Date(cp.createdAt),
                updatedAt: new Date(cp.updatedAt),
              });
            }
          });
          loadedFromDisk = true;
          console.log(`[REPO] Loaded ${this.fallbackProducts.size} authoritative products from disk store (${PERSIST_FILE}).`);
        }
      }
    } catch (err) {
      console.warn('[REPO] Failed to load custom products from disk store:', err);
    }

    // 4. Initial Seed from static PRODUCTS ONLY if disk store was non-existent (first fresh boot)
    if (!loadedFromDisk) {
      console.log('[REPO] Initializing first-time product catalog from seed definitions...');
      PRODUCTS.forEach((p) => {
        if (this.deletedProductIds.has(p.id) || this.deletedProductIds.has(p.catalogNumber)) {
          return;
        }

        const isKids = p.department === 'KIDS';
        const availableSizes = p.sizes && p.sizes.length > 0 
          ? p.sizes 
          : isKids 
            ? ['2–3Y', '4–5Y', '6–7Y', '8–9Y', '10–11Y', '12–13Y']
            : ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

        const availableColors = p.colors && p.colors.length > 0
          ? p.colors
          : [{ name: 'Void Black', hex: '#0f0f14' }];

        const variants: ProductVariantRecord[] = [];
        let totalStock = 0;

        availableColors.forEach((color) => {
          availableSizes.forEach((size) => {
            const variantStock = Math.floor(Math.random() * 20) + 12; // 12 to 31 in stock
            totalStock += variantStock;
            const cleanSize = size.replace(/[^a-zA-Z0-9]/g, '');
            const cleanColor = color.name.toLowerCase().replace(/\s+/g, '-');
            variants.push({
              id: `var-${p.id}-${cleanColor}-${cleanSize}`,
              productId: p.id,
              sku: `SKU-${p.catalogNumber || p.id}-${cleanSize}-${color.name.slice(0, 3).toUpperCase()}`,
              size,
              colorName: color.name,
              colorHex: color.hex,
              price: p.price,
              originalPrice: p.originalPrice,
              stock: variantStock,
              reservedStock: 0,
              isActive: true,
            });
          });
        });

        const imageRecords: ProductImageRecord[] = (p.images || []).map((imgUrl, imgIdx) => ({
          id: `img-${p.id}-${imgIdx + 1}`,
          productId: p.id,
          url: imgUrl,
          altText: `${p.name} - Angle ${imgIdx + 1}`,
          displayOrder: imgIdx,
          isPrimary: imgIdx === 0,
          angle: imgIdx === 0 ? 'FRONT' : imgIdx === 1 ? 'BACK' : 'DETAIL',
        }));

        const collectionSlugs: string[] = [];
        if (p.isNewDrop) collectionSlugs.push('new-drop');
        if (p.isBestseller) collectionSlugs.push('top-selling');
        if (p.isTrending) collectionSlugs.push('trending');

        const productRecord: ProductRecord = {
          id: p.id,
          catalogNumber: p.catalogNumber || '01',
          name: p.name,
          slug: p.id.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          sku: `SKU-${p.catalogNumber || p.id}`,
          department: p.department,
          world: p.world,
          franchise: p.franchise,
          universe: p.universe || p.department,
          character: p.character,
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
          rating: p.rating || 4.9,
          reviewsCount: p.reviewsCount || 120,
          images: p.images || [],
          imageRecords,
          features: [
            `${p.gsm || 240} GSM Combed Cotton`,
            'Pre-Shrunk Bio-Washed Fabric',
            'Reinforced 1.25" Ribbed Collar',
            'Original Proprietary Manga Artwork',
          ],
          colors: availableColors,
          sizes: availableSizes,
          isNewDrop: Boolean(p.isNewDrop ?? true),
          isTrending: Boolean(p.isTrending),
          isBestseller: Boolean(p.isBestseller),
          inStock: totalStock > 0,
          stock: totalStock,
          licenseType: p.licenseType || 'Original IP',
          status: (p.publishingStatus as any) === 'ARCHIVED' ? 'ARCHIVED' : 'PUBLISHED',
          collectionSlugs,
          variants,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.fallbackProducts.set(productRecord.id, productRecord);
      });

      this.persistCustomProductsToFile();
    }

    console.log(`[REPO] Initialized ProductRepository with ${this.fallbackProducts.size} products, ${this.fallbackCategories.size} categories, and ${this.fallbackCollections.size} collections.`);
  }

  private persistCustomProductsToFile() {
    try {
      const allProducts = Array.from(this.fallbackProducts.values());
      const dir = path.dirname(PERSIST_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmp = `${PERSIST_FILE}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(allProducts, null, 2), 'utf-8');
      fs.renameSync(tmp, PERSIST_FILE);
      console.log(`[REPO] Successfully persisted ${allProducts.length} products to ${PERSIST_FILE}`);
    } catch (err) {
      console.warn('[REPO] Failed to persist products to disk:', err);
    }
  }

  private normalizePrismaProduct(found: any, fallback?: ProductRecord): ProductRecord {
    const rawImages = Array.isArray(found?.images) ? found.images : [];
    const normalizedImages: string[] =
      rawImages.length > 0
        ? [...rawImages]
            .sort((a: any, b: any) => (a?.displayOrder ?? 0) - (b?.displayOrder ?? 0))
            .map((img: any) => (typeof img === 'string' ? img : img?.url))
            .filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0)
        : fallback?.images || [];

    return {
      ...(fallback || {}),
      ...found,
      status: (found?.status || found?.publishingStatus || fallback?.status || 'PUBLISHED') as ProductRecord['status'],
      images: normalizedImages,
    } as unknown as ProductRecord;
  }

  async findById(id: string): Promise<ProductRecord | null> {
    if (this.deletedProductIds.has(id)) return null;

    const prisma = getPrismaClient();
    if (prisma?.product) {
      try {
        const found = await prisma.product.findUnique({
          where: { id },
          include: { variants: true, images: true, category: true },
        });
        if (found) return this.normalizePrismaProduct(found, this.fallbackProducts.get(id));
      } catch (err) {
        console.error('[REPO] Error querying product by ID from Prisma:', err);
      }
    }
    return this.fallbackProducts.get(id) || null;
  }

  async findBySlug(slug: string): Promise<ProductRecord | null> {
    if (this.deletedProductIds.has(slug)) return null;

    const prisma = getPrismaClient();
    if (prisma?.product) {
      try {
        const found = await prisma.product.findUnique({
          where: { slug },
          include: { variants: true, images: true, category: true },
        });
        if (found) return this.normalizePrismaProduct(found, this.fallbackProducts.get(found.id));
      } catch (err) {
        console.error('[REPO] Error querying product by slug from Prisma:', err);
      }
    }
    for (const p of this.fallbackProducts.values()) {
      if ((p.slug === slug || p.id === slug) && !this.deletedProductIds.has(p.id) && !this.deletedProductIds.has(p.catalogNumber)) {
        return p;
      }
    }
    return null;
  }

  async findByCatalogNumber(num: string): Promise<ProductRecord | null> {
    if (this.deletedProductIds.has(num)) return null;

    for (const p of this.fallbackProducts.values()) {
      if (p.catalogNumber === num && !this.deletedProductIds.has(p.id) && !this.deletedProductIds.has(p.catalogNumber)) {
        return p;
      }
    }
    return null;
  }

  async getAll(filter?: {
    department?: string;
    world?: string;
    status?: string;
    categoryId?: string;
    collectionSlug?: string;
    isBestseller?: boolean;
    isNewDrop?: boolean;
    isTrending?: boolean;
    search?: string;
  }): Promise<ProductRecord[]> {
    let list = Array.from(this.fallbackProducts.values());

    if (filter?.department && filter.department !== 'ALL') {
      list = list.filter((p) => p.department === filter.department);
    }
    if (filter?.world && filter.world !== 'ALL') {
      list = list.filter((p) => p.world.toUpperCase() === filter.world?.toUpperCase());
    }
    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.categoryId) {
      list = list.filter((p) => p.categoryId === filter.categoryId);
    }
    if (filter?.collectionSlug) {
      list = list.filter((p) => p.collectionSlugs?.includes(filter.collectionSlug!));
    }
    if (filter?.isBestseller !== undefined) {
      list = list.filter((p) => p.isBestseller === filter.isBestseller);
    }
    if (filter?.isNewDrop !== undefined) {
      list = list.filter((p) => p.isNewDrop === filter.isNewDrop);
    }
    if (filter?.isTrending !== undefined) {
      list = list.filter((p) => p.isTrending === filter.isTrending);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.catalogNumber.toLowerCase().includes(q) ||
          `#${p.catalogNumber.toLowerCase()}`.includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.universe && p.universe.toLowerCase().includes(q)) ||
          (p.franchise && p.franchise.toLowerCase().includes(q)) ||
          p.world.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.character && p.character.toLowerCase().includes(q))
      );
    }

    return list;
  }

  async updateVariantStock(variantIdOrSku: string, newStock: number): Promise<ProductRecord | null> {
    for (const p of this.fallbackProducts.values()) {
      const v = p.variants?.find((x) => x.id === variantIdOrSku || x.sku === variantIdOrSku);
      if (v) {
        v.stock = Math.max(0, newStock);
        const totalStock = (p.variants || []).reduce((sum, item) => sum + (item.stock || 0), 0);
        p.stock = totalStock;
        p.inStock = totalStock > 0;
        await this.save(p);
        return p;
      }
    }
    return null;
  }

  async save(product: ProductRecord): Promise<ProductRecord> {
    product.updatedAt = new Date();
    
    // If it was previously marked as deleted/tombstone, untombstone it
    if (this.deletedProductIds.has(product.id) || this.deletedProductIds.has(product.catalogNumber)) {
      this.deletedProductIds.delete(product.id);
      this.deletedProductIds.delete(product.catalogNumber);
      this.persistTombstones();
    }

    this.fallbackProducts.set(product.id, product);

    const prisma = getPrismaClient();
    if (prisma?.product) {
      try {
        await prisma.product.upsert({
          where: { id: product.id },
          create: {
            id: product.id,
            catalogNumber: product.catalogNumber,
            name: product.name,
            slug: product.slug,
            department: product.department as any,
            world: product.world,
            franchise: product.franchise,
            universe: product.universe,
            fit: product.fit,
            price: Number(product.price),
            originalPrice: Number(product.originalPrice),
            costPrice: product.costPrice !== undefined ? Number(product.costPrice) : undefined,
            gsm: Number(product.gsm || 240),
            fabric: product.fabric,
            neck: product.neck,
            sleeves: product.sleeves,
            print: product.print,
            description: product.description,
            storyQuote: product.storyQuote,
            drop: product.drop,
            isBestseller: Boolean(product.isBestseller),
            isNewDrop: Boolean(product.isNewDrop),
            isTrending: Boolean(product.isTrending),
            inStock: Boolean(product.inStock),
            rating: Number(product.rating || 5.0),
            reviewsCount: Number(product.reviewsCount || 0),
            licenseType: product.licenseType,
            publishingStatus: product.status as any,
          },
          update: {
            catalogNumber: product.catalogNumber,
            name: product.name,
            slug: product.slug,
            department: product.department as any,
            world: product.world,
            franchise: product.franchise,
            universe: product.universe,
            fit: product.fit,
            price: Number(product.price),
            originalPrice: Number(product.originalPrice),
            costPrice: product.costPrice !== undefined ? Number(product.costPrice) : undefined,
            gsm: Number(product.gsm || 240),
            fabric: product.fabric,
            neck: product.neck,
            sleeves: product.sleeves,
            print: product.print,
            description: product.description,
            storyQuote: product.storyQuote,
            drop: product.drop,
            isBestseller: Boolean(product.isBestseller),
            isNewDrop: Boolean(product.isNewDrop),
            isTrending: Boolean(product.isTrending),
            inStock: Boolean(product.inStock),
            rating: Number(product.rating || 5.0),
            reviewsCount: Number(product.reviewsCount || 0),
            licenseType: product.licenseType,
            publishingStatus: product.status as any,
            updatedAt: new Date(),
          },
        });

        // Sync variants to Prisma if present
        if (Array.isArray(product.variants) && product.variants.length > 0) {
          const defaultWeight = product.department === 'KIDS' ? 200 : 340;
          for (const v of product.variants) {
            const variantSku = v.sku || `SKU-${v.id}`;
            const variantWeight = v.weightGrams !== undefined ? Number(v.weightGrams) : defaultWeight;
            await prisma.productVariant.upsert({
              where: { sku: variantSku },
              create: {
                id: v.id,
                productId: product.id,
                sku: variantSku,
                size: v.size,
                colorName: v.colorName || 'Void Black',
                colorHex: v.colorHex || '#0a0a0c',
                price: Number(v.price),
                originalPrice: Number(v.originalPrice || product.originalPrice),
                stock: Number(v.stock || 0),
                reservedStock: Number(v.reservedStock || 0),
                weightGrams: variantWeight,
                barcode: v.barcode ?? null,
                isActive: v.isActive !== false,
              },
              update: {
                sku: v.sku || `SKU-${v.id}`,
                size: v.size,
                colorName: v.colorName || 'Void Black',
                colorHex: v.colorHex || '#0a0a0c',
                price: Number(v.price),
                originalPrice: Number(v.originalPrice || product.originalPrice),
                stock: Number(v.stock || 0),
                reservedStock: Number(v.reservedStock || 0),
                weightGrams: variantWeight,
                barcode: v.barcode ?? null,
                isActive: v.isActive !== false,
              },
            });
          }
        }

        // Sync unlimited gallery images to Prisma ProductImage table
        if (prisma.productImage && Array.isArray(product.images)) {
          const validImgs = product.images.filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
          await prisma.productImage.deleteMany({ where: { productId: product.id } });
          if (validImgs.length > 0) {
            await prisma.productImage.createMany({
              data: validImgs.map((url, idx) => ({
                productId: product.id,
                url,
                displayOrder: idx,
                isPrimary: idx === 0,
                angle: idx === 0 ? 'FRONT' : 'DETAIL',
              })),
            });
          }
        }
      } catch (err) {
        console.error('[REPO] Error persisting product to MySQL Prisma:', err);
      }
    }

    this.persistCustomProductsToFile();

    // Immediate retrieval verification
    const verified = this.fallbackProducts.get(product.id);
    if (!verified) {
      throw new Error(`[REPO] Critical: Failed to verify product persistence for ${product.id}`);
    }

    console.log(`[REPO] Saved product ${product.id} ("${product.name}") with status=${product.status}. Persisted count=${this.fallbackProducts.size}`);
    return product;
  }

  async archive(id: string): Promise<ProductRecord | null> {
    const product = await this.findById(id);
    if (!product) return null;
    product.status = 'ARCHIVED';
    return this.save(product);
  }

  async restore(id: string): Promise<ProductRecord | null> {
    const product = await this.findById(id);
    if (!product) return null;
    product.status = 'PUBLISHED';
    return this.save(product);
  }

  async delete(id: string): Promise<boolean> {
    // 1. Locate the product to get both ID and catalogNumber for permanent tombstones
    let target = this.fallbackProducts.get(id);
    if (!target) {
      for (const p of this.fallbackProducts.values()) {
        if (p.catalogNumber === id || p.slug === id) {
          target = p;
          break;
        }
      }
    }

    const productId = target ? target.id : id;
    const catalogNum = target ? target.catalogNumber : id;

    // 2. Add to persistent tombstones to prevent any resurrection
    this.deletedProductIds.add(productId);
    if (catalogNum) this.deletedProductIds.add(catalogNum);
    this.persistTombstones();

    // 3. Remove from memory store
    const existed = this.fallbackProducts.delete(productId) || (target ? this.fallbackProducts.delete(target.id) : false);

    // 4. Delete from Prisma if active
    const prisma = getPrismaClient();
    if (prisma?.product) {
      try {
        await prisma.productVariant.deleteMany({ where: { productId } });
        await prisma.productImage?.deleteMany?.({ where: { productId } });
        await prisma.product.deleteMany({
          where: {
            OR: [{ id: productId }, { catalogNumber: catalogNum }],
          },
        });
      } catch (err) {
        console.warn(`[REPO] Prisma delete error for ${productId}:`, err);
      }
    }

    // 5. Persist updated products list to disk
    this.persistCustomProductsToFile();

    // 6. Verification: guarantee it cannot be retrieved
    const stillInStore = this.fallbackProducts.has(productId);
    console.log(`[REPO] DELETE product ${productId} (catalog=${catalogNum}). Existed: ${existed}, Absent: ${!stillInStore}, Remaining: ${this.fallbackProducts.size}`);

    return true;
  }

  async clearAll(): Promise<boolean> {
    for (const [id, prod] of this.fallbackProducts.entries()) {
      this.deletedProductIds.add(id);
      if (prod.catalogNumber) this.deletedProductIds.add(prod.catalogNumber);
    }
    this.fallbackProducts.clear();

    const prisma = getPrismaClient();
    if (prisma?.product) {
      try {
        await prisma.productVariant?.deleteMany?.({});
        await prisma.productImage?.deleteMany?.({});
        await prisma.product.deleteMany({});
      } catch (err) {
        console.warn('[REPO] Prisma clearAll error:', err);
      }
    }

    this.persistTombstones();
    this.persistCustomProductsToFile();
    console.log('[REPO] All products cleared from repository and disk store.');
    return true;
  }

  /**
   * Remove deleted variants/SKUs from products; if a product has no remaining variants,
   * delete the parent product cleanly and record its tombstone.
   */
  async removeVariants(targetIds: string[]): Promise<{ removedProductIds: string[]; modifiedProductIds: string[] }> {
    const removedProductIds: string[] = [];
    const modifiedProductIds: string[] = [];
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return { removedProductIds, modifiedProductIds };
    }

    const targetSet = new Set(targetIds.filter((x) => Boolean(x) && x !== 'unlinked'));
    if (targetSet.size === 0) {
      return { removedProductIds, modifiedProductIds };
    }

    let changed = false;
    const prisma = getPrismaClient();

    for (const [prodId, prod] of Array.from(this.fallbackProducts.entries())) {
      if (targetSet.has(prodId) || (prod.catalogNumber && targetSet.has(prod.catalogNumber))) {
        this.deletedProductIds.add(prod.id);
        if (prod.catalogNumber) this.deletedProductIds.add(prod.catalogNumber);
        this.fallbackProducts.delete(prodId);
        removedProductIds.push(prodId);
        changed = true;

        if (prisma?.product) {
          try {
            await prisma.productVariant?.deleteMany?.({ where: { productId: prod.id } });
            await prisma.productImage?.deleteMany?.({ where: { productId: prod.id } });
            await prisma.product.deleteMany({ where: { id: prod.id } });
          } catch {}
        }
        continue;
      }

      if (!Array.isArray(prod.variants) || prod.variants.length === 0) continue;

      const matchedVariants = prod.variants.filter(
        (v) =>
          targetSet.has(v.id) ||
          targetSet.has(`inv-${v.id}`) ||
          (v.sku && targetSet.has(v.sku))
      );

      if (matchedVariants.length === 0) continue;

      const remainingVariants = prod.variants.filter((v) => !matchedVariants.includes(v));
      if (remainingVariants.length === 0) {
        this.deletedProductIds.add(prod.id);
        if (prod.catalogNumber) this.deletedProductIds.add(prod.catalogNumber);
        this.fallbackProducts.delete(prodId);
        removedProductIds.push(prodId);

        if (prisma?.product) {
          try {
            await prisma.productVariant?.deleteMany?.({ where: { productId: prod.id } });
            await prisma.productImage?.deleteMany?.({ where: { productId: prod.id } });
            await prisma.product.deleteMany({ where: { id: prod.id } });
          } catch {}
        }
      } else {
        const totalStock = remainingVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
        prod.variants = remainingVariants;
        prod.stock = totalStock;
        prod.inStock = totalStock > 0;
        prod.updatedAt = new Date();
        this.fallbackProducts.set(prodId, prod);
        modifiedProductIds.push(prodId);

        if (prisma?.productVariant) {
          try {
            await prisma.productVariant.deleteMany({
              where: {
                id: { in: matchedVariants.map((v) => v.id) },
              },
            });
            await prisma.product.updateMany({
              where: { id: prod.id },
              data: { stock: totalStock, inStock: totalStock > 0, updatedAt: new Date() },
            });
          } catch {}
        }
      }
      changed = true;
    }

    if (changed) {
      if (removedProductIds.length > 0) {
        this.persistTombstones();
      }
      this.persistCustomProductsToFile();
    }

    return { removedProductIds, modifiedProductIds };
  }

  // Categories
  async getCategories(department?: string): Promise<CategoryRecord[]> {
    let list = Array.from(this.fallbackCategories.values());
    if (department && department !== 'ALL') {
      list = list.filter((c) => c.department === department || c.department === 'UNISEX');
    }
    return list.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getCategoryById(id: string): Promise<CategoryRecord | null> {
    return this.fallbackCategories.get(id) || null;
  }

  async getCategoryBySlug(slug: string): Promise<CategoryRecord | null> {
    for (const c of this.fallbackCategories.values()) {
      if (c.slug === slug) return c;
    }
    return null;
  }

  async saveCategory(cat: CategoryRecord): Promise<CategoryRecord> {
    this.fallbackCategories.set(cat.id, cat);
    return cat;
  }

  async archiveCategory(id: string): Promise<boolean> {
    const cat = this.fallbackCategories.get(id);
    if (!cat) return false;
    cat.isActive = false;
    this.fallbackCategories.set(id, cat);
    return true;
  }

  // Collections
  async getCollections(): Promise<CollectionRecord[]> {
    return Array.from(this.fallbackCollections.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getCollectionBySlug(slug: string): Promise<CollectionRecord | null> {
    for (const c of this.fallbackCollections.values()) {
      if (c.slug === slug || c.id === slug) return c;
    }
    return null;
  }

  // Variants
  async getVariants(productId: string): Promise<ProductVariantRecord[]> {
    const p = await this.findById(productId);
    return p?.variants || [];
  }

  async getVariantById(variantIdOrSku: string): Promise<ProductVariantRecord | null> {
    for (const p of this.fallbackProducts.values()) {
      const found = p.variants?.find((v) => v.id === variantIdOrSku || v.sku === variantIdOrSku);
      if (found) return found;
    }
    const prisma = getPrismaClient();
    if (prisma?.productVariant) {
      try {
        const found = await prisma.productVariant.findFirst({
          where: { OR: [{ id: variantIdOrSku }, { sku: variantIdOrSku }] },
        });
        if (found) return found as unknown as ProductVariantRecord;
      } catch {}
    }
    return null;
  }

  async saveVariant(productId: string, variant: ProductVariantRecord): Promise<ProductVariantRecord | null> {
    const p = await this.findById(productId);
    if (!p) return null;

    if (!p.variants) p.variants = [];
    const idx = p.variants.findIndex((v) => v.id === variant.id);
    if (idx >= 0) {
      p.variants[idx] = variant;
    } else {
      p.variants.push(variant);
    }
    await this.save(p);
    return variant;
  }

  async archiveVariant(variantId: string): Promise<boolean> {
    for (const p of this.fallbackProducts.values()) {
      const v = p.variants?.find((x) => x.id === variantId);
      if (v) {
        v.isActive = false;
        await this.save(p);
        return true;
      }
    }
    return false;
  }

  // Images
  async getImages(productId: string): Promise<ProductImageRecord[]> {
    const p = await this.findById(productId);
    return p?.imageRecords || [];
  }

  async addImage(productId: string, image: ProductImageRecord): Promise<ProductImageRecord | null> {
    const p = await this.findById(productId);
    if (!p) return null;
    if (!p.imageRecords) p.imageRecords = [];
    p.imageRecords.push(image);
    if (!p.images.includes(image.url)) {
      p.images.push(image.url);
    }
    await this.save(p);
    return image;
  }
}

export const productRepository = new ProductRepository();

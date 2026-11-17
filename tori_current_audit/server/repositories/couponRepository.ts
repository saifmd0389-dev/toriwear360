import fs from 'fs';
import path from 'path';
import { getPrismaClient } from '../db/prisma';
import { resolveSecureStorePath } from '../utils/storageHelper';

export interface CouponRecord {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
  startDate: Date;
  expiryDate: Date;
  usageLimit?: number;
  usageCount: number;
  perUserLimit: number;
  eligibleCategories: string[];
  eligibleProductIds: string[];
  excludeShipping: boolean;
  excludeTax: boolean;
  isActive: boolean;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CouponValidationItem {
  productId: string;
  category?: string;
  world?: string;
  department?: string;
  lineTotal: number;
}

export interface CouponValidationContext {
  code: string;
  subtotal?: number;
  items?: CouponValidationItem[];
  customerId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}

export interface CouponValidationResult {
  valid: boolean;
  discount: number;
  eligibleSubtotal: number;
  reason?: string;
  coupon?: CouponRecord;
}

interface UsageEntry {
  id: string;
  couponId: string;
  orderId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  discountAmount: number;
  usedAt: string;
}

const STORE_PATH = resolveSecureStorePath('coupons-store.json', 'public/generated-assets/coupons-store.json');
const USAGE_STORE_PATH = resolveSecureStorePath('coupon-usages-store.json');

function parseListField(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {}
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function serializeListField(list?: string[]): string | null {
  if (!list || list.length === 0) return null;
  return JSON.stringify(list);
}

function normalizePhoneForLookup(phone?: string | null): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/[^\d+]/g, '').trim();
  return digits || null;
}

function normalizeEmailForLookup(email?: string | null): string | null {
  if (!email || typeof email !== 'string') return null;
  const clean = email.trim().toLowerCase();
  return clean || null;
}

function mapPrismaCoupon(row: any): CouponRecord {
  return {
    id: row.id,
    code: String(row.code || '').trim().toUpperCase(),
    discountType: row.discountType === 'FIXED' ? 'FLAT' : 'PERCENTAGE',
    value: Number(row.value),
    maxDiscount: row.maxDiscount != null ? Number(row.maxDiscount) : undefined,
    minOrderValue: Number(row.minOrderValue || 0),
    startDate: new Date(row.startsAt || Date.now()),
    expiryDate: row.expiresAt ? new Date(row.expiresAt) : new Date('2027-12-31T23:59:59.000Z'),
    usageLimit: row.usageLimit != null ? Number(row.usageLimit) : undefined,
    usageCount: Number(row.usageCount || 0),
    perUserLimit: Number(row.perUserLimit || 1),
    eligibleCategories: parseListField(row.eligibleCategories),
    eligibleProductIds: parseListField(row.eligibleProductIds),
    excludeShipping: row.excludeShipping !== false,
    excludeTax: row.excludeTax !== false,
    isActive: Boolean(row.isActive),
    description: row.description || undefined,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
  };
}

export class CouponRepository {
  private cache = new Map<string, CouponRecord>();
  private usageCache: UsageEntry[] = [];
  private initialized = false;
  private lastMtime = 0;

  constructor() {
    this.ensureLoaded();
  }

  public reloadFromDisk() {
    this.ensureLoaded(true);
  }

  private ensureLoaded(force = false) {
    try {
      if (fs.existsSync(USAGE_STORE_PATH)) {
        const rawUsage = fs.readFileSync(USAGE_STORE_PATH, 'utf-8');
        const parsedUsage = JSON.parse(rawUsage);
        if (Array.isArray(parsedUsage)) {
          this.usageCache = parsedUsage;
        }
      }
    } catch {}

    try {
      if (fs.existsSync(STORE_PATH)) {
        const stat = fs.statSync(STORE_PATH);
        if (!force && this.initialized && stat.mtimeMs <= this.lastMtime) {
          return;
        }
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cache.clear();
          for (const item of parsed) {
            const record: CouponRecord = {
              id: item.id,
              code: String(item.code || '').trim().toUpperCase(),
              discountType: item.discountType === 'FIXED' || item.discountType === 'FLAT' ? 'FLAT' : 'PERCENTAGE',
              value: Number(item.value || 0),
              maxDiscount: item.maxDiscount != null ? Number(item.maxDiscount) : undefined,
              minOrderValue: Number(item.minOrderValue || 0),
              startDate: new Date(item.startDate || '2026-01-01T00:00:00.000Z'),
              expiryDate: new Date(item.expiryDate || '2026-12-31T23:59:59.000Z'),
              usageLimit: item.usageLimit != null ? Number(item.usageLimit) : undefined,
              usageCount: Number(item.usageCount || 0),
              perUserLimit: Number(item.perUserLimit || 1),
              eligibleCategories: parseListField(item.eligibleCategories),
              eligibleProductIds: parseListField(item.eligibleProductIds),
              excludeShipping: item.excludeShipping !== false,
              excludeTax: item.excludeTax !== false,
              isActive: Boolean(item.isActive),
              description: item.description,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            };
            this.cache.set(record.id, record);
          }
          this.lastMtime = stat.mtimeMs;
          this.initialized = true;
          return;
        }
      }
    } catch (err) {
      console.warn('[CouponRepo] Could not load existing coupons store file:', err);
    }

    if (!this.initialized) {
      this.seedDefaults();
      this.saveToDisk();
      this.initialized = true;
    }
  }

  private seedDefaults() {
    const defaults: CouponRecord[] = [
      {
        id: 'coup-1',
        code: 'TORI100',
        discountType: 'PERCENTAGE',
        value: 100,
        maxDiscount: 2500,
        minOrderValue: 999,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        expiryDate: new Date('2026-12-31T23:59:59.000Z'),
        usageLimit: 100,
        usageCount: 0,
        perUserLimit: 1,
        eligibleCategories: [],
        eligibleProductIds: [],
        excludeShipping: true,
        excludeTax: true,
        // Safe default: stays PAUSED until admin configures limits/eligibility & activates it
        isActive: false,
        description:
          '100% Early Access launch benefit on eligible merchandise (up to ₹2,500 cap, min order ₹999, 1 per customer, excludes shipping & tax). Admin activation required.',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'coup-2',
        code: 'TWIN10',
        discountType: 'PERCENTAGE',
        value: 10,
        maxDiscount: 350,
        minOrderValue: 1499,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        expiryDate: new Date('2026-12-31T23:59:59.000Z'),
        usageLimit: 500,
        usageCount: 88,
        perUserLimit: 2,
        eligibleCategories: [],
        eligibleProductIds: [],
        excludeShipping: true,
        excludeTax: true,
        isActive: true,
        description: '10% off on Twinning combos (Men + Kid combo sets)',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'coup-3',
        code: 'DROP2026',
        discountType: 'PERCENTAGE',
        value: 15,
        maxDiscount: 500,
        minOrderValue: 1999,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        expiryDate: new Date('2026-12-31T23:59:59.000Z'),
        usageLimit: 300,
        usageCount: 41,
        perUserLimit: 1,
        eligibleCategories: [],
        eligibleProductIds: [],
        excludeShipping: true,
        excludeTax: true,
        isActive: true,
        description: '15% off season pass for all anime capsule drops',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const c of defaults) {
      this.cache.set(c.id, c);
    }
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.cache.values());
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[CouponRepo] Failed to save coupons to disk:', err);
    }
  }

  private saveUsageToDisk() {
    try {
      const dir = path.dirname(USAGE_STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(USAGE_STORE_PATH, JSON.stringify(this.usageCache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[CouponRepo] Failed to save coupon usage history:', err);
    }
  }

  async getAll(): Promise<CouponRecord[]> {
    const prisma = getPrismaClient();
    if (prisma?.coupon) {
      try {
        const dbCoupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
        if (Array.isArray(dbCoupons) && dbCoupons.length > 0) {
          return dbCoupons.map(mapPrismaCoupon);
        }
      } catch {}
    }

    this.ensureLoaded();
    return Array.from(this.cache.values()).sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async getById(id: string): Promise<CouponRecord | null> {
    const prisma = getPrismaClient();
    if (prisma?.coupon) {
      try {
        const row = await prisma.coupon.findUnique({ where: { id } });
        if (row) return mapPrismaCoupon(row);
      } catch {}
    }
    this.ensureLoaded();
    return this.cache.get(id) || null;
  }

  async findByCode(code: string): Promise<CouponRecord | null> {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return null;

    const prisma = getPrismaClient();
    if (prisma?.coupon) {
      try {
        const row = await prisma.coupon.findUnique({ where: { code: clean } });
        if (row) return mapPrismaCoupon(row);
      } catch {}
    }

    this.ensureLoaded();
    for (const record of this.cache.values()) {
      if (record.code.toUpperCase() === clean) {
        return record;
      }
    }
    return null;
  }

  async create(
    data: Partial<CouponRecord> & {
      code: string;
      discountType: 'PERCENTAGE' | 'FLAT';
      value: number;
      minOrderValue: number;
      startDate: Date;
      expiryDate: Date;
      isActive: boolean;
    },
    actorId?: string
  ): Promise<CouponRecord> {
    this.ensureLoaded();
    const cleanCode = data.code.trim().toUpperCase();

    const existing = await this.findByCode(cleanCode);
    if (existing) {
      throw new Error(`A coupon with code "${cleanCode}" already exists.`);
    }

    const newRecord: CouponRecord = {
      id: `coup-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      code: cleanCode,
      discountType: data.discountType === 'FLAT' ? 'FLAT' : 'PERCENTAGE',
      value: Number(data.value),
      maxDiscount: data.maxDiscount !== undefined ? Number(data.maxDiscount) : undefined,
      minOrderValue: Number(data.minOrderValue || 0),
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : new Date('2026-12-31T23:59:59.000Z'),
      usageLimit: data.usageLimit !== undefined ? Number(data.usageLimit) : undefined,
      usageCount: 0,
      perUserLimit: Number(data.perUserLimit || 1),
      eligibleCategories: parseListField(data.eligibleCategories),
      eligibleProductIds: parseListField(data.eligibleProductIds),
      excludeShipping: data.excludeShipping !== false,
      excludeTax: data.excludeTax !== false,
      isActive: data.isActive !== false,
      description: data.description || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const prisma = getPrismaClient();
    if (prisma?.coupon) {
      try {
        const createdDb = await prisma.coupon.create({
          data: {
            id: newRecord.id,
            code: newRecord.code,
            discountType: newRecord.discountType === 'FLAT' ? 'FIXED' : 'PERCENTAGE',
            value: newRecord.value,
            minOrderValue: newRecord.minOrderValue,
            maxDiscount: newRecord.maxDiscount ?? null,
            usageLimit: newRecord.usageLimit ?? null,
            usageCount: 0,
            perUserLimit: newRecord.perUserLimit,
            eligibleCategories: serializeListField(newRecord.eligibleCategories),
            eligibleProductIds: serializeListField(newRecord.eligibleProductIds),
            excludeShipping: newRecord.excludeShipping,
            excludeTax: newRecord.excludeTax,
            isActive: newRecord.isActive,
            startsAt: newRecord.startDate,
            expiresAt: newRecord.expiryDate,
            description: newRecord.description,
          },
        });
        const mapped = mapPrismaCoupon(createdDb);
        this.cache.set(mapped.id, mapped);
        this.saveToDisk();
        console.log(`[CouponRepo] ✅ Coupon created: ${mapped.code} (${mapped.id}) by ${actorId || 'STAFF'}`);
        return mapped;
      } catch (err) {
        console.warn('[CouponRepo] Prisma coupon create note:', (err as any)?.message || err);
      }
    }

    this.cache.set(newRecord.id, newRecord);
    this.saveToDisk();
    console.log(`[CouponRepo] ✅ Coupon created: ${newRecord.code} (${newRecord.id}) by ${actorId || 'STAFF'}`);
    return newRecord;
  }

  async update(id: string, updates: Partial<CouponRecord>, actorId?: string): Promise<CouponRecord | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    if (updates.code) {
      const clean = updates.code.trim().toUpperCase();
      if (clean !== existing.code) {
        const dup = await this.findByCode(clean);
        if (dup && dup.id !== id) {
          throw new Error(`A coupon with code "${clean}" already exists.`);
        }
      }
    }

    const merged: CouponRecord = {
      ...existing,
      ...updates,
      code: updates.code ? updates.code.trim().toUpperCase() : existing.code,
      discountType: updates.discountType
        ? (updates.discountType === 'FLAT' || (updates.discountType as any) === 'FIXED' ? 'FLAT' : 'PERCENTAGE')
        : existing.discountType,
      value: updates.value !== undefined ? Number(updates.value) : existing.value,
      minOrderValue: updates.minOrderValue !== undefined ? Number(updates.minOrderValue) : existing.minOrderValue,
      maxDiscount: updates.maxDiscount !== undefined ? (updates.maxDiscount ? Number(updates.maxDiscount) : undefined) : existing.maxDiscount,
      usageLimit: updates.usageLimit !== undefined ? (updates.usageLimit ? Number(updates.usageLimit) : undefined) : existing.usageLimit,
      perUserLimit: updates.perUserLimit !== undefined ? Math.max(1, Number(updates.perUserLimit)) : existing.perUserLimit,
      eligibleCategories:
        updates.eligibleCategories !== undefined
          ? parseListField(updates.eligibleCategories)
          : existing.eligibleCategories,
      eligibleProductIds:
        updates.eligibleProductIds !== undefined
          ? parseListField(updates.eligibleProductIds)
          : existing.eligibleProductIds,
      excludeShipping: updates.excludeShipping !== undefined ? Boolean(updates.excludeShipping) : existing.excludeShipping,
      excludeTax: updates.excludeTax !== undefined ? Boolean(updates.excludeTax) : existing.excludeTax,
      startDate: updates.startDate ? new Date(updates.startDate) : existing.startDate,
      expiryDate: updates.expiryDate ? new Date(updates.expiryDate) : existing.expiryDate,
      updatedAt: new Date(),
    };

    const prisma = getPrismaClient();
    if (prisma?.coupon) {
      try {
        const updatedDb = await prisma.coupon.update({
          where: { id },
          data: {
            code: merged.code,
            discountType: merged.discountType === 'FLAT' ? 'FIXED' : 'PERCENTAGE',
            value: merged.value,
            minOrderValue: merged.minOrderValue,
            maxDiscount: merged.maxDiscount ?? null,
            usageLimit: merged.usageLimit ?? null,
            perUserLimit: merged.perUserLimit,
            eligibleCategories: serializeListField(merged.eligibleCategories),
            eligibleProductIds: serializeListField(merged.eligibleProductIds),
            excludeShipping: merged.excludeShipping,
            excludeTax: merged.excludeTax,
            isActive: merged.isActive,
            startsAt: merged.startDate,
            expiresAt: merged.expiryDate,
            description: merged.description,
          },
        });
        const mapped = mapPrismaCoupon(updatedDb);
        this.cache.set(id, mapped);
        this.saveToDisk();
        console.log(`[CouponRepo] ✏️ Coupon updated: ${mapped.code} (${id}) by ${actorId || 'STAFF'}`);
        return mapped;
      } catch (err) {
        console.warn('[CouponRepo] Prisma coupon update note:', (err as any)?.message || err);
      }
    }

    this.cache.set(id, merged);
    this.saveToDisk();
    console.log(`[CouponRepo] ✏️ Coupon updated: ${merged.code} (${id}) by ${actorId || 'STAFF'}`);
    return merged;
  }

  async delete(id: string, actorId?: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    this.cache.delete(id);
    this.saveToDisk();

    const prisma = getPrismaClient();
    if (prisma?.coupon) {
      await prisma.coupon.delete({ where: { id } }).catch(() => {});
    }

    console.log(`[CouponRepo] 🗑️ Coupon deleted: ${existing.code} (${id}) by ${actorId || 'STAFF'}`);
    return true;
  }

  async toggleActive(id: string, actorId?: string): Promise<CouponRecord | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    return this.update(id, { isActive: !existing.isActive }, actorId);
  }

  async getCustomerUsageCount(params: {
    couponId: string;
    customerId?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
  }): Promise<number> {
    const cleanEmail = normalizeEmailForLookup(params.customerEmail);
    const cleanPhone = normalizePhoneForLookup(params.customerPhone);
    const cleanCustomerId = params.customerId ? String(params.customerId).trim() : null;

    if (!cleanCustomerId && !cleanEmail && !cleanPhone) {
      return 0;
    }

    const prisma = getPrismaClient();
    if (prisma?.couponUsage) {
      try {
        const orClauses: any[] = [];
        if (cleanCustomerId) orClauses.push({ customerId: cleanCustomerId });
        if (cleanEmail) orClauses.push({ customerEmail: cleanEmail });
        if (cleanPhone) orClauses.push({ customerPhone: cleanPhone });

        const count = await prisma.couponUsage.count({
          where: {
            couponId: params.couponId,
            OR: orClauses,
          },
        });
        return Number(count || 0);
      } catch {}
    }

    this.ensureLoaded();
    return this.usageCache.filter((u) => {
      if (u.couponId !== params.couponId) return false;
      if (cleanCustomerId && u.customerId === cleanCustomerId) return true;
      if (cleanEmail && u.customerEmail === cleanEmail) return true;
      if (cleanPhone && u.customerPhone === cleanPhone) return true;
      return false;
    }).length;
  }

  async recordRedemption(params: {
    code: string;
    orderId: string;
    customerId?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    discountAmount: number;
  }): Promise<void> {
    const coupon = await this.findByCode(params.code);
    if (!coupon) return;

    const cleanEmail = normalizeEmailForLookup(params.customerEmail);
    const cleanPhone = normalizePhoneForLookup(params.customerPhone);
    const cleanCustomerId = params.customerId ? String(params.customerId).trim() : null;

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new Error(`Coupon "${coupon.code}" has reached its maximum redemption limit.`);
    }

    if (coupon.perUserLimit > 0 && (cleanCustomerId || cleanEmail || cleanPhone)) {
      const userUsageCount = await this.getCustomerUsageCount({
        couponId: coupon.id,
        customerId: cleanCustomerId,
        customerEmail: cleanEmail,
        customerPhone: cleanPhone,
      });
      if (userUsageCount >= coupon.perUserLimit) {
        throw new Error(`Coupon "${coupon.code}" has reached its per-customer redemption limit (${coupon.perUserLimit}).`);
      }
    }

    const prisma = getPrismaClient();
    if (prisma?.coupon) {
      try {
        if (coupon.usageLimit) {
          const updated = await prisma.coupon.updateMany({
            where: {
              id: coupon.id,
              usageCount: { lt: coupon.usageLimit },
            },
            data: { usageCount: { increment: 1 } },
          });
          if (updated && updated.count === 0) {
            throw new Error(`Coupon "${coupon.code}" redemption limit exhausted.`);
          }
        } else {
          await prisma.coupon.update({
            where: { id: coupon.id },
            data: { usageCount: { increment: 1 } },
          });
        }

        if (prisma.couponUsage) {
          await prisma.couponUsage.create({
            data: {
              id: `cu_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
              couponId: coupon.id,
              orderId: params.orderId,
              customerId: cleanCustomerId || null,
              customerEmail: cleanEmail || null,
              customerPhone: cleanPhone || null,
              discountAmount: Number(params.discountAmount || 0),
            },
          });
        }

        // Mark subscriber coupon redemption timestamp if subscribed
        if (prisma.earlyAccessSubscriber && (cleanEmail || cleanPhone)) {
          const orSub: any[] = [];
          if (cleanEmail) orSub.push({ email: cleanEmail });
          if (cleanPhone) orSub.push({ whatsappNumber: cleanPhone });
          if (orSub.length > 0) {
            await prisma.earlyAccessSubscriber
              .updateMany({
                where: { OR: orSub },
                data: { couponRedeemedAt: new Date() },
              })
              .catch(() => {});
          }
        }
      } catch (err: any) {
        if (err?.message?.includes('limit')) throw err;
      }
    }

    // Also update local cache mirror
    const cached = this.cache.get(coupon.id);
    if (cached) {
      cached.usageCount += 1;
      cached.updatedAt = new Date();
      this.cache.set(coupon.id, cached);
      this.saveToDisk();
    }
    this.usageCache.push({
      id: `cu_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      couponId: coupon.id,
      orderId: params.orderId,
      customerId: cleanCustomerId,
      customerEmail: cleanEmail,
      customerPhone: cleanPhone,
      discountAmount: Number(params.discountAmount || 0),
      usedAt: new Date().toISOString(),
    });
    this.saveUsageToDisk();
  }

  async releaseRedemption(code: string, orderId?: string): Promise<void> {
    const coupon = await this.findByCode(code);
    if (!coupon) return;

    const prisma = getPrismaClient();
    if (prisma?.coupon) {
      try {
        await prisma.coupon.updateMany({
          where: { id: coupon.id, usageCount: { gt: 0 } },
          data: { usageCount: { decrement: 1 } },
        });
        if (orderId && prisma.couponUsage) {
          await prisma.couponUsage.deleteMany({
            where: { couponId: coupon.id, orderId },
          });
        }
      } catch {}
    }

    const cached = this.cache.get(coupon.id);
    if (cached) {
      cached.usageCount = Math.max(0, (cached.usageCount || 0) - 1);
      cached.updatedAt = new Date();
      this.cache.set(coupon.id, cached);
      this.saveToDisk();
    }
    if (orderId) {
      this.usageCache = this.usageCache.filter(
        (u) => !(u.couponId === coupon.id && u.orderId === orderId)
      );
      this.saveUsageToDisk();
    }
  }

  async incrementUsage(code: string): Promise<void> {
    await this.recordRedemption({
      code,
      orderId: `ord_${Date.now()}`,
      discountAmount: 0,
    });
  }

  async decrementUsage(code: string): Promise<void> {
    await this.releaseRedemption(code);
  }

  async validateWithContext(ctx: CouponValidationContext): Promise<CouponValidationResult> {
    const coupon = await this.findByCode(ctx.code);
    if (!coupon) {
      return { valid: false, discount: 0, eligibleSubtotal: 0, reason: 'Invalid promo code.' };
    }

    if (!coupon.isActive) {
      return {
        valid: false,
        discount: 0,
        eligibleSubtotal: 0,
        reason: 'This coupon is currently inactive or paused.',
      };
    }

    const now = new Date();
    if (now < coupon.startDate) {
      return {
        valid: false,
        discount: 0,
        eligibleSubtotal: 0,
        reason: 'This coupon promotion has not started yet.',
      };
    }

    if (now > coupon.expiryDate) {
      return {
        valid: false,
        discount: 0,
        eligibleSubtotal: 0,
        reason: 'This coupon has expired.',
      };
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return {
        valid: false,
        discount: 0,
        eligibleSubtotal: 0,
        reason: 'This coupon has reached its maximum redemption limit.',
      };
    }

    // Per-user limit check
    if (coupon.perUserLimit > 0 && (ctx.customerId || ctx.customerEmail || ctx.customerPhone)) {
      const priorUses = await this.getCustomerUsageCount({
        couponId: coupon.id,
        customerId: ctx.customerId,
        customerEmail: ctx.customerEmail,
        customerPhone: ctx.customerPhone,
      });
      if (priorUses >= coupon.perUserLimit) {
        return {
          valid: false,
          discount: 0,
          eligibleSubtotal: 0,
          reason: `This promo code can only be redeemed ${coupon.perUserLimit} time(s) per customer.`,
        };
      }
    }

    // Compute eligible merchandise subtotal (shipping & tax NEVER included)
    const rawSubtotal = typeof ctx.subtotal === 'number' && !isNaN(ctx.subtotal) ? Math.max(0, ctx.subtotal) : 0;
    let eligibleSubtotal = rawSubtotal;

    if (Array.isArray(ctx.items) && ctx.items.length > 0) {
      const hasProductRestrictions = coupon.eligibleProductIds.length > 0;
      const hasCategoryRestrictions = coupon.eligibleCategories.length > 0;

      if (hasProductRestrictions || hasCategoryRestrictions) {
        const lowerCats = new Set(coupon.eligibleCategories.map((c) => c.toLowerCase()));
        const allowedProducts = new Set(coupon.eligibleProductIds);

        eligibleSubtotal = ctx.items.reduce((sum, item) => {
          const matchesProduct = hasProductRestrictions && allowedProducts.has(item.productId);
          const itemCat = String(item.category || '').toLowerCase();
          const itemWorld = String(item.world || '').toLowerCase();
          const itemDept = String(item.department || '').toLowerCase();
          const matchesCategory =
            hasCategoryRestrictions &&
            (lowerCats.has(itemCat) || lowerCats.has(itemWorld) || lowerCats.has(itemDept));

          const eligible =
            (hasProductRestrictions && matchesProduct) ||
            (hasCategoryRestrictions && matchesCategory);

          return eligible ? sum + Math.max(0, Number(item.lineTotal || 0)) : sum;
        }, 0);

        if (eligibleSubtotal <= 0) {
          return {
            valid: false,
            discount: 0,
            eligibleSubtotal: 0,
            reason: 'None of the products in your bag are eligible for this promo code.',
          };
        }
      } else {
        eligibleSubtotal = ctx.items.reduce(
          (sum, it) => sum + Math.max(0, Number(it.lineTotal || 0)),
          0
        );
      }
    }

    if (eligibleSubtotal > 0 && eligibleSubtotal < coupon.minOrderValue) {
      return {
        valid: false,
        discount: 0,
        eligibleSubtotal,
        reason: `Requires minimum eligible merchandise order value of ₹${coupon.minOrderValue}.`,
      };
    }

    if (eligibleSubtotal === 0 && coupon.minOrderValue > 0 && rawSubtotal === 0) {
      return {
        valid: false,
        discount: 0,
        eligibleSubtotal: 0,
        reason: `Add items worth ₹${coupon.minOrderValue} or more to apply ${coupon.code}.`,
      };
    }

    let calculatedDiscount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      calculatedDiscount = Math.round(eligibleSubtotal * (coupon.value / 100));
      if (coupon.maxDiscount && coupon.maxDiscount > 0) {
        calculatedDiscount = Math.min(calculatedDiscount, coupon.maxDiscount);
      }
      calculatedDiscount = Math.min(calculatedDiscount, eligibleSubtotal);
    } else {
      calculatedDiscount = eligibleSubtotal > 0 ? Math.min(coupon.value, eligibleSubtotal) : coupon.value;
    }

    return {
      valid: true,
      discount: Math.max(0, calculatedDiscount),
      eligibleSubtotal,
      coupon,
    };
  }

  async validate(
    code: string,
    subtotal: number = 0
  ): Promise<{ valid: boolean; discount: number; eligibleSubtotal?: number; reason?: string; coupon?: CouponRecord }> {
    return this.validateWithContext({ code, subtotal });
  }
}

export const couponRepository = new CouponRepository();

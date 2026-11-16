import fs from 'fs';
import path from 'path';
import { prisma } from '../db/prisma';
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
  isActive: boolean;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const STORE_PATH = resolveSecureStorePath('coupons-store.json', 'public/generated-assets/coupons-store.json');

export class CouponRepository {
  private cache = new Map<string, CouponRecord>();
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
              ...item,
              code: String(item.code || '').trim().toUpperCase(),
              startDate: new Date(item.startDate || '2026-01-01'),
              expiryDate: new Date(item.expiryDate || '2026-12-31'),
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
        discountType: 'FLAT',
        value: 100,
        minOrderValue: 999,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        expiryDate: new Date('2026-12-31T23:59:59.000Z'),
        usageCount: 142,
        isActive: true,
        description: '₹100 flat discount on orders above ₹999 for first drops',
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
        usageCount: 88,
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
        usageCount: 41,
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

  async getAll(): Promise<CouponRecord[]> {
    this.ensureLoaded();
    return Array.from(this.cache.values()).sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async getById(id: string): Promise<CouponRecord | null> {
    this.ensureLoaded();
    return this.cache.get(id) || null;
  }

  async findByCode(code: string): Promise<CouponRecord | null> {
    this.ensureLoaded();
    const clean = code.trim().toUpperCase();
    for (const record of this.cache.values()) {
      if (record.code.toUpperCase() === clean) {
        return record;
      }
    }
    return null;
  }

  async create(
    data: Omit<CouponRecord, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>,
    actorId?: string
  ): Promise<CouponRecord> {
    this.ensureLoaded();
    const cleanCode = data.code.trim().toUpperCase();
    
    // Check duplicate code
    const existing = await this.findByCode(cleanCode);
    if (existing) {
      throw new Error(`A coupon with code "${cleanCode}" already exists.`);
    }

    const newRecord: CouponRecord = {
      ...data,
      id: `coup-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      code: cleanCode,
      usageCount: 0,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : new Date('2026-12-31T23:59:59.000Z'),
      isActive: data.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.cache.set(newRecord.id, newRecord);
    this.saveToDisk();

    // Sync to Prisma if available
    try {
      if (prisma && prisma.coupon) {
        await prisma.coupon.create({
          data: {
            id: newRecord.id,
            code: newRecord.code,
            discountType: newRecord.discountType === 'FLAT' ? 'FIXED' : 'PERCENTAGE',
            value: newRecord.value,
            minOrderValue: newRecord.minOrderValue,
            maxDiscount: newRecord.maxDiscount,
            usageLimit: newRecord.usageLimit,
            usageCount: 0,
            isActive: newRecord.isActive,
            startsAt: newRecord.startDate,
            expiresAt: newRecord.expiryDate,
            description: newRecord.description,
          },
        }).catch(() => {});
      }
    } catch {}

    console.log(`[CouponRepo] ✅ Coupon created: ${newRecord.code} (${newRecord.id}) by ${actorId || 'STAFF'}`);
    return newRecord;
  }

  async update(id: string, updates: Partial<CouponRecord>, actorId?: string): Promise<CouponRecord | null> {
    this.ensureLoaded();
    const existing = this.cache.get(id);
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
      startDate: updates.startDate ? new Date(updates.startDate) : existing.startDate,
      expiryDate: updates.expiryDate ? new Date(updates.expiryDate) : existing.expiryDate,
      updatedAt: new Date(),
    };

    this.cache.set(id, merged);
    this.saveToDisk();

    try {
      if (prisma && prisma.coupon) {
        await prisma.coupon.update({
          where: { id },
          data: {
            code: merged.code,
            discountType: merged.discountType === 'FLAT' ? 'FIXED' : 'PERCENTAGE',
            value: merged.value,
            minOrderValue: merged.minOrderValue,
            maxDiscount: merged.maxDiscount,
            usageLimit: merged.usageLimit,
            isActive: merged.isActive,
            startsAt: merged.startDate,
            expiresAt: merged.expiryDate,
            description: merged.description,
          },
        }).catch(() => {});
      }
    } catch {}

    console.log(`[CouponRepo] ✏️ Coupon updated: ${merged.code} (${id}) by ${actorId || 'STAFF'}`);
    return merged;
  }

  async delete(id: string, actorId?: string): Promise<boolean> {
    this.ensureLoaded();
    const existing = this.cache.get(id);
    if (!existing) return false;

    this.cache.delete(id);
    this.saveToDisk();

    try {
      if (prisma && prisma.coupon) {
        await prisma.coupon.delete({ where: { id } }).catch(() => {});
      }
    } catch {}

    console.log(`[CouponRepo] 🗑️ Coupon deleted: ${existing.code} (${id}) by ${actorId || 'STAFF'}`);
    return true;
  }

  async toggleActive(id: string, actorId?: string): Promise<CouponRecord | null> {
    this.ensureLoaded();
    const existing = this.cache.get(id);
    if (!existing) return null;

    return this.update(id, { isActive: !existing.isActive }, actorId);
  }

  async incrementUsage(code: string): Promise<void> {
    const c = await this.findByCode(code);
    if (c) {
      c.usageCount += 1;
      c.updatedAt = new Date();
      this.cache.set(c.id, c);
      this.saveToDisk();

      try {
        if (prisma && prisma.coupon) {
          await prisma.coupon.update({
            where: { id: c.id },
            data: { usageCount: { increment: 1 } },
          }).catch(() => {});
        }
      } catch {}
    }
  }

  async decrementUsage(code: string): Promise<void> {
    const c = await this.findByCode(code);
    if (c) {
      c.usageCount = Math.max(0, (c.usageCount || 0) - 1);
      c.updatedAt = new Date();
      this.cache.set(c.id, c);
      this.saveToDisk();

      try {
        if (prisma && prisma.coupon) {
          await prisma.coupon.update({
            where: { id: c.id },
            data: { usageCount: { decrement: 1 } },
          }).catch(() => {});
        }
      } catch {}
    }
  }

  async validate(
    code: string,
    subtotal: number = 0
  ): Promise<{ valid: boolean; discount: number; reason?: string; coupon?: CouponRecord }> {
    const coupon = await this.findByCode(code);
    if (!coupon) {
      return { valid: false, discount: 0, reason: 'Invalid promo code.' };
    }

    if (!coupon.isActive) {
      return { valid: false, discount: 0, reason: 'This coupon is currently inactive.' };
    }

    const now = new Date();
    if (now < coupon.startDate) {
      return { valid: false, discount: 0, reason: 'This coupon promotion has not started yet.' };
    }

    if (now > coupon.expiryDate) {
      return { valid: false, discount: 0, reason: 'This coupon has expired.' };
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, discount: 0, reason: 'This coupon has reached its maximum usage limit.' };
    }

    if (subtotal > 0 && subtotal < coupon.minOrderValue) {
      return {
        valid: false,
        discount: 0,
        reason: `Requires minimum order value of ₹${coupon.minOrderValue}.`,
      };
    }

    let calculatedDiscount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      calculatedDiscount = Math.round(subtotal * (coupon.value / 100));
      if (coupon.maxDiscount) {
        calculatedDiscount = Math.min(calculatedDiscount, coupon.maxDiscount);
      }
    } else {
      calculatedDiscount = subtotal > 0 ? Math.min(coupon.value, subtotal) : coupon.value;
    }

    return {
      valid: true,
      discount: calculatedDiscount,
      coupon,
    };
  }
}

export const couponRepository = new CouponRepository();
